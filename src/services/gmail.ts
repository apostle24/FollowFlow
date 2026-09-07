// Google Workspace Gmail Integration Service
// Adheres strictly to Google Workspace skill guidelines:
// - Official Gmail scopes
// - Client-side token authentication with in-memory caching
// - Safe RFC 2822 email construction & Base64url encoding
// - Support for sending, drafting, and profile retrieval

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const GMAIL_SCOPES: string[] = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
];

// In-memory access token cache (NEVER persisted to localStorage/sessionStorage)
let inMemoryGmailAccessToken: string | null = null;
let inMemoryGmailEmail: string | null = null;

export function getCachedGmailToken(): string | null {
  return inMemoryGmailAccessToken;
}

export function getCachedGmailEmail(): string | null {
  return inMemoryGmailEmail;
}

export function setCachedGmailToken(token: string | null, email?: string | null): void {
  inMemoryGmailAccessToken = token;
  if (email !== undefined) {
    inMemoryGmailEmail = email;
  }
}

export function clearCachedGmailToken(): void {
  inMemoryGmailAccessToken = null;
  inMemoryGmailEmail = null;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface SendGmailParams {
  to: string;
  subject: string;
  body: string;
  fromEmail?: string;
  accessToken?: string;
  userId?: string;
  contactId?: string;
  followUpId?: string;
}

export interface GmailSendResult {
  success: boolean;
  messageId: string;
  threadId?: string;
  fromEmail: string;
  error?: string;
}

// Convert string to UTF-8 base64
function utf8ToBase64(str: string): string {
  return window.btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

// Build RFC 2822 email string and encode with base64url
export function createRfc822Base64Url(params: {
  to: string;
  fromEmail?: string;
  subject: string;
  bodyText: string;
}): string {
  const { to, fromEmail, subject, bodyText } = params;

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="padding: 16px 0;">
    ${bodyText.replace(/\n/g, '<br/>')}
  </div>
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
    Sent via FollowFlow with Gmail
  </div>
</body>
</html>`;

  // Base64 encode the subject for UTF-8 compatibility
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;

  const headers: string[] = [
    `To: ${to.trim()}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];

  if (fromEmail) {
    headers.push(`From: ${fromEmail.trim()}`);
  }

  // Blank line separating headers from base64 body content
  const fullRfcMessage = `${headers.join('\r\n')}\r\n\r\n${utf8ToBase64(htmlBody)}`;

  // Convert to base64url format for Gmail API
  return utf8ToBase64(fullRfcMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Authenticate / Connect user with Google & Gmail scopes
export async function connectGmailAccount(): Promise<{ accessToken: string; email: string }> {
  const provider = new GoogleAuthProvider();
  GMAIL_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline',
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);

  if (!credential?.accessToken) {
    throw new Error('Could not obtain Gmail access token from Google. Please ensure popups are allowed.');
  }

  const token = credential.accessToken;
  const email = result.user.email || '';

  setCachedGmailToken(token, email);

  // Fetch verified profile from Gmail API
  try {
    const profile = await fetchGmailProfile(token);
    if (profile?.emailAddress) {
      setCachedGmailToken(token, profile.emailAddress);
      return { accessToken: token, email: profile.emailAddress };
    }
  } catch (err) {
    console.warn('Could not fetch Gmail profile immediately after auth:', err);
  }

  return { accessToken: token, email };
}

// Fetch user profile from Gmail API
export async function fetchGmailProfile(token?: string): Promise<GmailProfile | null> {
  const activeToken = token || inMemoryGmailAccessToken;
  if (!activeToken) return null;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${activeToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearCachedGmailToken();
    }
    throw new Error(`Gmail API returned status ${res.status}`);
  }

  return await res.json();
}

// Send real email through official Google Gmail API
export async function sendEmailViaGmail(params: SendGmailParams): Promise<GmailSendResult> {
  const token = params.accessToken || inMemoryGmailAccessToken;
  if (!token) {
    throw new Error('Gmail is not connected. Please connect your Google account to send emails via Gmail.');
  }

  const fromEmail = params.fromEmail || inMemoryGmailEmail || 'me';
  const rawBase64Url = createRfc822Base64Url({
    to: params.to,
    fromEmail: fromEmail !== 'me' ? fromEmail : undefined,
    subject: params.subject,
    bodyText: params.body,
  });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawBase64Url }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      clearCachedGmailToken();
      throw new Error('Gmail authorization expired. Please reconnect your Gmail account.');
    }
    const errorMsg = data.error?.message || `Gmail API error (HTTP ${res.status})`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    messageId: data.id || `gmail-${Date.now()}`,
    threadId: data.threadId,
    fromEmail,
  };
}

// Create a draft directly in Gmail inbox
export async function createGmailDraft(params: SendGmailParams): Promise<{ success: boolean; draftId: string }> {
  const token = params.accessToken || inMemoryGmailAccessToken;
  if (!token) {
    throw new Error('Gmail is not connected. Please connect your Google account.');
  }

  const fromEmail = params.fromEmail || inMemoryGmailEmail || 'me';
  const rawBase64Url = createRfc822Base64Url({
    to: params.to,
    fromEmail: fromEmail !== 'me' ? fromEmail : undefined,
    subject: params.subject,
    bodyText: params.body,
  });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: { raw: rawBase64Url },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || `Failed to create Gmail draft (HTTP ${res.status})`);
  }

  return {
    success: true,
    draftId: data.id,
  };
}
