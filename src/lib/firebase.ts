import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Safely load optional applet config without hard Rollup import dependency
const configModules = import.meta.glob<{ default?: Record<string, string> }>(
  '../../firebase-applet-config.json',
  { eager: true }
);
const rawConfig =
  configModules['../../firebase-applet-config.json']?.default ||
  (configModules['../../firebase-applet-config.json'] as any) ||
  {};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || rawConfig.apiKey || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || rawConfig.appId || '1:123456789:web:abcdef',
};

// Initialize Firebase App singleton
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Cloud Firestore with custom databaseId if configured
const customDbId = rawConfig.firestoreDatabaseId;
export const db: Firestore = customDbId && customDbId !== '(default)'
  ? getFirestore(app, customDbId)
  : getFirestore(app);

export default app;
