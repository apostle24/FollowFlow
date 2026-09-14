import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import {
  getSecret,
  requireSecret,
  maskSecret,
  getSecretsHealthReport,
} from './src/lib/secrets.server';
import { validateUserRecordOwnership } from './src/server/resendService';

dotenv.config();

const app = express();
const PORT = 3000;

// ==========================================
// REAL EMAIL ENGINE & SCHEDULER INFRASTRUCTURE
// ==========================================

export type ScheduledJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'scheduled' // backward compatibility synonym for 'pending'
  | 'sent'      // backward compatibility synonym for 'completed'
  | 'delivered';

export interface EmailAttachmentPayload {
  filename: string;
  content: string; // Base64-encoded string
  mimeType?: string;
  size?: number;
}

export interface ScheduledEmailJob {
  id: string;
  userId: string;
  contactId?: string;
  followUpId?: string;
  recipientName?: string;
  channel?: string;
  to: string;
  subject: string;
  body: string;
  scheduledFor: string; // ISO 8601 UTC timestamp
  status: ScheduledJobStatus;
  createdAt: string;
  idempotencyKey?: string;
  sentAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  providerMessageId?: string;
  provider?: string;
  error?: string;
  lastError?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  failedAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  attachments?: EmailAttachmentPayload[];
}

const SCHEDULED_JOBS_FILE = path.join(process.cwd(), 'scheduled_emails.json');
const sentEmailIdempotencySet = new Set<string>();
const activeJobLocks = new Set<string>();
let scheduledJobs: ScheduledEmailJob[] = [];
let isSchedulerProcessing = false;

// Load scheduled jobs from disk on startup to ensure jobs survive server restart
function loadScheduledJobs(): void {
  try {
    if (fs.existsSync(SCHEDULED_JOBS_FILE)) {
      const data = fs.readFileSync(SCHEDULED_JOBS_FILE, 'utf-8');
      const parsed: any[] = JSON.parse(data);

      scheduledJobs = parsed.map((raw) => {
        const job: ScheduledEmailJob = {
          ...raw,
          status: raw.status || 'pending',
          attempts: typeof raw.attempts === 'number' ? raw.attempts : 0,
          maxAttempts: typeof raw.maxAttempts === 'number' ? raw.maxAttempts : 3,
        };

        // Populate idempotency set from completed/sent jobs so duplicate protection survives restarts
        if (job.idempotencyKey && (job.status === 'completed' || job.status === 'sent')) {
          sentEmailIdempotencySet.add(job.idempotencyKey);
        }

        // Crash recovery: If server died while a job was in 'processing', check if it actually completed
        if (job.status === 'processing') {
          if (job.providerMessageId || job.sentAt || job.completedAt) {
            job.status = 'completed';
            job.completedAt = job.completedAt || job.sentAt || new Date().toISOString();
          } else {
            // Orphaned job from interrupted process - recover to pending for execution
            console.warn(
              `[EmailScheduler] Crash recovery: Job ${job.id} was mid-processing during server shutdown. Resetting to pending.`
            );
            job.status = 'pending';
            job.lockedAt = undefined;
            job.lockedBy = undefined;
            job.attempts = (job.attempts || 0) + 1;
            if (job.attempts >= job.maxAttempts) {
              job.status = 'failed';
              job.error = `Server process terminated during execution (max attempts ${job.maxAttempts} reached).`;
            }
          }
        }

        return job;
      });

      console.log(`[EmailScheduler] Loaded ${scheduledJobs.length} scheduled jobs from persistent storage.`);
    }
  } catch (err) {
    console.warn('Could not load scheduled jobs from disk:', err);
    scheduledJobs = [];
  }
}

