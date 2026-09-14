// Email & Multi-Channel Delivery Service for FollowFlow
// Integrates with backend /api/email and /api/delivery endpoints for real dispatch & auditability

import type { DeliveryMetrics, FollowUpAttachment } from '../types';

export interface EmailConfig {
  isConfigured: boolean;
  provider: 'resend' | 'none';
  fromEmail: string;
}

export interface SendEmailParams {
  userId: string;
  to: string;
  subject: string;
  body: string;
  contactId?: string;
  followUpId?: string;
  recipientName?: string;
  idempotencyKey?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64
    mimeType?: string;
    size?: number;
  }>;
}

export interface SendEmailResponse {
  success: boolean;
  status: 'sent' | 'failed';
  provider?: string;
  providerMessageId?: string;
  recipientName?: string;
  to?: string;
  sentAt?: string;
  error?: string;
}

export interface ScheduleEmailParams extends SendEmailParams {
  scheduledFor: string; // ISO 8601 string
}

export type ScheduledEmailJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'scheduled'
  | 'sent'
  | 'delivered';

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
  scheduledFor: string;
  status: ScheduledEmailJobStatus;
  createdAt: string;
  idempotencyKey?: string;
  sentAt?: string;
  completedAt?: string;
  deliveredAt?: string;
  providerMessageId?: string;
  provider?: string;
  error?: string;
  lastError?: string;
  attempts?: number;
  maxAttempts?: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    mimeType?: string;
    size?: number;
  }>;
}

export interface ScheduleEmailResponse {
  success: boolean;
  job?: ScheduledEmailJob;
  alreadyScheduled?: boolean;
  error?: string;
}

// Trigger server-side scheduler tick (manual or webhook trigger)
export async function triggerSchedulerTick(): Promise<any> {
  try {
    const res = await fetch('/api/scheduler/tick', { method: 'POST' });
    if (!res.ok) throw new Error(`Tick returned HTTP ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Check if email provider is configured on server
export async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const res = await fetch('/api/email/config');
    if (!res.ok) throw new Error('Failed to fetch email config');
    return await res.json();
  } catch (err) {
    return { isConfigured: false, provider: 'none', fromEmail: '' };
  }
}

// Send direct email immediately via server provider
export async function sendDirectEmail(params: SendEmailParams): Promise<SendEmailResponse> {
  const res = await fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      status: 'failed',
      error: data.error || `Server responded with HTTP ${res.status}`,
    };
  }
  return data;
}

// Schedule an email for automated server-side dispatch at a specific date & time
export async function scheduleEmail(params: ScheduleEmailParams): Promise<ScheduleEmailResponse> {
  const res = await fetch('/api/email/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error: data.error || `Failed to schedule email (HTTP ${res.status})`,
    };
  }
  return data;
}

// List all scheduled emails for a user
export async function getScheduledEmails(userId: string): Promise<ScheduledEmailJob[]> {
  try {
    const res = await fetch(`/api/email/scheduled?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.jobs || [];
  } catch {
    return [];
  }
}

// Cancel a scheduled email
export async function cancelScheduledEmail(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/email/scheduled/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Fetch real delivery metrics directly from application records
export async function fetchDeliveryMetrics(userId?: string): Promise<DeliveryMetrics> {
  try {
    const url = userId ? `/api/delivery/metrics?userId=${encodeURIComponent(userId)}` : '/api/delivery/metrics';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (
      data.metrics || {
        emailsSentToday: 0,
        emailsScheduled: 0,
        emailsDelivered: 0,
        emailsFailed: 0,
        whatsappActions: 0,
        callsInitiated: 0,
        followUpsCompleted: 0,
      }
    );
  } catch (err) {
    console.warn('Could not fetch delivery metrics:', err);
    return {
      emailsSentToday: 0,
      emailsScheduled: 0,
      emailsDelivered: 0,
      emailsFailed: 0,
      whatsappActions: 0,
      callsInitiated: 0,
      followUpsCompleted: 0,
    };
  }
}

// Check provider delivery status
export async function checkDeliveryStatus(providerMessageId: string): Promise<any> {
  try {
    const res = await fetch(`/api/email/status/${encodeURIComponent(providerMessageId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.job;
  } catch {
    return null;
  }
}

// Log real action (WhatsApp opened, Phone Call initiated, Manual Copied) to server & timeline
export async function logDeliveryAction(params: {
  userId: string;
  contactId: string;
  followUpId?: string;
  channel: 'whatsapp' | 'phone' | 'manual' | 'email';
  type: string;
  title: string;
  description?: string;
  recipient?: string;
  recipientPhone?: string;
}): Promise<any> {
  try {
    const res = await fetch('/api/delivery/log-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Failed to log delivery action:', err);
    return null;
  }
}
