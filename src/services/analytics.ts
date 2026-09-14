import { doc, setDoc, collection } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import type { AnalyticsEvent } from '../types';

export const trackEvent = async (
  eventName: string,
  userId?: string,
  properties?: Record<string, any>
): Promise<void> => {
  try {
    const event: AnalyticsEvent = {
      eventName,
      userId,
      properties: properties || {},
      timestamp: new Date().toISOString(),
    };

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[FollowFlow Analytics] ${eventName}:`, properties);
    }

    // Only write to Firestore if user is genuinely authenticated and matches the record owner
    if (userId && auth.currentUser && auth.currentUser.uid === userId) {
      const eventRef = doc(collection(db, `users/${userId}/analytics`));
      await setDoc(eventRef, event);
    }
  } catch (error) {
    // Analytics failure should never break UI workflows
    console.warn('[Analytics] Notice:', error);
  }
};