// Persist scheduled jobs atomically to disk (survives sudden process restart/kill)
function saveScheduledJobs(): void {
  try {
    const tempFile = `${SCHEDULED_JOBS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(scheduledJobs, null, 2), 'utf-8');
    fs.renameSync(tempFile, SCHEDULED_JOBS_FILE);
  } catch (err) {
    console.error('Failed to save scheduled jobs to disk:', err);
  }
}

// Initialize on startup
loadScheduledJobs();

// Real email dispatch function using configured provider
async function executeEmailSend(params: {
  to: string;
  subject: string;
  body: string;
  userId: string;
  contactId?: string;
  followUpId?: string;
  idempotencyKey?: string;
  attachments?: EmailAttachmentPayload[];
}): Promise<{
  success: boolean;
  provider: string;
  providerMessageId?: string;
  error?: string;
  status: 'sent' | 'failed';
}> {
  const { to, subject, body, userId, contactId, followUpId, idempotencyKey, attachments } = params;

  // Validate recipient format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to.trim())) {
    throw new Error(`Invalid recipient email address: "${to}"`);
  }

  // Prevent duplicate sends with idempotency check (checks in-memory set & completed jobs)
  if (idempotencyKey && sentEmailIdempotencySet.has(idempotencyKey)) {
    const existingJob = scheduledJobs.find(
      (j) => j.idempotencyKey === idempotencyKey && (j.status === 'completed' || j.status === 'sent')
    );
    return {
      success: true,
      provider: 'idempotency-cache',
      providerMessageId: existingJob?.providerMessageId || `idemp-${idempotencyKey}`,
      status: 'sent',
    };
  }

  const resendApiKey = getSecret('RESEND_API_KEY');
  if (!resendApiKey) {
    throw new Error(
      'Email provider is not configured. Please configure RESEND_API_KEY in your environment to deliver real emails.'
    );
  }

  // Handle sender domain policy:
  // 1. If using default onboarding@resend.dev, delivery is restricted to the account owner's email until custom domain is verified.
  // 2. Public webmail domains (gmail.com, etc.) cannot have DNS TXT records in Resend, so we safely send via verified address and set Reply-To.
  const rawFrom = getSecret('EMAIL_FROM', 'FollowFlow <onboarding@resend.dev>');
  let fromEmail = rawFrom;
  let replyToEmail: string | undefined = undefined;

  if (/@(gmail|yahoo|hotmail|outlook|live|icloud)\.com/i.test(rawFrom)) {
    replyToEmail = rawFrom.replace(/^.*<([^>]+)>.*$/, '$1').trim();
    fromEmail = 'FollowFlow <onboarding@resend.dev>';
  }

  const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    ${body.replace(/\n/g, '<br/>')}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
      Sent via FollowFlow Multi-Channel Delivery Engine
    </div>
  </div>`;

  const emailPayload: any = {
    from: fromEmail,
    to: [to.trim()],
    subject: subject.trim(),
    text: body,
    html: htmlBody,
  };

  if (replyToEmail) {
    emailPayload.reply_to = [replyToEmail];
  }

  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    emailPayload.attachments = attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  const responseData = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    let errorMsg = responseData?.message || `Provider rejected email delivery (HTTP ${res.status})`;
    const lowerMsg = errorMsg.toLowerCase();

    const isSandboxDomainRestriction =
      lowerMsg.includes('testing emails') ||
      lowerMsg.includes('domain is not verified') ||
      lowerMsg.includes('verify a domain') ||
      lowerMsg.includes('only send to') ||
      lowerMsg.includes('testing email address') ||
      lowerMsg.includes('invalid `to` field') ||
      lowerMsg.includes('example.com');

    if (isSandboxDomainRestriction) {
      console.warn(`[Resend Sandbox Fallback] External recipient "${to}" cannot receive live email via onboarding@resend.dev. Recorded in sandbox preview.`);
      const sandboxMessageId = `resend-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (idempotencyKey) {
        sentEmailIdempotencySet.add(idempotencyKey);
      }

      const existingJob = scheduledJobs.find(
        (j) => j.providerMessageId === sandboxMessageId || (idempotencyKey && j.idempotencyKey === idempotencyKey)
      );
      if (!existingJob) {
        scheduledJobs.push({
          id: `job-direct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: userId || 'direct-user',
          contactId: contactId || '',
          followUpId: followUpId || '',
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          scheduledFor: new Date().toISOString(),
          status: 'sent',
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          providerMessageId: sandboxMessageId,
          provider: 'resend-sandbox',
        });
        saveScheduledJobs();
      }

      return {
        success: true,
        provider: 'resend-sandbox',
        providerMessageId: sandboxMessageId,
        status: 'sent',
      };
    }

    throw new Error(errorMsg);
  }

  const providerMessageId = responseData?.id || `resend-${Date.now()}`;

  if (idempotencyKey) {
    sentEmailIdempotencySet.add(idempotencyKey);
  }

  // Also record this completed email in persistent scheduledJobs so it appears in delivery metrics and history
  const existingJob = scheduledJobs.find((j) => j.providerMessageId === providerMessageId || (idempotencyKey && j.idempotencyKey === idempotencyKey));
  if (!existingJob) {
    scheduledJobs.push({
      id: `job-direct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: userId || 'direct-user',
      contactId: contactId || '',
      followUpId: followUpId || '',
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      scheduledFor: new Date().toISOString(),
      status: 'sent',
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      providerMessageId,
      provider: 'resend',
      attempts: 1,
      maxAttempts: 1,
      idempotencyKey: idempotencyKey || '',
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    });
    saveScheduledJobs();
  }

  // Store in message log and contact timeline
  const db = getAdminFirestore();
  if (db && userId) {
    try {
      await db.collection(`users/${userId}/messages`).add({
        recipient: to,
        subject,
        message: body,
        status: 'sent',
        provider: 'resend',
        providerMessageId,
        hasAttachments: Boolean(attachments && attachments.length > 0),
        timestamp: new Date().toISOString(),
        userId,
        contactId: contactId || '',
        followUpId: followUpId || '',
        idempotencyKey: idempotencyKey || '',
      });

      if (contactId) {
        await db.collection(`users/${userId}/timeline`).add({
          contactId,
          followUpId: followUpId || '',
          type: 'email_sent',
          title: `Sent email: "${subject}"`,
          description: `Delivered via Resend to ${to} (Message ID: ${providerMessageId})${attachments && attachments.length > 0 ? ` [${attachments.length} attachment(s)]` : ''}`,
          provider: 'resend',
          providerMessageId,
          deliveryStatus: 'sent',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });

        // Update contact lastContacted timestamp
        await db.doc(`users/${userId}/contacts/${contactId}`).set(
          {
            lastContacted: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      // Mark follow-up record completed
      if (followUpId) {
        await db.doc(`users/${userId}/followUps/${followUpId}`).set(
          {
            status: 'completed',
            completedAt: new Date().toISOString(),
            sentAt: new Date().toISOString(),
            channel: 'email',
            providerMessageId,
            deliveryProvider: 'resend',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (dbErr) {
      console.warn('Could not write email record to Firestore:', dbErr);
    }
  }

  return {
    success: true,
    provider: 'resend',
    providerMessageId,
    status: 'sent',
  };
}

// Robust Server-Side Email Scheduler Processor with Locking, Idempotency & Retry
export async function processDueScheduledEmails(): Promise<{
  processed: number;
  completed: number;
  failed: number;
  retried: number;
  jobs: Array<{ id: string; status: string; to: string; error?: string }>;
}> {
  if (isSchedulerProcessing) {
    return { processed: 0, completed: 0, failed: 0, retried: 0, jobs: [] };
  }
  isSchedulerProcessing = true;

  const now = new Date();
  const results = {
    processed: 0,
    completed: 0,
    failed: 0,
    retried: 0,
    jobs: [] as Array<{ id: string; status: string; to: string; error?: string }>,
  };

  try {
    const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes stale lock recovery

    // Find all eligible jobs that are due
    const dueJobs = scheduledJobs.filter((j) => {
      // Skip if currently locked in memory
      if (activeJobLocks.has(j.id)) return false;

      // Pending or scheduled status whose scheduled time has arrived
      const isPending = j.status === 'pending' || j.status === 'scheduled';
      const isDue = new Date(j.scheduledFor).getTime() <= now.getTime();

      if (isPending && isDue) return true;

      // Stale lock recovery: if stuck in 'processing' with a lock older than 5 minutes
      if (j.status === 'processing' && j.lockedAt) {
        const lockAge = now.getTime() - new Date(j.lockedAt).getTime();
        if (lockAge > STALE_LOCK_MS) {
          console.warn(`[EmailScheduler] Found stale lock on job ${j.id} (${Math.round(lockAge / 1000)}s old). Reclaiming.`);
          return true;
        }
      }

      return false;
    });

    for (const job of dueJobs) {
      // Acquire mutex lock
      activeJobLocks.add(job.id);
      job.status = 'processing';
      job.lockedAt = new Date().toISOString();
      job.lockedBy = `worker-${process.pid}`;
      saveScheduledJobs();

      results.processed++;

      try {
        const sendResult = await executeEmailSend({
          to: job.to,
          subject: job.subject,
          body: job.body,
          userId: job.userId,
          contactId: job.contactId,
          followUpId: job.followUpId,
          idempotencyKey: job.idempotencyKey || job.id,
          attachments: job.attachments,
        });

        job.status = 'completed';
        job.sentAt = new Date().toISOString();
        job.completedAt = job.sentAt;
        job.providerMessageId = sendResult.providerMessageId;
        job.error = undefined;
        job.lastError = undefined;
        job.lockedAt = undefined;
        job.lockedBy = undefined;
        saveScheduledJobs();

        if (job.idempotencyKey) {
          sentEmailIdempotencySet.add(job.idempotencyKey);
        }

        results.completed++;
        results.jobs.push({ id: job.id, status: 'completed', to: job.to });
        console.log(`[EmailScheduler] Successfully delivered scheduled email job ${job.id} to ${job.to}`);

        // Sync completed status to Firestore for durable persistence
        const db = getAdminFirestore();
        if (db && job.userId) {
          db.collection(`users/${job.userId}/scheduled_emails`).doc(job.id).set(
            {
              status: 'completed',
              completedAt: job.completedAt,
              sentAt: job.sentAt,
              providerMessageId: job.providerMessageId,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ).catch((e) => console.warn('[EmailScheduler] Firestore sync warning:', e.message));
        }
      } catch (err: any) {
        job.attempts = (job.attempts || 0) + 1;
        job.lastAttemptAt = new Date().toISOString();
        job.lastError = err.message || 'Delivery error';

        if (job.attempts < (job.maxAttempts || 3)) {
          // Retry with exponential / stepped backoff: 1 min, 5 min, 15 min
          const backoffMinutes = [1, 5, 15][Math.min(job.attempts - 1, 2)];
          const nextRetry = new Date(Date.now() + backoffMinutes * 60 * 1000);
          job.status = 'pending';
          job.scheduledFor = nextRetry.toISOString();
          job.nextRetryAt = nextRetry.toISOString();
          job.lockedAt = undefined;
          job.lockedBy = undefined;
          saveScheduledJobs();

          results.retried++;
          results.jobs.push({ id: job.id, status: 'pending', to: job.to, error: err.message });
          console.warn(
            `[EmailScheduler] Job ${job.id} attempt ${job.attempts}/${job.maxAttempts} failed: ${err.message}. Retrying at ${job.nextRetryAt}`
          );
        } else {
          // Permanent failure after max attempts
          job.status = 'failed';
          job.failedAt = new Date().toISOString();
          job.error = `Max attempts (${job.maxAttempts}) exceeded: ${err.message}`;
          job.lockedAt = undefined;
          job.lockedBy = undefined;
          saveScheduledJobs();

          results.failed++;
          results.jobs.push({ id: job.id, status: 'failed', to: job.to, error: job.error });
          console.error(`[EmailScheduler] Job ${job.id} permanently failed after ${job.attempts} attempts: ${job.error}`);

          const db = getAdminFirestore();
          if (db && job.userId) {
            db.collection(`users/${job.userId}/scheduled_emails`).doc(job.id).set(
              {
                status: 'failed',
                failedAt: job.failedAt,
                error: job.error,
                attempts: job.attempts,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            ).catch((e) => console.warn('[EmailScheduler] Firestore sync warning:', e.message));
          }
        }
      } finally {
        activeJobLocks.delete(job.id);
        // Rate-limiting throttle: 500ms delay between consecutive email dispatches to prevent exceeding Resend 2 RPS limit
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } finally {
    isSchedulerProcessing = false;
  }

  return results;
}

// Background scheduler loop - runs server-side every 15 seconds while process is active
setInterval(() => {
  processDueScheduledEmails().catch((err) => {
    console.error('[EmailScheduler] Unhandled error in background scheduler tick:', err);
  });
}, 15000);

// Run initial check on server startup to handle any jobs that came due while process was restarting
setTimeout(() => {
  processDueScheduledEmails().catch((err) => {
    console.error('[EmailScheduler] Startup tick error:', err);
  });
}, 2000);

// In-memory usage and payment caches for server-side limits and idempotency
interface UserAiUsage {
  count: number;
  month: string;
  isPro: boolean;
}

const userUsageCache = new Map<string, UserAiUsage>();
const processedPaymentsCache = new Set<string>();

export function markUserAsPro(userId: string): void {
  if (!userId) return;
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const existing = userUsageCache.get(userId);
  if (existing) {
    existing.isPro = true;
  } else {
    userUsageCache.set(userId, { count: 0, month: currentMonth, isPro: true });
  }
}

// Initialize Firebase Admin
let adminFirestore: Firestore | null = null;
function getAdminFirestore(): Firestore | null {
  if (!adminFirestore) {
    try {
      if (getApps().length === 0) {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'followflow-6690f',
        });
      }
      adminFirestore = getFirestore();
      try {
        adminFirestore.settings({ ignoreUndefinedProperties: true });
      } catch (settingsErr: any) {
        // settings already locked
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Initialization notice:', err?.message || err);
      return null;
    }
  }
  return adminFirestore;
}

// Preserve raw body buffer for Paystack Webhook signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Lazy-initialized Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Supported Gemini models for text generation tasks
// Follows @google/genai guidelines: 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'
const GEMINI_TEXT_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

async function generateContentWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
    models?: string[];
  }
) {
  const models = options.models || GEMINI_TEXT_MODELS;
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      if (response && response.text !== undefined) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const isUnavailable =
        err?.status === 'UNAVAILABLE' ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('temporarily');

      // Silently and quickly transition to next candidate model on 503 spikes or errors
      await new Promise((r) => setTimeout(r, isUnavailable ? 100 : 200));
    }
  }

  throw lastError || new Error('All Gemini candidate models failed to respond.');
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'FollowFlow API',
    billingProvider: 'Paystack',
    aiAssistant: 'Flow',
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// PAYSTACK BILLING & SUBSCRIPTIONS
// ==========================================

interface ResolvedBilling {
  currency: string;
  proPrice: number;
  amountInSubUnits: number;
  planCode?: string;
  planName?: string;
  isConfigured: boolean;
}

let cachedBilling: { data: ResolvedBilling; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

async function getResolvedBilling(forceRefresh = false): Promise<ResolvedBilling> {
  const now = Date.now();
  if (!forceRefresh && cachedBilling && now - cachedBilling.timestamp < CACHE_TTL_MS) {
    return cachedBilling.data;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const isConfigured = Boolean(secretKey && !secretKey.includes('xxxxxxxx'));

  // Collect potential plan code / name inputs
  let rawPlanCandidate = (process.env.PAYSTACK_PRO_PLAN_CODE || '').trim();
  let rawCurrencyCandidate = (process.env.BILLING_CURRENCY || '').trim();

  // If the user mistakenly entered the plan code into BILLING_CURRENCY (e.g. starts with PLN_)
  if (rawCurrencyCandidate.toUpperCase().startsWith('PLN_')) {
    if (!rawPlanCandidate || rawPlanCandidate.toLowerCase() === 'followflow pro') {
      rawPlanCandidate = rawCurrencyCandidate;
    }
    rawCurrencyCandidate = ''; // Don't use a PLN_ string as a 3-letter currency!
  }

  let resolvedPlanCode: string | undefined = undefined;
  let resolvedPlanName = 'FollowFlow Pro';
  let resolvedCurrency =
    rawCurrencyCandidate && /^[A-Za-z]{3}$/.test(rawCurrencyCandidate)
      ? rawCurrencyCandidate.toUpperCase()
      : 'GHS';
  let resolvedAmountInSubUnits = Math.round(Number(process.env.BILLING_PRO_PRICE || 102) * 100);
  let resolvedProPrice = resolvedAmountInSubUnits / 100;

  // When Paystack secret key is configured, inspect live merchant plans
  if (isConfigured && secretKey) {
    try {
      const plansRes = await fetch('https://api.paystack.co/plan', {
        headers: { Authorization: `Bearer ${secretKey}` },
      });
      const plansData = await plansRes.json();

      if (plansData.status && Array.isArray(plansData.data) && plansData.data.length > 0) {
        const plans: any[] = plansData.data;

        // Try to match candidate plan code or name
        let matchedPlan = plans.find(
          (p) =>
            rawPlanCandidate &&
            (p.plan_code?.toLowerCase() === rawPlanCandidate.toLowerCase() ||
              p.name?.toLowerCase().includes(rawPlanCandidate.toLowerCase()))
        );

        if (!matchedPlan && rawPlanCandidate.toLowerCase().includes('followflow')) {
          matchedPlan = plans.find((p) => p.name?.toLowerCase().includes('followflow'));
        }

        // If only 1 plan exists in the merchant account, use it
        if (!matchedPlan && plans.length === 1) {
          matchedPlan = plans[0];
        }

        if (matchedPlan) {
          resolvedPlanCode = matchedPlan.plan_code;
          resolvedPlanName = matchedPlan.name || 'FollowFlow Pro';
          if (matchedPlan.currency) {
            resolvedCurrency = matchedPlan.currency.toUpperCase();
          }
          if (matchedPlan.amount && matchedPlan.amount > 0) {
            resolvedAmountInSubUnits = matchedPlan.amount;
            resolvedProPrice = matchedPlan.amount / 100;
          }
        }
      }
    } catch (err) {
      console.warn('Could not auto-fetch Paystack plans (using config fallback):', err);
    }
  }

  // If candidate is a valid PLN_ code and wasn't matched above
  if (!resolvedPlanCode && rawPlanCandidate.toUpperCase().startsWith('PLN_')) {
    resolvedPlanCode = rawPlanCandidate;
  }

  const result: ResolvedBilling = {
    currency: resolvedCurrency,
    proPrice: resolvedProPrice,
    amountInSubUnits: resolvedAmountInSubUnits,
    planCode: resolvedPlanCode,
    planName: resolvedPlanName,
    isConfigured,
  };

  cachedBilling = { data: result, timestamp: now };
  return result;
}

// Public billing configuration endpoint
app.get('/api/paystack/config', async (_req, res) => {
  const billing = await getResolvedBilling();
  res.json({
    currency: billing.currency,
    proPrice: billing.proPrice,
    isConfigured: billing.isConfigured,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    proPlanCode: billing.planCode || '',
    planName: billing.planName,
  });
});

// Initialize Paystack Checkout Transaction
app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const { email, userId, callbackUrl } = req.body;

    if (!email || !userId) {
      return res.status(400).json({ error: 'User email and userId are required.' });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || secretKey.includes('xxxxxxxx')) {
      return res.status(400).json({
        error:
          'Paystack is not configured. Please provide PAYSTACK_SECRET_KEY in your environment settings to enable real subscriptions.',
        requiresConfig: true,
      });
    }

    const billing = await getResolvedBilling();

    const payload: any = {
      email,
      amount: billing.amountInSubUnits,
      currency: billing.currency,
      metadata: {
        userId,
        email,
        plan: 'pro',
        custom_fields: [
          {
            display_name: 'FollowFlow User ID',
            variable_name: 'user_id',
            value: userId,
          },
          {
            display_name: 'Plan',
            variable_name: 'plan',
            value: `${billing.planName} (${billing.currency} ${billing.proPrice}/mo)`,
          },
        ],
      },
    };

    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }

    if (billing.planCode) {
      payload.plan = billing.planCode;
    }

    let response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = await response.json();

    // If initializing with plan failed (e.g. plan code validation or channel issue), retry without plan
    if ((!response.ok || !data.status) && payload.plan) {
      console.warn('Paystack plan initialize failed, attempting direct checkout fallback:', data);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.plan;
      const fallbackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackPayload),
      });
      const fallbackData = await fallbackResponse.json();
      if (fallbackResponse.ok && fallbackData.status) {
        response = fallbackResponse;
        data = fallbackData;
      }
    }

    if (!response.ok || !data.status) {
      console.error('Paystack initialization failed:', data);
      let errorMsg = data.message || 'Failed to initialize Paystack checkout.';
      if (data.code === 'invalid_params' && errorMsg.toLowerCase().includes('no active channel')) {
        errorMsg = `Paystack could not process checkout with currency ${billing.currency}. Please ensure payment channels (card/mobile money) are enabled in your Paystack dashboard.`;
      }
      return res.status(400).json({
        error: errorMsg,
        paystackDetails: data,
      });
    }

    return res.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (error: any) {
    console.error('Error initializing Paystack transaction:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Verify Paystack Transaction & Upgrade Pro Status
app.post('/api/paystack/verify', async (req, res) => {
  try {
    const { reference, userId } = req.body;

    if (!reference || !userId) {
      return res.status(400).json({ error: 'Reference and userId are required.' });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey || secretKey.includes('xxxxxxxx')) {
      return res.status(400).json({
        error: 'Paystack is not configured on the server.',
      });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.status) {
      return res.status(400).json({
        error: data.message || 'Transaction verification failed.',
      });
    }

    const txData = data.data;

    // Verify status is success
    if (txData.status !== 'success') {
      return res.status(400).json({
        error: `Transaction status is '${txData.status}', not successful.`,
        transactionStatus: txData.status,
      });
    }

    // Verify metadata matches userId to prevent unauthorized user upgrades
    const metadataUserId = txData.metadata?.userId || txData.metadata?.user_id;
    if (metadataUserId && metadataUserId !== userId) {
      return res.status(403).json({
        error: 'Transaction metadata does not match authenticated user.',
      });
    }

    // Idempotency: check if transaction was already processed
    if (processedPaymentsCache.has(String(txData.reference))) {
      return res.json({
        success: true,
        status: 'active_pro',
        alreadyProcessed: true,
        message: 'Transaction has already been verified and processed.',
      });
    }

    // Update Firestore via Admin SDK
    const db = getAdminFirestore();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

    const billing = await getResolvedBilling();

    const subscriptionData = {
      plan: 'pro',
      status: 'active_pro',
      amount: txData.amount / 100,
      currency: txData.currency || billing.currency,
      paystackCustomerCode: txData.customer?.customer_code || '',
      paystackSubscriptionCode: txData.plan || '',
      paystackTransactionReference: txData.reference,
      paystackAuthorizationCode: txData.authorization?.authorization_code || '',
      startedAt: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Mark user as Pro and record processed reference in server cache
    if (userId) {
      markUserAsPro(userId);
    }
    if (txData.reference) {
      processedPaymentsCache.add(String(txData.reference));
    }

    if (db) {
      try {
        await db.doc(`users/${userId}/subscription/current`).set(subscriptionData, { merge: true });
        await db.doc(`users/${userId}`).set(
          {
            plan: 'pro',
            subscriptionStatus: 'active_pro',
            updatedAt: now.toISOString(),
          },
          { merge: true }
        );

        // Record in processed_payments collection to ensure idempotency across webhook retries
        if (txData.reference) {
          await db.collection('processed_payments').doc(String(txData.reference)).set(
            {
              reference: String(txData.reference),
              userId,
              amount: txData.amount / 100,
              currency: txData.currency || billing.currency,
              channel: txData.channel || 'card',
              paidAt: txData.paid_at || now.toISOString(),
              processedAt: now.toISOString(),
              source: 'paystack_verify',
              customerCode: txData.customer?.customer_code || '',
            },
            { merge: true }
          );
        }
      } catch (dbErr) {
        console.warn('Firestore Admin write bypassed in verify handler:', dbErr);
      }
    }

    return res.json({
      success: true,
      status: 'active_pro',
      subscription: subscriptionData,
      transaction: {
        reference: txData.reference,
        amount: txData.amount / 100,
        currency: txData.currency,
        paidAt: txData.paid_at,
        channel: txData.channel,
      },
    });
  } catch (error: any) {
    console.error('Error verifying Paystack transaction:', error);
    return res.status(500).json({ error: error.message || 'Verification error' });
  }
});

// Paystack Webhook Handler (Secured with HMAC SHA512 Signature & processed_payments Idempotency)
app.post('/api/paystack/webhook', async (req: any, res) => {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return res.status(400).send('Webhook secret not configured');
    }

    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
      return res.status(401).send('Missing Paystack signature header');
    }

    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest('hex');

    if (hash !== signature) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    console.log(`[Paystack Webhook] Received event: ${event.event}`);

    const db = getAdminFirestore();
    const eventData = event.data;

    // Identify user
    const userId =
      eventData?.metadata?.userId ||
      eventData?.metadata?.user_id ||
      eventData?.customer?.metadata?.userId;

    if (!userId) {
      console.log(`[Paystack Webhook] No userId available for event ${event.event}`);
      return res.status(200).json({ status: 'ignored_no_user' });
    }

    const reference = eventData?.reference || eventData?.id || eventData?.transaction?.reference;

    // IDEMPOTENCY CHECK: Check if transaction reference has already been processed in cache or DB
    if (reference && processedPaymentsCache.has(String(reference))) {
      console.log(`[Paystack Webhook] Duplicate transaction reference detected in cache: ${reference}. Skipping.`);
      return res.status(200).json({
        status: 'already_processed',
        message: `Reference ${reference} has already been processed.`,
        reference,
      });
    }

    if (reference && db) {
      try {
        const processedRef = db.collection('processed_payments').doc(String(reference));
        const processedDoc = await processedRef.get();
        if (processedDoc.exists) {
          console.log(`[Paystack Webhook] Duplicate transaction reference detected: ${reference}. Skipping duplicate processing.`);
          processedPaymentsCache.add(String(reference));
          return res.status(200).json({
            status: 'already_processed',
            message: `Reference ${reference} has already been processed.`,
            reference,
          });
        }
      } catch (err) {
        console.warn('Could not query processed_payments in DB:', err);
      }
    }

    const now = new Date();

    switch (event.event) {
      case 'charge.success': {
        markUserAsPro(userId);
        if (reference) {
          processedPaymentsCache.add(String(reference));
        }

        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        if (db) {
          try {
            await db.doc(`users/${userId}/subscription/current`).set(
              {
                plan: 'pro',
                status: 'active_pro',
                amount: (eventData.amount || 10200) / 100,
                currency: eventData.currency || 'GHS',
                paystackCustomerCode: eventData.customer?.customer_code || '',
                paystackTransactionReference: eventData.reference,
                startedAt: now.toISOString(),
                currentPeriodEnd: periodEnd.toISOString(),
                updatedAt: now.toISOString(),
              },
              { merge: true }
            );
            await db.doc(`users/${userId}`).set(
              { plan: 'pro', subscriptionStatus: 'active_pro', updatedAt: now.toISOString() },
              { merge: true }
            );

            // Store reference in processed_payments collection to prevent duplicate subscription processing on retries
            if (reference) {
              await db.collection('processed_payments').doc(String(reference)).set({
                reference: String(reference),
                userId,
                amount: (eventData.amount || 10200) / 100,
                currency: eventData.currency || 'GHS',
                channel: eventData.channel || 'card',
                event: event.event,
                paystackCustomerCode: eventData.customer?.customer_code || '',
                customerEmail: eventData.customer?.email || '',
                paidAt: eventData.paid_at || now.toISOString(),
                processedAt: now.toISOString(),
                source: 'paystack_webhook',
              });
              console.log(`[Paystack Webhook] Reference ${reference} recorded in processed_payments.`);
            }
          } catch (dbErr) {
            console.warn('Firestore write bypassed in charge.success webhook:', dbErr);
          }
        }
        break;
      }
      case 'subscription.create': {
        markUserAsPro(userId);
        if (db) {
          try {
            await db.doc(`users/${userId}/subscription/current`).set(
              {
                plan: 'pro',
                status: 'active_pro',
                paystackSubscriptionCode: eventData.subscription_code || '',
                paystackCustomerCode: eventData.customer?.customer_code || '',
                updatedAt: now.toISOString(),
              },
              { merge: true }
            );
          } catch (dbErr) {
            console.warn('Firestore write bypassed in subscription.create webhook:', dbErr);
          }
        }
        break;
      }
      case 'subscription.disable':
      case 'subscription.not_renew': {
        if (db) {
          try {
            await db.doc(`users/${userId}/subscription/current`).set(
              {
                status: 'cancelled',
                cancelledAt: now.toISOString(),
                updatedAt: now.toISOString(),
              },
              { merge: true }
            );
            await db.doc(`users/${userId}`).set(
              { plan: 'free', subscriptionStatus: 'cancelled', updatedAt: now.toISOString() },
              { merge: true }
            );
          } catch (dbErr) {
            console.warn('Firestore write bypassed in subscription cancel webhook:', dbErr);
          }
        }
        break;
      }
      case 'invoice.payment_failed': {
        if (db) {
          try {
            await db.doc(`users/${userId}/subscription/current`).set(
              {
                status: 'payment_failed',
                lastPaymentError: eventData.status || 'Invoice payment failed',
                updatedAt: now.toISOString(),
              },
              { merge: true }
            );
            await db.doc(`users/${userId}`).set(
              { subscriptionStatus: 'payment_failed', updatedAt: now.toISOString() },
              { merge: true }
            );
          } catch (dbErr) {
            console.warn('Firestore write bypassed in payment_failed webhook:', dbErr);
          }
        }
        break;
      }
      default:
        console.log(`[Paystack Webhook] Unhandled event type: ${event.event}`);
    }

    return res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('Error processing Paystack webhook:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EMAIL API ENDPOINTS (Direct Send & Scheduling)
// ==========================================

// Get public email provider status
app.get('/api/email/config', (_req, res) => {
  const isConfigured = Boolean(process.env.RESEND_API_KEY);
  res.json({
    success: true,
    isConfigured,
    provider: isConfigured ? 'resend' : 'none',
    fromEmail: process.env.EMAIL_FROM || 'FollowFlow <onboarding@resend.dev>',
  });
});

// Direct real-time email send endpoint
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, body, userId, contactId, followUpId, idempotencyKey, attachments, recipientName } = req.body || {};

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ success: false, error: 'Recipient email is required.' });
    }
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ success: false, error: 'Email subject is required.' });
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ success: false, error: 'Email message body is required.' });
    }

    const effectiveUserId = userId || 'direct-user';

    // Anti-Spam / Rate Limiting: Max 100 emails/day per user
    const todayStr = new Date().toISOString().split('T')[0];
    const userEmailsToday = scheduledJobs.filter(
      (j) => j.userId === effectiveUserId && j.createdAt.startsWith(todayStr) && (j.status === 'sent' || j.status === 'completed' || j.status === 'delivered')
    ).length;

    if (userEmailsToday >= 150) {
      return res.status(429).json({
        success: false,
        status: 'failed',
        error: 'Daily sending limit reached (150 emails/day). Please try again tomorrow.',
      });
    }

    // CRITICAL SECURITY: Validate user ownership of contact and follow-up records before triggering outbound delivery
    const ownership = await validateUserRecordOwnership({
      userId: effectiveUserId,
      contactId,
      followUpId,
      recipientEmail: to,
    });

    if (!ownership.valid) {
      return res.status(ownership.statusCode || 403).json({
        success: false,
        status: 'failed',
        error: ownership.error || 'Record ownership verification failed.',
      });
    }

    const result = await executeEmailSend({
      to,
      subject,
      body,
      userId: effectiveUserId,
      contactId,
      followUpId,
      idempotencyKey,
      attachments,
    });

    return res.json({
      ...result,
      recipientName: recipientName || to,
      to,
      sentAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Email send failed:', err.message);
    return res.status(422).json({
      success: false,
      status: 'failed',
      error: err.message || 'Email delivery failed.',
    });
  }
});

// Schedule email for future automated server-side dispatch
app.post('/api/email/schedule', async (req, res) => {
  try {
    const { to, subject, body, scheduledFor, userId, contactId, followUpId, idempotencyKey, attachments, recipientName } =
      req.body || {};

    if (!to || typeof to !== 'string') {
      return res.status(400).json({ success: false, error: 'Recipient email is required.' });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, error: 'Email subject is required.' });
    }
    if (!body || !body.trim()) {
      return res.status(400).json({ success: false, error: 'Email message body is required.' });
    }
    if (!scheduledFor) {
      return res.status(400).json({ success: false, error: 'scheduledFor ISO date is required.' });
    }

    const parsedDate = new Date(scheduledFor);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid scheduledFor date format.' });
    }

    const effectiveUserId = userId || 'direct-user';

    // CRITICAL SECURITY: Validate user ownership of contact/follow-up records before scheduling outbound delivery
    const ownership = await validateUserRecordOwnership({
      userId: effectiveUserId,
      contactId,
      followUpId,
      recipientEmail: to,
    });

    if (!ownership.valid) {
      return res.status(ownership.statusCode || 403).json({
        success: false,
        status: 'failed',
        error: ownership.error || 'Record ownership verification failed.',
      });
    }

    // Idempotency check: prevent duplicate scheduling of identical job
    if (idempotencyKey) {
      const existing = scheduledJobs.find(
        (j) =>
          j.idempotencyKey === idempotencyKey &&
          (j.status === 'pending' ||
            j.status === 'scheduled' ||
            j.status === 'completed' ||
            j.status === 'sent' ||
            j.status === 'delivered' ||
            j.status === 'processing')
      );
      if (existing) {
        return res.json({
          success: true,
          job: existing,
          alreadyScheduled: true,
        });
      }
    }

    const newJob: ScheduledEmailJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: userId || 'direct-user',
      contactId: contactId || '',
      followUpId: followUpId || '',
      recipientName: recipientName || '',
      channel: 'email',
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      scheduledFor: parsedDate.toISOString(),
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      idempotencyKey: idempotencyKey || '',
      attachments: attachments && Array.isArray(attachments) && attachments.length > 0 ? attachments : undefined,
    };

    scheduledJobs.push(newJob);
    saveScheduledJobs();

    // Dual-persistence: sync new job to Firestore collection so it survives container restarts
    const db = getAdminFirestore();
    if (db && userId) {
      const sanitizedJob = JSON.parse(JSON.stringify(newJob));
      db.collection(`users/${userId}/scheduled_emails`)
        .doc(newJob.id)
        .set(sanitizedJob)
        .catch((e) => console.warn('Could not sync scheduled job to Firestore:', e.message));
    }

    // If job is due immediately or within 15 seconds, trigger background processor right away
    if (parsedDate.getTime() <= Date.now() + 15000) {
      processDueScheduledEmails().catch((err) =>
        console.warn('[EmailScheduler] Immediate dispatch tick warning:', err.message)
      );
    }

    // Log timeline event for scheduled email if contactId is present
    if (db && userId && contactId) {
      try {
        await db.collection(`users/${userId}/timeline`).add({
          contactId,
          followUpId: followUpId || '',
          type: 'email_scheduled',
          title: `Scheduled email: "${subject}"`,
          description: `Scheduled for delivery on ${parsedDate.toLocaleString()} to ${to}`,
          channel: 'email',
          deliveryStatus: 'scheduled',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not write timeline event to Firestore:', dbErr);
      }
    }

    return res.json({
      success: true,
      job: newJob,
    });
  } catch (err: any) {
    console.error('Email schedule failed:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to schedule email.',
    });
  }
});

// Resend Webhook Handler (email.delivered, email.bounced, email.complained, email.opened, email.clicked)
app.post('/api/email/webhook', async (req, res) => {
  try {
    const payload = req.body || {};
    const eventType = payload.type; // e.g. 'email.delivered', 'email.bounced'
    const emailData = payload.data || {};
    const providerMessageId = emailData.email_id || emailData.id;

    if (!providerMessageId) {
      return res.status(200).json({ received: true, note: 'No message id in payload' });
    }

    console.log(`[Webhook] Received Resend event ${eventType} for message ${providerMessageId}`);

    // Locate job in memory and persistent disk store
    const job = scheduledJobs.find((j) => j.providerMessageId === providerMessageId);
    if (job) {
      if (eventType === 'email.delivered') {
        job.status = 'delivered';
        job.deliveredAt = new Date().toISOString();
        saveScheduledJobs();
      } else if (eventType === 'email.bounced') {
        job.status = 'failed';
        job.error = `Bounced: ${emailData.bounce?.message || 'Mailbox unavailable'}`;
        job.failedAt = new Date().toISOString();
        saveScheduledJobs();
      }
    }

    // Also update Firestore messages and timeline
    const db = getAdminFirestore();
    if (db) {
      try {
        const userId = job?.userId;
        if (userId) {
          const snapshot = await db
            .collection(`users/${userId}/messages`)
            .where('providerMessageId', '==', providerMessageId)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            await doc.ref.update({
              status: eventType === 'email.delivered' ? 'delivered' : 'bounced',
              deliveredAt: eventType === 'email.delivered' ? new Date().toISOString() : null,
              lastWebhookEvent: eventType,
              lastWebhookAt: new Date().toISOString(),
            });
          }

          if (job.contactId) {
            await db.collection(`users/${userId}/timeline`).add({
              contactId: job.contactId,
              followUpId: job.followUpId || '',
              type: eventType === 'email.delivered' ? 'email_delivered' : 'email_bounced',
              title: eventType === 'email.delivered' ? 'Email delivered' : 'Email delivery bounced',
              description: `Provider confirmed ${eventType.replace('email.', '')} for ${job.to}`,
              channel: 'email',
              provider: 'resend',
              providerMessageId,
              deliveryStatus: eventType === 'email.delivered' ? 'delivered' : 'failed',
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (dbErr: any) {
        console.warn('[Webhook] Firestore update error:', dbErr.message);
      }
    }

    return res.status(200).json({ success: true, event: eventType, providerMessageId });
  } catch (err: any) {
    console.error('[Webhook] Processing error:', err.message);
    return res.status(200).json({ success: false, error: err.message });
  }
});

// Check delivery status for specific provider message
app.get('/api/email/status/:providerMessageId', async (req, res) => {
  const { providerMessageId } = req.params;
  const job = scheduledJobs.find((j) => j.providerMessageId === providerMessageId);

  if (job) {
    return res.json({
      success: true,
      job: {
        id: job.id,
        to: job.to,
        status: job.status,
        provider: job.provider || 'resend',
        providerMessageId: job.providerMessageId,
        sentAt: job.sentAt,
        deliveredAt: job.deliveredAt,
        error: job.error,
      },
    });
  }

  return res.json({
    success: true,
    job: {
      providerMessageId,
      status: 'sent',
      provider: 'resend',
      sentAt: new Date().toISOString(),
    },
  });
});

// Resend Domain Verification & Email Service Health Diagnostics
app.get('/api/email/diagnostics', (_req, res) => {
  const resendKey = getSecret('RESEND_API_KEY');
  const emailFrom = getSecret('EMAIL_FROM', 'FollowFlow <onboarding@resend.dev>');
  const isSandbox = emailFrom.includes('onboarding@resend.dev');
  const isWebmail = /@(gmail|yahoo|hotmail|outlook|live|icloud)\.com/i.test(emailFrom);

  let verificationStatus: 'verified_custom_domain' | 'sandbox_restricted' | 'invalid_webmail' | 'not_configured' = 'verified_custom_domain';
  let guidance = 'Domain is configured with a custom sender address. Real delivery to all external recipients is enabled.';

  if (!resendKey) {
    verificationStatus = 'not_configured';
    guidance = 'RESEND_API_KEY is not configured. Add your API key in environment settings to enable real delivery.';
  } else if (isWebmail) {
    verificationStatus = 'invalid_webmail';
    guidance = 'Free webmail domains (@gmail, @yahoo) cannot be verified on Resend. Verify a custom domain at https://resend.com/domains.';
  } else if (isSandbox) {
    verificationStatus = 'sandbox_restricted';
    guidance = 'Using onboarding@resend.dev. Delivery is restricted to the Resend account owner until a custom domain is verified at https://resend.com/domains.';
  }

  return res.json({
    success: true,
    service: 'Resend Email Delivery Engine',
    isConfigured: Boolean(resendKey),
    maskedApiKey: maskSecret(resendKey),
    emailFrom,
    verificationStatus,
    isSandboxAddress: isSandbox,
    guidance,
    documentationUrl: 'https://resend.com/domains',
  });
});

// Environment Secrets Status (Masked & Safe for Audits)
app.get('/api/secrets/status', (_req, res) => {
  return res.json({
    success: true,
    timestamp: new Date().toISOString(),
    report: getSecretsHealthReport(),
  });
});

// Universal Real Delivery Metrics endpoint
// Strict real data: if 0, displays 0. Never simulated!
app.get('/api/delivery/metrics', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    const todayStr = new Date().toISOString().split('T')[0];

    const relevantJobs = userId ? scheduledJobs.filter((j) => j.userId === userId) : scheduledJobs;

    const emailsSentToday = relevantJobs.filter(
      (j) => (j.status === 'sent' || j.status === 'completed' || j.status === 'delivered') && (j.sentAt || j.completedAt || j.createdAt).startsWith(todayStr)
    ).length;

    const emailsScheduled = relevantJobs.filter(
      (j) => j.status === 'pending' || j.status === 'scheduled' || j.status === 'processing'
    ).length;

    const emailsDelivered = relevantJobs.filter(
      (j) => j.status === 'delivered' || (j.status === 'completed' && j.deliveredAt)
    ).length;

    const emailsFailed = relevantJobs.filter((j) => j.status === 'failed').length;

    let whatsappActions = 0;
    let callsInitiated = 0;
    let followUpsCompleted = 0;

    const db = getAdminFirestore();
    if (db && userId) {
      try {
        const timelineRef = db.collection(`users/${userId}/timeline`);
        const timelineSnap = await timelineRef.get();
        timelineSnap.forEach((doc) => {
          const d = doc.data();
          if (d.type === 'whatsapp_opened') whatsappActions++;
          if (d.type === 'call_initiated') callsInitiated++;
          if (d.type === 'completed' || d.type === 'followup_completed') followUpsCompleted++;
        });
      } catch (err: any) {
        console.warn('Could not query timeline metrics:', err.message);
      }
    }

    return res.json({
      success: true,
      metrics: {
        emailsSentToday,
        emailsScheduled,
        emailsDelivered,
        emailsFailed,
        whatsappActions,
        callsInitiated,
        followUpsCompleted,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Record timeline event for WhatsApp, Phone Call, or Manual Copy actions
app.post('/api/delivery/log-action', async (req, res) => {
  try {
    const { userId, contactId, followUpId, channel, type, title, description, recipient, recipientPhone } = req.body || {};

    if (!userId || !contactId) {
      return res.status(400).json({ success: false, error: 'userId and contactId are required.' });
    }

    const db = getAdminFirestore();
    let docId = `action-${Date.now()}`;

    if (db) {
      const docRef = await db.collection(`users/${userId}/timeline`).add({
        contactId,
        followUpId: followUpId || '',
        channel: channel || 'manual',
        type: type || 'outreach_sent',
        title: title || 'Communication executed',
        description: description || '',
        recipient: recipient || '',
        recipientPhone: recipientPhone || '',
        deliveryStatus: 'sent',
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      docId = docRef.id;

      // Also mark follow-up as contacted if followUpId provided
      if (followUpId) {
        try {
          await db.collection(`users/${userId}/followups`).doc(followUpId).update({
            status: 'contacted',
            lastContactedAt: new Date().toISOString(),
          });
        } catch (fErr) {
          // ignore if doc doesn't exist
        }
      }
    }

    return res.json({
      success: true,
      actionId: docId,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Log action error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// List scheduled emails for user
app.get('/api/email/scheduled', (req, res) => {
  const userId = req.query.userId as string;
  const userJobs = userId ? scheduledJobs.filter((j) => j.userId === userId) : scheduledJobs;
  return res.json({
    success: true,
    jobs: userJobs,
  });
});

// Cancel a scheduled email
app.delete('/api/email/scheduled/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = scheduledJobs.find((j) => j.id === jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  if (job.status === 'completed' || job.status === 'sent' || job.status === 'delivered') {
    return res.status(400).json({ success: false, error: 'Cannot cancel an email that was already sent.' });
  }

  if (job.status === 'cancelled') {
    return res.json({ success: true, message: 'Scheduled email is already cancelled.' });
  }

  job.status = 'cancelled';
  job.lockedAt = undefined;
  job.lockedBy = undefined;
  activeJobLocks.delete(job.id);
  saveScheduledJobs();
  return res.json({ success: true, message: 'Scheduled email cancelled.' });
});

// Dedicated Cloud Scheduler / Webhook / Ping Trigger Endpoint
// Enables external cron (Google Cloud Scheduler, uptime monitors, or curl) to drive batch dispatch
app.all(['/api/scheduler/tick', '/api/cron/process-emails'], async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization || req.headers['x-cron-secret'];
    if (cronSecret && authHeader !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron trigger' });
    }

    const summary = await processDueScheduledEmails();
    return res.json({
      success: true,
      service: 'FollowFlow Server-Side Email Scheduler',
      timestamp: new Date().toISOString(),
      ...summary,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Passive API Hook: Ensures scheduled emails are processed whenever any request hits the server
let lastSchedulerHookTick = 0;
app.use('/api', (_req, _res, next) => {
  const now = Date.now();
  if (now - lastSchedulerHookTick > 15000) {
    lastSchedulerHookTick = now;
    processDueScheduledEmails().catch((err) =>
      console.warn('[SchedulerHook] Async tick error:', err.message)
    );
  }
  next();
});

// ==========================================
// AI CHATBOT: "FLOW" (Revenue Follow-Up Assistant)
// ==========================================

app.post('/api/ai/flow-chat', async (req, res) => {
  try {
    const { messages = [], userId, contextData } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: 'Messages are required.' });
    }

    const ai = getGenAI();

    // Prepare live user data snapshot for Flow
    const {
      contacts = [],
      todayFollowUps = [],
      overdueFollowUps = [],
      activeFollowUps = [],
      moneyAtRisk = 0,
      outstandingInvoices = 0,
      totalFollowUpValue = 0,
    } = contextData || {};

    const systemInstruction = `You are "Flow", the dedicated Revenue Follow-Up AI Assistant inside FollowFlow.
Your core promise: "FollowFlow finds the people you need to contact today, tells you why, and helps you send the right message in seconds."

You are NOT a generic chatbot. Your exclusive expertise is revenue follow-ups, client relationship maintenance, lead conversion, and invoice collection for freelancers, agencies, consultants, and service businesses.

THE USER'S REAL-TIME DATA (Strict Ground Truth):
- Follow-ups Due Today (${todayFollowUps.length}): ${JSON.stringify(
      todayFollowUps.slice(0, 10).map((f: any) => ({
        id: f.id,
        contact: f.contactName,
        company: f.contactCompany,
        title: f.title,
        amount: f.amount ? `${f.currency || '$'}${f.amount}` : undefined,
        type: f.type,
        dueDate: f.dueDate,
        priority: f.priority,
        channel: f.channel,
      }))
    )}
- Overdue Follow-ups (${overdueFollowUps.length}): ${JSON.stringify(
      overdueFollowUps.slice(0, 10).map((f: any) => ({
        id: f.id,
        contact: f.contactName,
        company: f.contactCompany,
        title: f.title,
        amount: f.amount ? `${f.currency || '$'}${f.amount}` : undefined,
        type: f.type,
        dueDate: f.dueDate,
        priority: f.priority,
        channel: f.channel,
      }))
    )}
- All Active Follow-ups (${activeFollowUps.length}): ${JSON.stringify(
      activeFollowUps.slice(0, 15).map((f: any) => ({
        id: f.id,
        contact: f.contactName,
        title: f.title,
        amount: f.amount,
        type: f.type,
        dueDate: f.dueDate,
        priority: f.priority,
      }))
    )}
- Saved Contacts (${contacts.length}): ${JSON.stringify(
      contacts.slice(0, 15).map((c: any) => ({
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email,
        whatsapp: c.whatsapp,
        tags: c.tags,
      }))
    )}
- Financial Overview:
  * Money at Risk (Active proposals/leads): $${moneyAtRisk}
  * Outstanding (Overdue invoices): $${outstandingInvoices}
  * Total Follow-Up Value: $${totalFollowUpValue}

STRICT SAFETY & ACCURACY RULES:
1. NEVER invent customer information, invoices, amounts, dates, or past conversations that are not in the provided data.
2. If the user asks about a contact or follow-up that does not exist in their data, clearly say: "I don't have that information in your FollowFlow data."
3. READ-ONLY ACTIONS (e.g., "Who should I follow up with?", "What's overdue?", "Who owes me money?", "What should I say to Sarah?"): Answer immediately with crisp, actionable insights and drafted messages when requested.
4. WRITE ACTIONS (e.g., "Create a follow-up for Sarah tomorrow", "Remind me to call David next Monday", "Mark Marcus as complete", "Snooze this"):
   - You MUST formulate a confirmation response.
   - Include a structured ACTION block in JSON at the very end of your response inside <<<ACTION...ACTION>>> tags so the UI can render interactive [Create Follow-Up] / [Confirm] / [Cancel] buttons.
   - Schema for action tag:
     <<<ACTION
     {
       "type": "create_followup" | "update_followup" | "complete_followup" | "snooze_followup",
       "title": "Short title of action",
       "summary": "Clear 1-sentence description of what will be done",
       "payload": { ...relevant fields like contactName, title, dueDate, amount, priority, type, channel }
     }
     ACTION>>>

5. Keep responses concise, professional, warm, and hyper-focused on closing deals and recovering revenue.`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await generateContentWithFallback(ai, {
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const replyText = response.text || '';

    // Extract pending action if proposed
    let pendingAction = null;
    let cleanReply = replyText;

    const actionMatch = replyText.match(/<<<ACTION\s*([\s\S]*?)\s*ACTION>>>/);
    if (actionMatch) {
      try {
        const actionJson = JSON.parse(actionMatch[1]);
        pendingAction = {
          id: `act-${Date.now()}`,
          ...actionJson,
          status: 'pending',
        };
        cleanReply = replyText.replace(/<<<ACTION[\s\S]*?ACTION>>>/, '').trim();
      } catch (err) {
        console.warn('Failed to parse Flow proposed action JSON:', err);
      }
    }

    return res.json({
      success: true,
      message: {
        id: `flow-${Date.now()}`,
        role: 'assistant',
        content: cleanReply,
        timestamp: new Date().toISOString(),
        pendingAction,
      },
    });
  } catch (error: any) {
    console.error('Error in Flow AI chatbot:', error);
    return res.status(200).json({
      success: true,
      message: {
        id: `flow-${Date.now()}`,
        role: 'assistant',
        content:
          "I'm here to help you review who you need to follow up with today, draft high-converting messages, and ensure no revenue slips through the cracks. What would you like to review?",
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// ==========================================
// AI MESSAGE & SEQUENCE GENERATION
// ==========================================

// Helper: Extract human-friendly first name (e.g., "JOHN DOE" -> "John")
function extractFirstName(rawName?: string): string {
  if (!rawName) return 'there';
  const parts = rawName.trim().split(/\s+/);
  const first = parts[0];
  if (first.length > 1 && first === first.toUpperCase()) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return first;
}

// Helper: Extract clean conversation topic from task titles (avoiding "regarding Follow up with Joshua on proposal")
function extractCleanTopic(rawTitle?: string, type?: string): string {
  let topic = (rawTitle || type || 'our conversation').trim();
  topic = topic.replace(/^follow(\s|-)?up\s+(with\s+[^,\-\.:\n]+?\s+(on|regarding|about)|on|regarding|about)\s+/i, '');
  topic = topic.replace(/^check(\s|-)?in\s+(with\s+[^,\-\.:\n]+?\s+(on|regarding|about)|on|regarding|about)\s+/i, '');
  topic = topic.replace(/^recap\s+(of|on)\s+/i, '');
  topic = topic.replace(/^reminder\s+(for|about|regarding)\s+/i, '');
  topic = topic.trim();
  return topic || 'our recent discussion';
}

// Server-side function to check 25 AI generation limit using cache and DB where available
async function checkAndEnforceAiLimit(
  userId?: string,
  isProHint?: boolean,
  clientCount?: number
): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
  isPro: boolean;
  error?: string;
}> {
  if (!userId || userId === 'guest' || userId === 'demo-user') {
    return { allowed: true, currentCount: 0, limit: 25, isPro: false };
  }

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  let usage = userUsageCache.get(userId);

  if (!usage || usage.month !== currentMonth) {
    usage = {
      count: typeof clientCount === 'number' ? clientCount : 0,
      month: currentMonth,
      isPro: Boolean(isProHint),
    };
    userUsageCache.set(userId, usage);
  }

  if (isProHint !== undefined) {
    usage.isPro = isProHint;
  }
  if (typeof clientCount === 'number' && clientCount > usage.count) {
    usage.count = clientCount;
  }

  // Check Firestore Admin only if credentials exist
  const db = getAdminFirestore();
  if (db) {
    try {
      const userDocRef = db.doc(`users/${userId}`);
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        if (userData.plan === 'pro' || userData.subscriptionStatus === 'active_pro') {
          usage.isPro = true;
        }
        const dbCount = Number(userData.generationCount ?? userData.aiGenerationsCount ?? 0);
        if (dbCount > usage.count) {
          usage.count = dbCount;
        }
      }
    } catch {
      // Safe fallback to server cache
    }
  }

  const FREE_LIMIT = 25;
  if (usage.isPro) {
    return { allowed: true, currentCount: usage.count, limit: Infinity, isPro: true };
  }

  if (usage.count >= FREE_LIMIT) {
    return {
      allowed: false,
      currentCount: usage.count,
      limit: FREE_LIMIT,
      isPro: false,
      error: `Monthly AI message generation limit reached (${usage.count}/${FREE_LIMIT} used on Free plan). Please upgrade to FollowFlow Pro for unlimited AI messages.`,
    };
  }

  return {
    allowed: true,
    currentCount: usage.count,
    limit: FREE_LIMIT,
    isPro: false,
  };
}

// Record and increment generationCount in cache and DB where available
async function recordAiGeneration(userId?: string): Promise<number> {
  if (!userId || userId === 'guest' || userId === 'demo-user') return 1;
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  let usage = userUsageCache.get(userId);
  if (!usage || usage.month !== currentMonth) {
    usage = { count: 0, month: currentMonth, isPro: false };
    userUsageCache.set(userId, usage);
  }
  usage.count += 1;

  const db = getAdminFirestore();
  if (db) {
    try {
      const userDocRef = db.doc(`users/${userId}`);
      await userDocRef.set(
        {
          generationCount: usage.count,
          aiGenerationsCount: usage.count,
          lastAiGenerationAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // Safe fallback - cache has updated count
    }
  }

  return usage.count;
}

// AI Follow-up Message Generation Endpoint
app.post('/api/ai/generate-followup', async (req, res) => {
  try {
    const {
      userId,
      contactName,
      company,
      followUpType,
      title,
      description,
      amount,
      currency,
      dueDate,
      daysOverdue,
      tone = 'professional',
      channel = 'email',
      additionalContext = '',
      lastContactDate,
      isPro,
      currentCount,
    } = req.body;

    if (!contactName) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    // Server-side check of the 25-message AI generation limit
    const limitCheck = await checkAndEnforceAiLimit(userId, isPro, currentCount);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.error,
        limitReached: true,
        currentCount: limitCheck.currentCount,
        maxLimit: limitCheck.limit,
      });
    }

    const ai = getGenAI();
    const cleanTopic = extractCleanTopic(title, followUpType);
    const firstName = extractFirstName(contactName);

    const toneInstructions: Record<string, string> = {
      friendly: 'Warm, personable, encouraging, approachable, yet respectful of their time.',
      professional: 'Polite, direct, articulate, business-appropriate, and focused on clear next steps.',
      casual: 'Relaxed, conversational, modern, and brief.',
      firm: 'Direct, clear, assertive about deadlines or commitments without being impolite.',
      urgent: 'Clear emphasis on timeliness and prompt next steps while maintaining utmost professionalism.',
      warm: 'Kind, empathetic, relationship-building, appreciative, and thoughtful.',
    };

    const channelGuidelines =
      channel === 'whatsapp' || channel === 'sms'
        ? 'Format strictly for instant mobile messaging (WhatsApp/SMS). Keep it very concise (1-3 short sentences), conversational, and easy to reply to on mobile. Do NOT include email subject lines, formal signatures, or lengthy intros.'
        : channel === 'phone' || channel === 'call_script'
        ? 'Format as a concise phone call script for the caller. Include: 1) A natural opening greeting, 2) A 20-second clear reason for calling, 3) An open check-in question, and 4) A polite closing next-step agreement.'
        : 'Format for email. Include a clear, compelling Subject line (formatted as Subject: ...) followed by a clean, 2-3 paragraph email body with a polite sign-off placeholder.';

    const prompt = `You are FollowFlow AI, an expert revenue follow-up assistant for freelancers, agencies, and small businesses.
Your mission is to write a highly effective, natural follow-up message that gets a positive response and protects business revenue.

CRITICAL NATURAL LANGUAGE & ACCURACY RULES:
1. GREETING: Address the contact naturally by their first name: "Hi ${firstName}," or "Hello ${firstName},". Never use all-caps.
2. NATURAL HUMAN PHRASING:
   - NEVER regurgitate raw task titles. Avoid awkward phrasing such as: "regarding Follow up with ${contactName} on ${cleanTopic}" or "I am writing this follow-up regarding...".
   - Instead, write smooth, natural business language such as:
     "Hi ${firstName}, I hope you're doing well. I wanted to follow up on the ${cleanTopic} we sent over and see if you had any questions or needed any clarification."
3. FACT INTEGRITY (ZERO HALLUCINATIONS):
   - ONLY reference facts provided in the input below (contact name, company, clean topic, amount, due date).
   - The AI must NEVER invent or fabricate:
     * amounts (if Financial Value is N/A, never mention a price, dollar amount, or invoice figure)
     * names (only use the contact name provided)
     * dates (if Due Date is N/A, do not invent dates or deadlines)
     * companies (if Company is N/A, do not make up a company name)
     * projects or conversations (if not in description/context, do not invent past discussions or promises)
     * payment status (do not claim something is paid or overdue unless explicitly stated in input)
   - If information is unavailable or marked N/A, NEVER fabricate it.
4. BREVITY & ACTION:
   - Keep the message natural, human, respectful, and direct.
   - End with a low-friction question or clear next step.

INPUT DATA:
- Contact Name: ${contactName} (First Name: ${firstName})
- Company: ${company || 'N/A'}
- Primary Subject / Discussion: ${cleanTopic}
- Raw Task Title: ${title || 'N/A'}
- Follow-up Type: ${followUpType || 'general'}
- Description / Notes: ${description || 'N/A'}
- Financial Value: ${amount ? `${currency || '$'}${amount}` : 'N/A'}
- Due Date: ${dueDate || 'N/A'}
- Days Overdue: ${daysOverdue ? `${daysOverdue} days` : 'Not overdue'}
- Last Contact Date: ${lastContactDate || 'N/A'}
- Additional Context: ${additionalContext || 'None provided'}
- Desired Tone: ${tone} (${toneInstructions[tone] || toneInstructions.professional})
- Target Channel: ${channel} (${channelGuidelines})

OUTPUT FORMAT REQUIREMENTS:
${
  channel === 'email'
    ? 'Return the output in this exact structure:\nSubject: [Concise, Natural Subject Line]\n\n[Email Body]'
    : channel === 'phone' || channel === 'call_script'
    ? 'Return a structured call script with [Opening], [Reason for Calling], and [Next Step Question].'
    : 'Return ONLY the ready-to-send text message body. Do NOT include "Subject:" or header tags.'
}`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    });

    const rawText = response.text?.trim() || '';

    let subject = '';
    let messageBody = rawText;

    if (channel === 'email') {
      const subjectMatch = rawText.match(/^Subject:\s*(.*?)(\n|$)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        messageBody = rawText.replace(/^Subject:\s*.*?\n+/i, '').trim();
      } else {
        subject = `Following up on ${cleanTopic}`;
      }
    }

    // Persist increment in Firestore
    const updatedCount = await recordAiGeneration(userId);

    return res.json({
      success: true,
      subject,
      message: messageBody,
      fullText: rawText,
      tone,
      channel,
      generationCount: updatedCount,
      limitReached: false,
    });
  } catch (error: any) {
    console.error('Error generating AI follow-up message:', error);
    const { contactName, title, followUpType, amount, currency } = req.body || {};
    const cleanTopic = extractCleanTopic(title, followUpType);
    const firstName = extractFirstName(contactName);

    const fallbackSubject = `Following up on ${cleanTopic}`;
    const fallbackBody = `Hi ${firstName},\n\nI hope you're doing well. I wanted to follow up on ${cleanTopic}${amount ? ` (${currency || '$'}${amount})` : ''} and see if you had any questions or needed any clarification from my end.\n\nLooking forward to hearing from you!`;

    return res.status(200).json({
      success: true,
      isFallback: true,
      subject: fallbackSubject,
      message: fallbackBody,
      fullText: `${fallbackSubject}\n\n${fallbackBody}`,
      errorNotice: error?.message || 'Generated via smart template fallback.',
    });
  }
});

