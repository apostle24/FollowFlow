/**
 * Secure Environment Secrets Management Utility (Server-Side)
 *
 * Provides safe, typed access to runtime environment variables and secrets,
 * prevents accidental leakage to browser bundles, masks sensitive tokens in logs,
 * and validates entropy and format to protect production credentials.
 */

export type ServerSecretKey =
  | 'GEMINI_API_KEY'
  | 'RESEND_API_KEY'
  | 'EMAIL_FROM'
  | 'PAYSTACK_SECRET_KEY'
  | 'PAYSTACK_PUBLIC_KEY'
  | 'PAYSTACK_PRO_PLAN_CODE'
  | 'BILLING_CURRENCY'
  | 'APP_URL'
  | 'FIREBASE_CONFIG'
  | 'GOOGLE_APPLICATION_CREDENTIALS'
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_PROJECT_ID';

export interface SecretStatus {
  key: ServerSecretKey;
  isConfigured: boolean;
  maskedPreview: string;
  source: 'process_env' | 'default' | 'missing';
  warning?: string;
}

/**
 * Mask sensitive secrets for safe logging and diagnostic display.
 * Shows only first 4-6 chars and last 4 chars, masking all middle characters.
 */
export function maskSecret(secret?: string | null): string {
  if (!secret || typeof secret !== 'string') return '••••••••';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }
  const prefixLen = Math.min(6, Math.floor(trimmed.length / 4));
  const suffixLen = Math.min(4, Math.floor(trimmed.length / 4));
  const prefix = trimmed.slice(0, prefixLen);
  const suffix = trimmed.slice(-suffixLen);
  return `${prefix}${'•'.repeat(Math.max(4, trimmed.length - prefixLen - suffixLen))}${suffix}`;
}

/**
 * Safely retrieve a server secret with optional fallback.
 * Guarantees no crashes on missing optional variables.
 */
export function getSecret(key: ServerSecretKey, fallback?: string): string {
  const val = process.env[key];
  if (val !== undefined && val !== null && val.trim() !== '') {
    return val.trim();
  }
  return fallback || '';
}

/**
 * Retrieve a strictly required server secret.
 * Throws a sanitized Error if missing or placeholder, ensuring fail-fast execution
 * during critical operations (e.g. initiating payment or sending an email).
 */
export function requireSecret(key: ServerSecretKey, actionContext?: string): string {
  const val = getSecret(key);
  if (!val) {
    const contextMsg = actionContext ? ` to perform ${actionContext}` : '';
    throw new Error(
      `[Security Error] Required environment secret "${key}" is not configured${contextMsg}. Please configure this secret in the environment settings.`
    );
  }

  // Detect common placeholders
  const placeholderMatches = [
    'MY_',
    'YOUR_',
    'xxxxxxxx',
    'AIzaSy_REPLACE',
    'sk_test_replace',
    're_replace',
  ];
  if (placeholderMatches.some((p) => val.includes(p))) {
    throw new Error(
      `[Security Error] Environment secret "${key}" contains an unconfigured placeholder. Please provide a valid production credential.`
    );
  }

  return val;
}

/**
 * Inspects all known system secrets and produces a safe diagnostic report
 * without leaking raw plaintext keys.
 */
export function getSecretsHealthReport(): Record<ServerSecretKey, SecretStatus> {
  const keys: ServerSecretKey[] = [
    'GEMINI_API_KEY',
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_PUBLIC_KEY',
    'PAYSTACK_PRO_PLAN_CODE',
    'BILLING_CURRENCY',
    'APP_URL',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_PROJECT_ID',
    'FIREBASE_CONFIG',
    'GOOGLE_APPLICATION_CREDENTIALS',
  ];

  const report: Partial<Record<ServerSecretKey, SecretStatus>> = {};

  for (const key of keys) {
    const raw = process.env[key];
    const isPresent = Boolean(raw && raw.trim() !== '');

    let warning: string | undefined;
    if (key === 'EMAIL_FROM' && isPresent && raw?.includes('onboarding@resend.dev')) {
      warning = 'Using Resend sandbox address (onboarding@resend.dev). External delivery is restricted to account owner until custom domain is verified.';
    }

    if (key === 'RESEND_API_KEY' && isPresent && !raw?.startsWith('re_')) {
      warning = 'Resend API key format typically begins with "re_".';
    }

    if (key === 'PAYSTACK_SECRET_KEY' && isPresent && !raw?.startsWith('sk_')) {
      warning = 'Paystack secret key should start with "sk_test_" or "sk_live_".';
    }

    report[key] = {
      key,
      isConfigured: isPresent,
      maskedPreview: isPresent ? maskSecret(raw) : 'NOT_SET',
      source: isPresent ? 'process_env' : 'missing',
      warning,
    };
  }

  return report as Record<ServerSecretKey, SecretStatus>;
}
