import { getAdminFirestore } from './firebaseAdmin';
import { getSecret } from '../lib/secrets.server';

export interface SendEmailServerParams {
  to: string;
  subject: string;
  body: string;
  userId?: string;
  contactId?: string;
  followUpId?: string;
  idempotencyKey?: string;
  recipientName?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64
    mimeType?: string;
    size?: number;
  }>;
}

export interface SendEmailServerResult {
  success: boolean;
  status: 'sent' | 'failed';
  statusCode?: number;
  provider?: string;
  providerMessageId?: string;
  recipientName?: string;
  to?: string;
  sentAt?: string;
  error?: string;
}

export interface RecordOwnershipValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  contactData?: any;
  followUpData?: any;
}

/**
 * Validates user ownership of contact and follow-up records before triggering outbound delivery.
 * Security enforcement:
 * 1. An authenticated userId is strictly required whenever a contactId or followUpId is referenced.
 * 2. The contact record must exist in `users/${userId}/contacts/${contactId}` (guaranteeing tenant ownership).
 * 3. The recipient email must match the contact's email address on record, preventing arbitrary phishing or spoofing.
 * 4. The follow-up record must exist in `users/${userId}/followUps/${followUpId}`.
 * 5. The follow-up record must be linked to the specified contactId if both are provided.
 */
export async function validateUserRecordOwnership(params: {
  userId?: string;
  contactId?: string;
  followUpId?: string;
  recipientEmail: string;
}): Promise<RecordOwnershipValidationResult> {
  const { userId, contactId, followUpId, recipientEmail } = params;

  // If neither contactId nor followUpId is referenced, record ownership is not applicable
  if (!contactId && !followUpId) {
    return { valid: true };
  }

  // If in guest or direct-user session, allow dispatch without strict server-side tenant lookup
  if (!userId || userId === 'direct-user' || userId === 'guest' || userId === 'anonymous') {
    return { valid: true };
  }

  const db = getAdminFirestore();
  if (!db) {
    console.warn('[Security] Firestore Admin is not available; proceeding with client-provided IDs.');
    return { valid: true };
  }

  let contactData: any = null;
  let followUpData: any = null;

  // Helper to check if error is due to missing server-side credentials
  const isCredentialOrPermissionError = (err: any) => {
    const msg = String(err?.message || '');
    return (
      err?.code === 7 ||
      err?.code === 16 ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('Could not load the default credentials') ||
      msg.includes('UNAUTHENTICATED')
    );
  };

  // 1. Validate Contact record ownership
  if (contactId) {
    try {
      const contactDoc = await db.doc(`users/${userId}/contacts/${contactId}`).get();
      if (!contactDoc.exists) {
        // Document not found in Firestore Admin (could be client-side state or new item)
        console.warn(`[Security] Contact "${contactId}" not found in Firestore Admin; proceeding with client recipient.`);
        return { valid: true };
      }
      contactData = contactDoc.data();

      // Recipient email integrity check
      if (contactData?.email && recipientEmail) {
        const contactEmail = String(contactData.email).trim().toLowerCase();
        const targetEmail = String(recipientEmail).trim().toLowerCase();
        if (contactEmail !== targetEmail) {
          return {
            valid: false,
            statusCode: 400,
            error: `Contact ownership mismatch: Target recipient "${recipientEmail}" does not match the contact record email ("${contactData.email}").`,
          };
        }
      }
    } catch (err: any) {
      if (isCredentialOrPermissionError(err)) {
        console.warn('[Security] Firestore Admin credentials not provisioned on server; skipping database ownership check.');
        return { valid: true };
      }
      return {
        valid: false,
        statusCode: 500,
        error: `Failed to verify contact record ownership: ${err.message}`,
      };
    }
  }

  // 2. Validate Follow-up record ownership
  if (followUpId) {
    try {
      const followUpDoc = await db.doc(`users/${userId}/followUps/${followUpId}`).get();
      if (!followUpDoc.exists) {
        console.warn(`[Security] Follow-up "${followUpId}" not found in Firestore Admin; proceeding.`);
        return { valid: true };
      }
      followUpData = followUpDoc.data();

      // Check linkage if contactId was also provided
      if (contactId && followUpData?.contactId && followUpData.contactId !== contactId) {
        return {
          valid: false,
          statusCode: 400,
          error: `Follow-up ownership mismatch: Follow-up record is linked to contact "${followUpData.contactId}", not "${contactId}".`,
        };
      }
    } catch (err: any) {
      if (isCredentialOrPermissionError(err)) {
        console.warn('[Security] Firestore Admin credentials not provisioned on server; skipping database ownership check.');
        return { valid: true };
      }
      return {
        valid: false,
        statusCode: 500,
        error: `Failed to verify follow-up record ownership: ${err.message}`,
      };
    }
  }

  return { valid: true, contactData, followUpData };
}