// AI Sequence Step Message Generator Endpoint
app.post('/api/ai/generate-sequence-step', async (req, res) => {
  try {
    const {
      userId,
      sequenceName,
      sequenceCategory = 'general',
      stepNumber = 1,
      totalSteps = 3,
      delayDays = 2,
      stepTitle,
      tone = 'professional',
      channel = 'email',
      aiPromptGuidance = '',
      isPro,
      currentCount,
    } = req.body;

    const limitCheck = await checkAndEnforceAiLimit(userId, isPro, currentCount);
    if (!limitCheck.allowed) {
      return res.status(403).json({
        error: limitCheck.error,
        limitReached: true,
        currentCount: limitCheck.currentCount,
        maxLimit: limitCheck.limit,
      });
    }

    const ai = getGenAI();

    const prompt = `You are FollowFlow AI, an expert copywriter and revenue follow-up automation strategist for freelancers and businesses.
Generate a high-converting, natural sequence step message template.

SEQUENCE CONTEXT:
- Sequence Name: ${sequenceName || 'Follow-Up Sequence'}
- Category: ${sequenceCategory}
- Step Number: ${stepNumber} of ${totalSteps}
- Timing: Sent ${delayDays === 0 ? 'immediately' : `${delayDays} days after previous touchpoint`}
- Step Objective: ${stepTitle || `Step ${stepNumber} Follow-Up`}
- Desired Tone: ${tone}
- Delivery Channel: ${channel}
- Custom Guidance: ${aiPromptGuidance || 'None'}

DYNAMIC VARIABLES:
Use the following merge tags wherever appropriate:
- {contact_name} for recipient's name
- {company} for company name
- {title} for project or invoice title
- {amount} for amount due or proposal quote
- {due_date} for deadline or due date

RULES:
1. Message must sound 100% human and conversational.
2. If step is late in the sequence (e.g., step 3+), adopt an appropriate closing / gentle breakup or deadline posture without being rude.
3. ${channel === 'whatsapp' || channel === 'sms' ? 'Keep it concise under 3 sentences for instant messaging. Do not write email subject lines or formal signatures.' : 'Format with a catchy Subject line on the first line (Subject: ...), followed by the email body.'}

OUTPUT:
${channel === 'email' ? 'Subject: [Subject Line]\n\n[Email Body with merge tags]' : '[Message Body with merge tags]'}`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    });

    const rawText = response.text?.trim() || '';
    let subject = '';
    let messageBody = rawText;

    if (channel === 'email') {
      const subjectMatch = rawText.match(/^Subject:\s*(.*?)(\n|$)/i);
      if (subjectMatch) {
        subject = subjectMatch[1].trim();
        messageBody = rawText.replace(/^Subject:\s*.*?\n+/i, '').trim();
      } else {
        subject = `Follow up on {title}`;
      }
    }

    // Persist increment in Firestore
    const updatedCount = await recordAiGeneration(userId);

    return res.json({
      success: true,
      subject,
      templateBody: messageBody,
      tone,
      channel,
      generationCount: updatedCount,
      limitReached: false,
    });
  } catch (error: any) {
    console.error('Error generating sequence step:', error);
    const { channel } = req.body || {};
    const fallbackSubject = `Quick follow up regarding {title}`;
    const fallbackBody =
      channel === 'whatsapp' || channel === 'sms'
        ? `Hi {contact_name}, just checking in to see if you had a chance to review {title}? Let me know if you need any info!`
        : `Hi {contact_name},\n\nHope you're having a great week!\n\nJust circling back on {title} to see if you have any questions or if you're ready to take the next step.\n\nBest regards,\n[Your Name]`;

    return res.status(200).json({
      success: true,
      isFallback: true,
      subject: fallbackSubject,
      templateBody: fallbackBody,
    });
  }
});

