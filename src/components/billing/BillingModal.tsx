import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { Sparkles, Check, X, Shield, ArrowRight, Zap, CreditCard, Lock, RotateCcw } from 'lucide-react';
import { PLAN_LIMITS } from '../../types';

export const BillingModal: React.FC = () => {
  const { userProfile, subscription, billingConfig, isPro, startPaystackCheckout } = useAuth();
  const { upgradeModalOpen, upgradeReason, closeUpgradeModal, contacts, activeFollowUps } = useFollowUp();
  const { error: toastError } = useToast();
  const [loading, setLoading] = useState<boolean>(false);

  if (!upgradeModalOpen) return null;

  const currentPlan = isPro ? 'pro' : userProfile?.plan || 'free';
  const limits = PLAN_LIMITS[currentPlan];

  const formatPriceDisplay = (price: number, currency: string = 'GHS') => {
    switch ((currency || 'GHS').toUpperCase()) {
      case 'GHS':
        return `GH₵${price}`;
      case 'NGN':
        return `₦${price.toLocaleString()}`;
      case 'USD':
        return `$${price}`;
      case 'EUR':
        return `€${price}`;
      case 'GBP':
        return `£${price}`;
      case 'ZAR':
        return `R ${price}`;
      case 'KES':
        return `KSh ${price.toLocaleString()}`;
      default:
        return `${currency} ${price}`;
    }
  };

  const priceDisplay = formatPriceDisplay(billingConfig.proPrice, billingConfig.currency);

  const handlePaystackUpgrade = async () => {
    setLoading(true);
    try {
      const result = await startPaystackCheckout();
      if (result.authorizationUrl) {
        // Direct to Paystack secure checkout
        window.location.href = result.authorizationUrl;
      }
    } catch (err: any) {
      console.error('Paystack checkout error:', err);
      toastError(
        'Checkout Unavailable',
        err.message || 'Please check your Paystack API configuration in environment settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="billing-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="billing-modal-content"
        className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-2xl w-full p-6 sm:p-8 text-stone-800 dark:text-stone-100 relative overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          id="close-billing-modal-btn"
          onClick={closeUpgradeModal}
          className="absolute top-6 right-6 p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Simple, High-ROI Pricing
          </div>
          <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100">Upgrade to FollowFlow Pro</h2>
          {upgradeReason && (
            <p className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 mt-2 font-medium">
              {upgradeReason}
            </p>
          )}
        </div>

        {/* Usage Stats on Current Plan */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 mb-6 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Contacts</p>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {contacts.length}{' '}
              <span className="text-xs text-stone-400 font-normal">
                / {limits.maxContacts === Infinity ? '∞' : limits.maxContacts}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Active Follow-ups</p>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {activeFollowUps.length}{' '}
              <span className="text-xs text-stone-400 font-normal">
                / {limits.maxActiveFollowUps === Infinity ? '∞' : limits.maxActiveFollowUps}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">AI Generations</p>
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {userProfile?.aiGenerationsCount || 0}{' '}
              <span className="text-xs text-stone-400 font-normal">
                / {limits.maxAiGenerations === Infinity ? '∞' : limits.maxAiGenerations}
              </span>
            </p>
          </div>
        </div>

        {/* Plan Comparison Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Free Plan */}
          <div
            className={`p-5 rounded-2xl border ${
              !isPro
                ? 'border-stone-300 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/40'
                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-stone-900 dark:text-stone-100">Free Tier</h3>
              {!isPro && (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
            <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mb-4">
              $0 <span className="text-xs font-normal text-stone-500">/ forever</span>
            </p>

            <ul className="space-y-2 text-xs text-stone-600 dark:text-stone-400 mb-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Up to 20 saved contacts
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Up to 10 active follow-ups
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> 25 AI message generations
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> 1-Click WhatsApp & Email
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Money Waiting revenue tracker
              </li>
            </ul>
          </div>

          {/* Pro Plan */}
          <div
            className={`p-5 rounded-2xl border relative ${
              isPro
                ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 ring-1 ring-amber-500'
                : 'border-stone-900 dark:border-stone-700 bg-stone-950 dark:bg-stone-850 text-white shadow-xl'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h3 className={`font-bold ${isPro ? 'text-stone-900 dark:text-white' : 'text-white'}`}>Pro</h3>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full">
                Revenue Accelerator
              </span>
            </div>
            <p className={`text-2xl font-black mb-4 ${isPro ? 'text-stone-900 dark:text-white' : 'text-white'}`}>
              {priceDisplay} <span className={`text-xs font-normal ${isPro ? 'text-stone-500' : 'text-stone-400'}`}>/ month</span>
            </p>

            <ul className={`space-y-2 text-xs mb-6 ${isPro ? 'text-stone-600 dark:text-stone-300' : 'text-stone-300'}`}>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> <strong>Unlimited</strong> contacts
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> <strong>Unlimited</strong> active follow-ups
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> <strong>Unlimited</strong> Flow AI Assistant & Messages
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Multi-step automated sequences
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Full Contact History Timeline
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Priority revenue support
              </li>
            </ul>

            {isPro ? (
              <div className="w-full py-2.5 px-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs font-semibold text-center border border-amber-300 dark:border-amber-800">
                ✓ Pro Subscription Active
              </div>
            ) : (
              <button
                type="button"
                id="paystack-upgrade-btn"
                onClick={handlePaystackUpgrade}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Connecting to Paystack...
                  </>
                ) : (
                  <>
                    Upgrade with Paystack ({priceDisplay}/mo)
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Secured by Paystack badge */}
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Secured with Paystack PCI-DSS certified 256-bit encryption.</span>
          </div>
          <span className="font-semibold text-stone-700 dark:text-stone-300">Cancel anytime</span>
        </div>
      </div>
    </div>
  );
};
