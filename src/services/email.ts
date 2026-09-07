// Email Service for FollowFlow
// Integrates with backend /api/email endpoints for direct email dispatch & scheduling

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
  idempotencyKey?: string;
}

export interface SendEmailResponse {
  success: boolean;
  status: 'sent' | 'failed';
  provider?: string;
  providerMessageId?: string;
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
  | 'sent';

export interface ScheduledEmailJob {
  id: string;
  userId: string;
  contactId?: string;
  followUpId?: string;
  to: string;
  subject: string;
  body: string;
  scheduledFor: string;
  status: ScheduledEmailJobStatus;
  createdAt: string;
  idempotencyKey?: string;
  sentAt?: string;
  completedAt?: string;
  providerMessageId?: string;
  error?: string;
  lastError?: string;
  attempts?: number;
  maxAttempts?: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  lockedAt?: string;
  lockedBy?: string;
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