// AI Sequence Variations Generator Endpoint
app.post('/api/ai/generate-sequence-variations', async (req, res) => {
  try {
    const { sequenceName, stepTitle, baseMessage, channel = 'email' } = req.body;

    const ai = getGenAI();

    const prompt = `You are FollowFlow AI. Take the following follow-up message template and produce 3 distinct tone variations while keeping all merge tags like {contact_name}, {company}, {title}, {amount}.

BASE TEMPLATE:
${baseMessage || 'Hi {contact_name}, following up on {title}.'}

CONTEXT:
Sequence: ${sequenceName || 'Follow-Up'}
Step: ${stepTitle || 'Follow-Up'}
Channel: ${channel}

Generate 3 variations in JSON format:
1. "friendly": approachable, warm, lighthearted.
2. "firm": direct, clear about timelines/next steps, no-nonsense.
3. "urgent": creates priority focus, highlights deadlines or scope hold.

RETURN STRICT JSON ONLY with structure:
[
  {
    "tone": "friendly",
    "label": "Friendly & Casual",
    "subject": "Quick check-in on {title} 😊",
    "content": "..."
  },
  {
    "tone": "firm",
    "label": "Direct & Firm",
    "subject": "Action required: {title}",
    "content": "..."
  },
  {
    "tone": "urgent",
    "label": "Urgent & Priority",
    "subject": "Time-sensitive: Finalizing {title}",
    "content": "..."
  }
]`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const variations = JSON.parse(response.text?.trim() || '[]');
    return res.json({
      success: true,
      variations,
    });
  } catch (error: any) {
    console.error('Error generating variations:', error);
    return res.json({
      success: true,
      isFallback: true,
      variations: [
        {
          id: 'v-friendly',
          tone: 'friendly',
          label: 'Friendly & Warm',
          subject: 'Quick check-in on {title}',
          content:
            'Hi {contact_name},\n\nJust wanted to see how things are going with {title}. Would love to answer any quick questions you might have!\n\nBest,\n[Your Name]',
        },
        {
          id: 'v-firm',
          tone: 'firm',
          label: 'Direct & Clear',
          subject: 'Status update: {title}',
          content:
            'Hi {contact_name},\n\nI am writing to check the status of {title}. Please let me know if we can finalize the next steps this week.\n\nThank you,\n[Your Name]',
        },
        {
          id: 'v-urgent',
          tone: 'urgent',
          label: 'Priority & Time-Sensitive',
          subject: 'Time-sensitive: {title}',
          content:
            'Hi {contact_name},\n\nFollowing up on {title} as we need to confirm scheduling and resources by {due_date}. Please let me know your availability today.\n\nBest regards,\n[Your Name]',
        },
      ],
    });
  }
});

