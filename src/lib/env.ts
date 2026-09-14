/**
 * Safe Client-Side Environment Accessor
 *
 * Exposes ONLY variables explicitly prefixed with VITE_.
 * Never attempts to access or expose server-only secrets.
 */

export interface ClientConfig {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;
  appUrl: string;
  billingCurrency: string;
  billingProPrice: number;
}

export function getClientConfig(): ClientConfig {
  return {
    firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    firebaseStorageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    firebaseMessagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    firebaseAppId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    appUrl: import.meta.env.VITE_APP_URL || window.location.origin,
    billingCurrency: import.meta.env.VITE_BILLING_CURRENCY || 'GHS',
    billingProPrice: Number(import.meta.env.VITE_BILLING_PRO_PRICE) || 102,
  };
}
