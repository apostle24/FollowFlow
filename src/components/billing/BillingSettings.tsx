import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import {
  CreditCard,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { PLAN_LIMITS } from '../../types';

export const BillingSettings: React.FC = () => {
  const { userProfile, subscription, billingConfig, isPro, startPaystackCheckout } = useAuth();
  const { contacts, activeFollowUps, openUpgradeModal } = useFollowUp();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);

  const currentPlan = isPro ? 'pro' : userProfile?.plan || 'free';
  const limits = PLAN_LIMITS[currentPlan];
  const priceDisplay = `${billingConfig.currency === 'USD' ? '$' : billingConfig.currency + ' '}${billingConfig.proPrice}`;

  const handlePaystackUpgrade = async () => {
    setLoading(true);
    try {
      const result = await startPaystackCheckout();
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
      }
    } catch (err: any) {
      console.error('Paystack billing error:', err);
      toastError(
        'Checkout Unavailable',
        err.message || 'Please verify your PAYSTACK_SECRET_KEY in settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (subscription?.status === 'active_pro' || isPro) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Active Pro Subscription
        </span>
      );
    }
    if (subscription?.status === 'payment_failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold">
          <AlertCircle className="w-3.5 h-3.5" />
          Payment Failed
        </span>
      );
    }
    if (subscription?.status === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          Subscription Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-xs font-semibold">
        Free Plan
      </span>
    );
  };

  return (
    <div className="p-6 rounded-3xl bg-stone-900 text-white shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div className="mb-2">{getStatusBadge()}</div>
          <h2 className="text-xl font-bold">
            {isPro ? 'FollowFlow Pro Member' : 'FollowFlow Free Tier'}
          </h2>
          <p className="text-xs text-stone-300 mt-1">
            {isPro
              ? 'Enjoy unlimited contacts, follow-ups, and AI message generations.'
              : `Upgrade to Pro for ${priceDisplay}/mo to unlock unlimited follow-ups and automated sequences.`}
          </p>
        </div>

        <div>
          {!isPro ? (
            <button
              onClick={handlePaystackUpgrade}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Upgrade with Paystack ({priceDisplay}/mo)
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : (
            <div className="text-right text-xs text-stone-400">
              <span>Billed via Paystack</span>
              {subscription?.currentPeriodEnd && (
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plan Limits Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60">
          <p className="text-xs text-stone-400">Contacts Stored</p>
          <p className="text-lg font-bold text-white mt-1">
            {contacts.length}{' '}
            <span className="text-xs text-stone-400 font-normal">
              / {limits.maxContacts === Infinity ? 'Unlimited' : limits.maxContacts}
            </span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60">
          <p className="text-xs text-stone-400">Active Follow-ups</p>
          <p className="text-lg font-bold text-white mt-1">
            {activeFollowUps.length}{' '}
            <span className="text-xs text-stone-400 font-normal">
              / {limits.maxActiveFollowUps === Infinity ? 'Unlimited' : limits.maxActiveFollowUps}
            </span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60">
          <p className="text-xs text-stone-400">AI Message Generations</p>
          <p className="text-lg font-bold text-white mt-1">
            {userProfile?.aiGenerationsCount || 0}{' '}
            <span className="text-xs text-stone-400 font-normal">
              / {limits.maxAiGenerations === Infinity ? 'Unlimited' : limits.maxAiGenerations}
            </span>
          </p>
        </div>
      </div>

      {/* Paystack Security Trust Banner */}
      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-stone-400 gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Paystack payments are processed with end-to-end webhook verification.</span>
        </div>
        <span className="text-stone-500 text-[11px]">Zero lock-in • Cancel anytime</span>
      </div>
    </div>
  );
};