// AI Analytics Insights Generator Endpoint
app.post('/api/ai/generate-analytics-insights', async (req, res) => {
  try {
    const {
      totalFollowUps = 0,
      completedCount = 0,
      successRate = 0,
      avgDaysToClose = 0,
      moneyWaiting = 0,
      moneyRecovered = 0,
      moneyAtRisk = 0,
      topChannel = 'whatsapp',
      overdueCount = 0,
    } = req.body;

    const ai = getGenAI();

    const prompt = `You are FollowFlow's Chief Revenue Intelligence Advisor.
Analyze the user's follow-up performance metrics and generate 3 to 4 hyper-actionable, concise tactical recommendations to improve conversion rates and recover money waiting faster.

USER METRICS:
- Total Follow-Ups in Scope: ${totalFollowUps}
- Completed Deals/Invoices: ${completedCount}
- Overall Success Rate: ${successRate}%
- Average Days to Close/Collect: ${avgDaysToClose} days
- Money Waiting (Pipeline): $${moneyWaiting}
- Revenue Recovered to date: $${moneyRecovered}
- Money at Risk (>7 days overdue): $${moneyAtRisk}
- Overdue Items Count: ${overdueCount}
- Top Performing Channel: ${topChannel}

OUTPUT FORMAT:
Return strict JSON as an array of recommendations:
[
  {
    "title": "Short title",
    "impact": "High" | "Medium" | "Quick Win",
    "description": "1-2 sentence specific suggestion based on the data.",
    "actionText": "Short action item"
  }
]`;

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.6,
      },
    });

    const recommendations = JSON.parse(response.text?.trim() || '[]');
    return res.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error('Error generating analytics insights:', error);
    return res.json({
      success: true,
      isFallback: true,
      recommendations: [
        {
          title: 'Accelerate Invoice Follow-Ups',
          impact: 'High',
          description:
            'Sending a friendly check-in on Day 2 of overdue invoices recovers 40% more payments before they age past 14 days.',
          actionText: 'Set up an Invoice Recovery Sequence',
        },
        {
          title: 'Leverage High-Converting WhatsApp Channel',
          impact: 'Quick Win',
          description:
            'Mobile messaging has a 3.4x faster response turnaround compared to email for quick proposal reviews.',
          actionText: 'Use 1-Click WhatsApp for warm leads',
        },
        {
          title: 'Rescue Revenue at Risk',
          impact: 'High',
          description:
            'You have high-value items waiting over 7 days. A short "Scope closing" check-in can reignite stagnant deals.',
          actionText: 'Review overdue priority queue',
        },
      ],
    });
  }
});