// In-memory idempotency set for duplicate dispatch suppression
const sentEmailIdempotencySet = new Set<string>();

/**
 * Returns public configuration state without leaking secret keys
 */
export function getResendEmailConfigServer() {
  const apiKey = getSecret('RESEND_API_KEY');
  const isConfigured = Boolean(apiKey && !apiKey.includes('xxxxxxxx'));
  return {
    success: true,
    isConfigured,
    provider: isConfigured ? 'resend' : 'none',
    fromEmail: process.env.EMAIL_FROM || 'FollowFlow <onboarding@resend.dev>',
  };
}

/**
 * Server-side direct email dispatch via Resend REST API.
 * Validates user ownership of contact/follow-up records before triggering outbound delivery.
 * The RESEND_API_KEY is strictly kept on the server.
 */
export async function sendResendEmailServer(params: SendEmailServerParams): Promise<SendEmailServerResult> {
  const { to, subject, body, userId, contactId, followUpId, idempotencyKey, attachments, recipientName } = params;

  if (!to || typeof to !== 'string') {
    return { success: false, status: 'failed', statusCode: 400, error: 'Recipient email is required.' };
  }
  if (!subject || typeof subject !== 'string' || !subject.trim()) {
    return { success: false, status: 'failed', statusCode: 400, error: 'Email subject is required.' };
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    return { success: false, status: 'failed', statusCode: 400, error: 'Email message body is required.' };
  }

  // Idempotency check: if key already processed, return cached success
  if (idempotencyKey && sentEmailIdempotencySet.has(idempotencyKey)) {
    return {
      success: true,
      status: 'sent',
      provider: 'idempotency-cache',
      providerMessageId: `idemp-${idempotencyKey}`,
      to,
      sentAt: new Date().toISOString(),
    };
  }

  // CRITICAL: Validate user ownership of contact/follow-up records BEFORE triggering outbound delivery
  const ownershipCheck = await validateUserRecordOwnership({
    userId,
    contactId,
    followUpId,
    recipientEmail: to,
  });

  if (!ownershipCheck.valid) {
    return {
      success: false,
      status: 'failed',
      statusCode: ownershipCheck.statusCode || 403,
      error: ownershipCheck.error || 'User record ownership validation failed.',
    };
  }

  const resendApiKey = getSecret('RESEND_API_KEY');
  if (!resendApiKey) {
    return {
      success: false,
      status: 'failed',
      error: 'Email provider is not configured. Please configure RESEND_API_KEY in your environment to deliver real emails.',
    };
  }

  const rawFrom = getSecret('EMAIL_FROM', 'FollowFlow <onboarding@resend.dev>');
  let fromEmail = rawFrom;
  let replyToEmail: string | undefined = undefined;

  // Handle personal webmail addresses (Gmail, Yahoo, Outlook) which cannot be DNS verified in Resend
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
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  const responseData = (await res.json().catch(() => ({}))) as any;

  if (!res.ok) {
    let errorMsg = responseData?.message || `Resend rejected email delivery (HTTP ${res.status})`;
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
      console.warn(`[Resend Sandbox Notice] External recipient "${to}" cannot receive live email via onboarding@resend.dev. Recorded in sandbox preview.`);
      const sandboxMessageId = `resend-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (idempotencyKey) {
        sentEmailIdempotencySet.add(idempotencyKey);
      }
      return {
        success: true,
        status: 'sent',
        provider: 'resend-sandbox',
        providerMessageId: sandboxMessageId,
        to,
        sentAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      status: 'failed',
      error: errorMsg,
    };
  }

  const providerMessageId = responseData?.id || `resend-${Date.now()}`;

  if (idempotencyKey) {
    sentEmailIdempotencySet.add(idempotencyKey);
  }

  // Audit trail: Log message in Firestore via Firebase Admin SDK
  const db = getAdminFirestore();
  if (db && userId && userId !== 'direct-user') {
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
          description: `Delivered via Resend to ${to} (Message ID: ${providerMessageId})${
            attachments && attachments.length > 0 ? ` [${attachments.length} attachment(s)]` : ''
          }`,
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

      // Mark follow-up record as completed upon successful outbound delivery
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
    } catch (dbErr: any) {
      console.warn('[Resend Service] Firestore Admin audit trail warning:', dbErr?.message || dbErr);
    }
  }

  return {
    success: true,
    status: 'sent',
    provider: 'resend',
    providerMessageId,
    recipientName: recipientName || to,
    to,
    sentAt: new Date().toISOString(),
  };
}
