import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  subscribeToUserSubscription,
  fetchBillingConfig,
  initializePaystackCheckout,
  verifyPaystackPayment,
  verifyAndSeedDefaultTemplates,
} from '../services/db';
import { trackEvent } from '../services/analytics';
import {
  GMAIL_SCOPES,
  connectGmailAccount,
  setCachedGmailToken,
  clearCachedGmailToken,
  getCachedGmailToken,
  getCachedGmailEmail,
} from '../services/gmail';
import type { UserProfile, UserPlan, UserSubscription, SubscriptionStatus, BillingConfig } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  subscription: UserSubscription | null;
  billingConfig: BillingConfig;
  isPro: boolean;
  subscriptionStatus: SubscriptionStatus;
  loading: boolean;
  authError: string | null;
  authModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'forgot-password';
  gmailAccessToken: string | null;
  gmailUserEmail: string | null;
  isGmailConnected: boolean;
  connectGmail: () => Promise<{ accessToken: string; email: string }>;
  disconnectGmail: () => void;
  openAuthModal: (mode?: 'login' | 'register' | 'forgot-password') => void;
  closeAuthModal: () => void;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  completeOnboarding: (profession: string, focus: string[]) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateUserPlan: (plan: UserPlan) => Promise<void>;
  incrementAiUsage: (forcedCount?: number) => Promise<void>;
  startPaystackCheckout: (customCallbackUrl?: string) => Promise<{ authorizationUrl: string; reference: string }>;
  verifyPaymentReference: (reference: string) => Promise<boolean>;
  clearAuthError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig>({
    currency: 'USD',
    proPrice: 9,
    isConfigured: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [gmailAccessToken, setGmailAccessToken] = useState<string | null>(() => getCachedGmailToken());
  const [gmailUserEmail, setGmailUserEmail] = useState<string | null>(() => getCachedGmailEmail());

  const openAuthModal = (mode: 'login' | 'register' | 'forgot-password' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
    setAuthError(null);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthError(null);
  };

  const clearAuthError = () => setAuthError(null);

  // Fetch public Paystack Billing configuration
  useEffect(() => {
    fetchBillingConfig().then((cfg) => {
      setBillingConfig(cfg);
    });
  }, []);

  const fetchProfile = async (firebaseUser: User) => {
    try {
      let profile = await getUserProfile(firebaseUser.uid);
      if (!profile) {
        profile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'FollowFlow User',
          onboardingCompleted: false,
          plan: 'free',
          subscriptionStatus: 'free',
          aiGenerationsCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await createUserProfile(profile);
      }
      setUserProfile(profile);
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  // Auth state & Subscription Listener
  useEffect(() => {
    let subUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser);

        // Verify default templates and sequences in user workspace & ensure idempotency
        verifyAndSeedDefaultTemplates(firebaseUser.uid).catch((err) => {
          console.warn('Error in verifyAndSeedDefaultTemplates on login:', err);
        });

        // Listen for live verified subscription updates
        if (subUnsubscribe) subUnsubscribe();
        subUnsubscribe = subscribeToUserSubscription(
          firebaseUser.uid,
          (subData) => {
            if (subData) {
              setSubscription(subData as UserSubscription);
            } else {
              setSubscription(null);
            }
          },
          (err) => {
            console.warn('Subscription watch error:', err);
          }
        );

        // Check URL parameters for Paystack payment redirect
        try {
          const params = new URLSearchParams(window.location.search);
          const reference = params.get('reference') || params.get('trxref');
          if (reference) {
            console.log('Detected Paystack callback reference:', reference);
            verifyPaymentReference(reference).then((verified) => {
              if (verified) {
                // Clean URL query parameters
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            });
          }
        } catch (e) {
          // ignore in non-browser context
        }
      } else {
        setUserProfile(null);
        setSubscription(null);
        if (subUnsubscribe) {
          subUnsubscribe();
          subUnsubscribe = null;
        }
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (subUnsubscribe) subUnsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      await trackEvent('login', userCredential.user.uid, { email });
      closeAuthModal();
    } catch (err: any) {
      console.error('Sign in error:', err);
      let msg = 'Failed to sign in. Please check your email and password.';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please wait a moment and try again.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    setAuthError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newUser = userCredential.user;

      if (name) {
        await firebaseUpdateProfile(newUser, { displayName: name });
      }

      const initialProfile: UserProfile = {
        uid: newUser.uid,
        email: newUser.email || email,
        displayName: name || 'FollowFlow User',
        onboardingCompleted: false,
        plan: 'free',
        subscriptionStatus: 'free',
        aiGenerationsCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createUserProfile(initialProfile);
      setUserProfile(initialProfile);
      await trackEvent('signup', newUser.uid, { email, name });
      closeAuthModal();
    } catch (err: any) {
      console.error('Sign up error:', err);
      let msg = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      await trackEvent('login_google', cred.user.uid, { email: cred.user.email });
      closeAuthModal();
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      let msg = 'Failed to sign in with Google.';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Sign-in popup was blocked by browser. Please allow popups or use email sign-in.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in was cancelled.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        return;
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Google Sign-In is not enabled for this project yet. Please use email or 1-Click Demo.';
      } else if (err.message) {
        msg = err.message;
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInDemo = async () => {
    setAuthError(null);
    const demoEmail = 'demo.founder@followflow.app';
    const demoPassword = 'FollowFlow2026!';
    try {
      try {
        await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      } catch (signInErr: any) {
        if (
          signInErr.code === 'auth/user-not-found' ||
          signInErr.code === 'auth/invalid-credential'
        ) {
          const cred = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          if (cred.user) {
            await firebaseUpdateProfile(cred.user, { displayName: 'Demo Founder' });
          }
        } else {
          throw signInErr;
        }
      }
      closeAuthModal();
    } catch (err: any) {
      console.warn('Demo login via auth failed:', err);
      // Even if Firebase throws an error (e.g. rate limit), allow user in
      setAuthError(err.message || 'Demo sign-in failed. Please try again or create an account.');
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      setSubscription(null);
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      console.error('Password reset error:', err);
      let msg = 'Failed to send password reset email.';
      if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const completeOnboarding = async (profession: string, focus: string[]) => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, {
        profession,
        primaryFollowUpFocus: focus,
        onboardingCompleted: true,
      });
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              profession,
              primaryFollowUpFocus: focus,
              onboardingCompleted: true,
            }
          : null
      );
    } catch (err) {
      console.error('Error completing onboarding:', err);
      throw err;
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateUserProfile(user.uid, data);
      setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  const updateUserPlan = async (plan: UserPlan) => {
    if (!user) return;
    if (plan === 'pro') {
      throw new Error('Pro plan can only be activated via verified Paystack payment.');
    }
    try {
      await updateUserProfile(user.uid, { plan });
      setUserProfile((prev) => (prev ? { ...prev, plan } : null));
    } catch (err) {
      console.error('Error updating plan:', err);
      throw err;
    }
  };

  const incrementAiUsage = async () => {
    if (!user || !userProfile) return;
    const newCount = (userProfile.aiGenerationsCount || 0) + 1;
    // Server-side /api/ai/generate-followup updates the count in Firestore using Admin SDK.
    // Client state is updated locally to avoid client-side security permission errors.
    setUserProfile((prev) => (prev ? { ...prev, aiGenerationsCount: newCount } : null));
  };

  // Paystack real checkout initialization
  const startPaystackCheckout = async (
    customCallbackUrl?: string
  ): Promise<{ authorizationUrl: string; reference: string }> => {
    if (!user || !userProfile) {
      throw new Error('You must be logged in to upgrade to Pro.');
    }

    const callbackUrl =
      customCallbackUrl || `${window.location.origin}/?billing_callback=true`;

    const result = await initializePaystackCheckout({
      userId: user.uid,
      email: user.email || userProfile.email,
      callbackUrl,
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  };

  // Paystack verification with server
  const verifyPaymentReference = async (reference: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const result = await verifyPaystackPayment({
        userId: user.uid,
        reference,
      });

      if (result.success) {
        await refreshProfile();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Verification error:', err);
      return false;
    }
  };

  // Compute active Pro status safely
  const subscriptionStatus: SubscriptionStatus =
    subscription?.status || (userProfile?.plan === 'pro' ? 'active_pro' : 'free');
  const isPro = subscriptionStatus === 'active_pro' || userProfile?.plan === 'pro';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        subscription,
        billingConfig,
        isPro,
        subscriptionStatus,
        loading,
        authError,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        signIn,
        signUp,
        signInWithGoogle,
        signInDemo,
        signOut,
        resetPassword,
        completeOnboarding,
        updateProfile,
        updateUserPlan,
        incrementAiUsage,
        startPaystackCheckout,
        verifyPaymentReference,
        clearAuthError,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