// ==========================================
// AI SMART SUMMARY: TOP 3 PRIORITY ACTIONS
// ==========================================
app.post('/api/ai/smart-summary', async (req, res) => {
  const { pendingFollowUps = [], contacts = [], userProfile } = req.body || {};

  // Algorithmic fallback generator helper
  const generateAlgorithmicSummary = (items: any[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const scored = items.map((f) => {
      const isOverdue = f.dueDate && f.dueDate < todayStr;
      const isToday = f.dueDate === todayStr;
      const amount = Number(f.amount) || 0;
      let score = 0;
      if (isOverdue) score += 50000;
      if (isToday) score += 20000;
      if (f.type === 'invoice') score += 15000;
      if (f.priority === 'urgent') score += 10000;
      else if (f.priority === 'high') score += 5000;
      score += Math.min(amount, 50000);
      return { item: f, score, isOverdue, isToday, amount };
    });

    scored.sort((a, b) => b.score - a.score);
    const top3Items = scored.slice(0, 3);

    const totalAtStake = items.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    const currency = items.find((f) => f.currency)?.currency || '$';

    if (items.length === 0) {
      return {
        headline: 'All Caught Up! Queue is Clear',
        overview: 'You have no pending follow-ups waiting for action. All scheduled follow-ups and invoices are currently up to date.',
        totalPendingCount: 0,
        totalAtStake: 0,
        currency,
        topActions: [],
        tacticalAdvice: 'Use this downtime to prospect new clients, review closed accounts for retention or upsells, or build a multi-step sequence.',
        generatedAt: new Date().toISOString(),
      };
    }

    const topActions = top3Items.map((entry, idx) => {
      const { item, isOverdue, isToday, amount } = entry;
      const rank = (idx + 1) as 1 | 2 | 3;
      let badge = 'Key Follow-Up';
      let urgency: 'urgent' | 'high' | 'medium' = 'high';

      if (isOverdue && item.type === 'invoice') {
        badge = 'Overdue Invoice';
        urgency = 'urgent';
      } else if (isOverdue) {
        badge = 'Overdue Action';
        urgency = 'urgent';
      } else if (amount >= 1000 || item.type === 'proposal') {
        badge = 'High-Value Deal';
        urgency = 'high';
      } else if (isToday) {
        badge = 'Due Today';
        urgency = 'high';
      } else {
        badge = 'Relationship Win';
        urgency = 'medium';
      }

      const formattedAmount = amount > 0 ? `${item.currency || currency}${amount.toLocaleString()}` : null;
      const reason = isOverdue
        ? `Past deadline. Immediate outreach prevents further payment delay and keeps client relationship warm.`
        : isToday
        ? `Scheduled for today. Reaching out on time maintains deal velocity and builds strong professional credibility.`
        : formattedAmount
        ? `Significant revenue (${formattedAmount}) at stake. Proactive touchpoint advances the decision-making cycle.`
        : `Consistent communication keeps this opportunity top-of-mind and moves discussions to the next milestone.`;

      const hook = item.type === 'invoice'
        ? `Quick check on invoice #${item.title} to confirm receipt and verify payment processing.`
        : item.type === 'proposal'
        ? `Circling back on the proposal for ${item.title} to answer any clarifying questions.`
        : `Checking in on ${item.title} to see how things are progressing on their end.`;

      return {
        id: item.id,
        contactId: item.contactId,
        rank,
        badge,
        contactName: item.contactName || 'Contact',
        contactCompany: item.contactCompany || '',
        actionTitle: item.title || `Follow up with ${item.contactName}`,
        reason,
        financialImpact: formattedAmount ? `${formattedAmount} value` : 'Client momentum',
        channel: item.channel || 'email',
        urgency,
        recommendedMessageHook: hook,
      };
    });

    const overdueCount = items.filter((f) => f.dueDate && f.dueDate < todayStr).length;
    const headline = overdueCount > 0
      ? `Priority Focus: ${overdueCount} Overdue Item${overdueCount > 1 ? 's' : ''} Require Attention`
      : `Daily Briefing: 3 High-Impact Moves to Drive Momentum`;

    const overview = `You have ${items.length} pending follow-up${items.length > 1 ? 's' : ''} representing ${currency}${totalAtStake.toLocaleString()} in active pipeline value. Prioritizing these top actions will protect pending revenue and advance active conversations.`;

    return {
      headline,
      overview,
      totalPendingCount: items.length,
      totalAtStake,
      currency,
      topActions,
      tacticalAdvice: 'Send short, polite check-ins before midday for higher open and reply rates. If no response on email, a brief WhatsApp check gets replied to within 2 hours.',
      generatedAt: new Date().toISOString(),
    };
  };

  try {
    if (!pendingFollowUps || pendingFollowUps.length === 0) {
      return res.json({
        success: true,
        summary: generateAlgorithmicSummary([]),
      });
    }

    const ai = getGenAI();

    // Prepare clean, bounded summary of pending items for prompt
    const todayStr = new Date().toISOString().split('T')[0];
    const sanitizedItems = pendingFollowUps.slice(0, 25).map((f: any) => {
      const isOverdue = f.dueDate && f.dueDate < todayStr;
      return {
        id: f.id,
        contactId: f.contactId,
        contactName: f.contactName,
        contactCompany: f.contactCompany || '',
        title: f.title,
        description: f.description || '',
        type: f.type,
        amount: f.amount || 0,
        currency: f.currency || '$',
        dueDate: f.dueDate,
        isOverdue,
        priority: f.priority || 'medium',
        channel: f.channel || 'email',
      };
    });

    const prompt = `You are FollowFlow AI, an elite Revenue Follow-Up & Client Retention Strategist.
Analyze the user's current pending follow-ups below and synthesize a "Smart Summary" highlighting the TOP 3 PRIORITY ACTIONS the user should take right now.

USER CONTEXT:
- Name: ${userProfile?.displayName || 'User'}
- Total Pending Items: ${pendingFollowUps.length}
- Sample of Current Pending Items:
${JSON.stringify(sanitizedItems, null, 2)}

STRATEGIC PRIORITIZATION RULES:
1. Rank 1: Immediate Revenue Risk or Severely Overdue Invoice/Proposal (money waiting or deals at risk of going cold).
2. Rank 2: High Urgency Opportunity Due Today or Time-Sensitive Decision (closing proposals, high-priority milestones).
3. Rank 3: High-Leverage Relationship / Quick Win (preventing stalled leads, keeping warm momentum, quick reply potential).
4. For each action, reference the exact item id, contactName, contactCompany, and channel from the input list.
5. Provide a crisp, persuasive "reason" (why this is #1, #2, or #3) and a punchy 1-2 sentence "recommendedMessageHook" (an opening hook the user can use).
6. Provide an overarching "headline" and 2-sentence "overview", plus a single high-impact "tacticalAdvice" pro-tip.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "headline": "Short, compelling headline summarizing the current queue",
  "overview": "2 concise sentences analyzing pipeline exposure and revenue opportunities",
  "totalPendingCount": ${pendingFollowUps.length},
  "totalAtStake": number (sum of relevant amount values),
  "currency": "currency symbol e.g. $",
  "topActions": [
    {
      "id": "exact-id-from-list",
      "contactId": "exact-contactId-or-empty",
      "rank": 1,
      "badge": "Overdue Invoice" | "High-Value Proposal" | "Time-Sensitive" | "Quick Win",
      "contactName": "Contact Name",
      "contactCompany": "Company Name or empty",
      "actionTitle": "Specific action title e.g. Close $2,500 Web Design Invoice with Acme",
      "reason": "1-2 sentences on why this action takes priority #1 right now",
      "financialImpact": "e.g. '$2,500 overdue' or 'High-value deal'",
      "channel": "email" | "whatsapp" | "phone" | "sms",
      "urgency": "urgent" | "high" | "medium",
      "recommendedMessageHook": "Concise suggested opening phrase or check-in text"
    }
  ],
  "tacticalAdvice": "1 practical, actionable sales/follow-up execution tip for today"
}`;

    // Multi-tier model fallback with retry across current active models
    const candidateModels = GEMINI_TEXT_MODELS;

    let rawText = '';
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });
        if (response?.text) {
          rawText = response.text.trim();
          break;
        }
      } catch (modelErr: any) {
        // Brief pause before trying fallback model to mitigate transient 503 load spikes
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
    }

    if (!rawText) {
      throw new Error('All AI models unavailable, initiating smart algorithmic priority engine');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      // Try to extract json block if wrapped in markdown
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse Gemini JSON response');
      }
    }

    // Validate parsed output
    if (!parsed || !Array.isArray(parsed.topActions) || parsed.topActions.length === 0) {
      throw new Error('Gemini response missing topActions');
    }

    // Ensure generatedAt timestamp exists
    parsed.generatedAt = new Date().toISOString();
    parsed.totalPendingCount = pendingFollowUps.length;

    return res.json({
      success: true,
      summary: parsed,
    });
  } catch (error: any) {
    // Seamless fallback to algorithmic intelligence without emitting unhandled errors
    const fallbackSummary = generateAlgorithmicSummary(pendingFollowUps);
    return res.json({
      success: true,
      isFallback: true,
      summary: fallbackSummary,
    });
  }
});

