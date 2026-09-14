import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminFirestore: Firestore | null = null;
let adminAuth: Auth | null = null;

function ensureFirebaseAdminApp() {
  if (getApps().length === 0) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      'followflow-6690f';
    initializeApp({ projectId });
  }
}

/**
 * Returns Firebase Admin Firestore instance.
 * Safe for serverless and containerized Node.js runtimes.
 */
export function getAdminFirestore(): Firestore | null {
  if (!adminFirestore) {
    try {
      ensureFirebaseAdminApp();
      adminFirestore = getFirestore();
      try {
        adminFirestore.settings({ ignoreUndefinedProperties: true });
      } catch (settingsErr: any) {
        // Ignore if settings already locked
      }
    } catch (err: any) {
      console.warn('[Firebase Admin] Firestore init note:', err?.message || err);
      return null;
    }
  }
  return adminFirestore;
}

/**
 * Returns Firebase Admin Auth instance for verifying client ID tokens.
 */
export function getAdminAuth(): Auth | null {
  if (!adminAuth) {
    try {
      ensureFirebaseAdminApp();
      adminAuth = getAuth();
    } catch (err: any) {
      console.warn('[Firebase Admin] Auth init note:', err?.message || err);
      return null;
    }
  }
  return adminAuth;
}