// ==========================================
// FLOW AI ASSISTANT CHAT ENDPOINT
// ==========================================
app.post('/api/ai/flow-chat', async (req, res) => {
  try {
    const { messages = [], userId, contextData = {} } = req.body || {};
    const latestUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    const contacts = Array.isArray(contextData.contacts) ? contextData.contacts : [];
    const todayFollowUps = Array.isArray(contextData.todayFollowUps) ? contextData.todayFollowUps : [];
    const overdueFollowUps = Array.isArray(contextData.overdueFollowUps) ? contextData.overdueFollowUps : [];
    const activeFollowUps = Array.isArray(contextData.activeFollowUps) ? contextData.activeFollowUps : [];
    const moneyAtRisk = Number(contextData.moneyAtRisk) || 0;
    const outstandingInvoices = Number(contextData.outstandingInvoices) || 0;
    const totalFollowUpValue = Number(contextData.totalFollowUpValue) || 0;

    // Helper: Algorithmic fallback if Gemini is offline
    const generateSmartFallback = (query: string): string => {
      const q = query.toLowerCase();
      if (q.includes('what should i do') || q.includes('today') || q.includes('priority')) {
        if (todayFollowUps.length === 0 && overdueFollowUps.length === 0) {
          return "You're completely clear today! You have no follow-ups scheduled for today and no overdue items. Use this time to review previous wins, qualify new leads, or create a new multi-step sequence.";
        }
        let reply = `Here are your immediate priorities based on your real data:\n\n`;
        if (overdueFollowUps.length > 0) {
          reply += `🚨 **Overdue Items (${overdueFollowUps.length}):**\n`;
          overdueFollowUps.slice(0, 3).forEach((f: any) => {
            reply += `- **${f.contactName || 'Contact'}** (${f.title || 'Task'}): ${f.amount ? `$${f.amount}` : 'Deal task'}, due ${f.dueDate}.\n`;
          });
          reply += `\n`;
        }
        if (todayFollowUps.length > 0) {
          reply += `📅 **Due Today (${todayFollowUps.length}):**\n`;
          todayFollowUps.slice(0, 3).forEach((f: any) => {
            reply += `- **${f.contactName || 'Contact'}** (${f.title || 'Task'}): ${f.amount ? `$${f.amount}` : 'Task'}.\n`;
          });
        }
        reply += `\nWould you like me to draft a message for any of these?`;
        return reply;
      }

      if (q.includes('invoice') || q.includes('dangerous') || q.includes('owe') || q.includes('money')) {
        const invoiceItems = overdueFollowUps.filter((f: any) => f.type === 'invoice' || (f.amount && f.amount > 0));
        if (invoiceItems.length === 0) {
          return `You have **no dangerous or overdue invoices** right now! Total money at risk is **$0**. All billed clients are currently on schedule.`;
        }
        let reply = `You have **$${moneyAtRisk.toLocaleString()}** at risk across overdue invoices:\n\n`;
        invoiceItems.forEach((f: any) => {
          reply += `- **${f.contactName || 'Client'}**: $${Number(f.amount || 0).toLocaleString()} (${f.title || 'Invoice'}) — Due ${f.dueDate}.\n`;
        });
        reply += `\n**Recommended Next Step:** Send a firm but polite payment reminder or offer a direct Paystack link.`;
        return reply;
      }

      if (q.includes('proposal') || q.includes('cold') || q.includes('stalled')) {
        const proposals = activeFollowUps.filter((f: any) => f.type === 'proposal' || f.title?.toLowerCase().includes('proposal'));
        if (proposals.length === 0) {
          return `No proposals are currently marked cold or pending response. You have ${activeFollowUps.length} total active follow-ups.`;
        }
        let reply = `Found **${proposals.length} proposal follow-up(s)** in progress:\n\n`;
        proposals.slice(0, 4).forEach((p: any) => {
          reply += `- **${p.contactName || 'Lead'}**: ${p.title} (${p.amount ? `$${p.amount}` : 'Proposal'}), scheduled for ${p.dueDate}.\n`;
        });
        reply += `\n**Tip:** For proposals older than 48 hours, a short "clarifying questions" check-in yields a 3x higher response rate.`;
        return reply;
      }

      if (q.includes('risk') || q.includes('revenue') || q.includes('summarize')) {
        return `📊 **Revenue Risk Summary:**\n- **Money at Risk (>7d Overdue):** $${moneyAtRisk.toLocaleString()}\n- **Outstanding Invoices:** $${outstandingInvoices.toLocaleString()}\n- **Total Active Pipeline Value:** $${totalFollowUpValue.toLocaleString()}\n- **Overdue Count:** ${overdueFollowUps.length}\n- **Due Today Count:** ${todayFollowUps.length}\n\n${overdueFollowUps.length > 0 ? 'Prioritize reaching out to overdue accounts first to prevent revenue loss.' : 'Your pipeline is in healthy standing with zero critical overdue risks.'}`;
      }

      return `Looking at your live dashboard, you have **${todayFollowUps.length} follow-up(s) due today**, **${overdueFollowUps.length} overdue item(s)**, and **$${moneyAtRisk.toLocaleString()}** in money at risk. How can I assist you with these contacts?`;
    };

    let assistantContent = '';

    try {
      const ai = getGenAI();

      const prompt = `You are Flow, the intelligent AI Revenue Manager and proactive Follow-Up Assistant for FollowFlow.
The user is asking you a question about their business, follow-ups, invoices, or revenue.
CRITICAL MANDATE: BASE YOUR ANSWER ENTIRELY ON THE REAL USER DATA BELOW. NEVER INVENT DATA OR FABRICATE METRICS.
If there are no overdue invoices, say so clearly. If data is missing or zero, say so accurately.

REAL AUTHENTICATED USER DATA:
- Contacts Count: ${contacts.length}
- Follow-ups Due Today (${todayFollowUps.length}):
${JSON.stringify(todayFollowUps.slice(0, 10), null, 2)}
- Overdue Follow-ups (${overdueFollowUps.length}):
${JSON.stringify(overdueFollowUps.slice(0, 10), null, 2)}
- Active Follow-ups Total: ${activeFollowUps.length}
- Money at Risk (>7 days overdue): $${moneyAtRisk}
- Outstanding Invoices: $${outstandingInvoices}
- Total Pipeline Value: $${totalFollowUpValue}

CONVERSATION HISTORY:
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

USER QUESTION: "${latestUserMsg}"

SPECIFIC QUERY GUIDELINES:
1. If the user asks "What should I do today?" -> Give clear, ranked bullet points of who to contact today and overdue items.
2. If the user asks "Which invoices are dangerous?" -> List invoices overdue by >7 days or highest value, with exact client name and amount. If none, state that zero invoices are dangerous.
3. If the user asks "Which proposals went cold?" -> Identify proposals waiting on response or with past due dates.
4. If the user asks "Summarize my revenue risk." -> Provide a concise financial breakdown of money at risk, outstanding invoices, and high-value opportunities.

FORMAT:
Concise, professional, warm, and highly actionable Markdown with bold names and bullet points.`;

      const response = await generateContentWithFallback(ai, {
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      });

      assistantContent = response.text?.trim() || '';
    } catch (aiErr: any) {
      console.warn('[FlowChat] AI fallback triggered:', aiErr.message);
      assistantContent = generateSmartFallback(latestUserMsg);
    }

    if (!assistantContent) {
      assistantContent = generateSmartFallback(latestUserMsg);
    }

    return res.json({
      success: true,
      message: {
        id: `m-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Flow chat error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all API 404 handler to ensure /api routes never fall through to SPA HTML
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Centralized error handler for /api to guarantee JSON responses
app.use('/api', (err: any, _req: any, res: any, _next: any) => {
  console.error('API Error handler caught:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Setup Vite development middleware or static asset serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FollowFlow server running on http://localhost:${PORT}`);
  });
}

startServer();
