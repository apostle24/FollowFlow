import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { isUnauthorizedDomainError } from '../../services/gmail';
import {
  User,
  Building,
  Sparkles,
  Zap,
  ShieldCheck,
  Database,
  Trash2,
  RefreshCw,
  LogOut,
  Sliders,
  DollarSign,
  CheckCircle2,
  Mail,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check,
  TestTube2,
} from 'lucide-react';
import { PLAN_LIMITS } from '../../types';

import { BillingSettings } from '../billing/BillingSettings';

export const SettingsView: React.FC = () => {
  const {
    userProfile,
    user,
    updateProfile,
    signOut,
    isGmailConnected,
    isGmailPreviewMode,
    gmailUserEmail,
    connectGmail,
    enablePreviewGmail,
    disconnectGmail,
  } = useAuth();
  const { clearData } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [businessType, setBusinessType] = useState(userProfile?.businessType || 'freelancer');
  const [defaultTone, setDefaultTone] = useState(userProfile?.defaultTone || 'friendly');
  const [defaultCurrency, setDefaultCurrency] = useState(userProfile?.defaultCurrency || '$');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [unauthorizedDomainError, setUnauthorizedDomainError] = useState<{ domain: string } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    setUnauthorizedDomainError(null);
    try {
      const res = await connectGmail();
      success('Gmail Connected', `Successfully connected as ${res.email}. You can now send emails directly from your Gmail.`);
    } catch (err: any) {
      if (isUnauthorizedDomainError(err)) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setUnauthorizedDomainError({ domain });
        toastError('Firebase domain authorization required for Google sign-in.');
      } else {
        toastError(err.message || 'Failed to connect Gmail');
      }
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleEnablePreview = () => {
    const email = userProfile?.email || user?.email || 'founder@business.com';
    enablePreviewGmail(email);
    setUnauthorizedDomainError(null);
    success('Preview Gmail Connected', `Sandbox mode active as ${email}. You can test Gmail templates and dispatching.`);
  };

  const handleCopyDomain = () => {
    const domain = unauthorizedDomainError?.domain || (typeof window !== 'undefined' ? window.location.hostname : '');
    if (domain) {
      navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleDisconnectGmail = () => {
    disconnectGmail();
    setUnauthorizedDomainError(null);
    success('Gmail Disconnected', 'Your Google session has been disconnected from email dispatching.');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        businessType: businessType as any,
        defaultTone: defaultTone as any,
        defaultCurrency,
      });
      success('Settings saved', 'Your profile preferences have been updated.');
    } catch (err: any) {
      toastError('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetWorkspace = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset your workspace? This will remove all contacts, follow-ups, leads, and appointments, returning your account to an empty state.'
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      await clearData();
      success('Workspace Reset', 'All contacts, follow-ups, and activity have been cleared.');
    } catch (err) {
      toastError('Failed to reset workspace');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl">
      {/* Header */}
      <div>
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Preferences</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight mt-0.5">
          Settings & Billing
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
          Manage your business details, default follow-up tones, and Paystack Pro subscription.
        </p>
      </div>

      {/* Plan & Subscription Card (Paystack) */}
      <BillingSettings />

      {/* Google Workspace / Gmail Integration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Google Workspace & Gmail Dispatch</h3>
                {isGmailConnected ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                    isGmailPreviewMode
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {isGmailPreviewMode ? (
                      <>
                        <TestTube2 className="w-3 h-3" /> Preview Mode (Sandbox)
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </>
                    )}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                Connect your Google account to dispatch follow-up emails directly from your verified personal or Google Workspace email address. Bypasses third-party transactional domain restrictions.
              </p>
              {isGmailConnected && gmailUserEmail && (
                <p className="text-xs font-semibold text-slate-700 mt-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full inline-block ${isGmailPreviewMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  Sending as: <span className="font-mono text-blue-600">{gmailUserEmail}</span>
                  {isGmailPreviewMode && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Sandbox logging enabled
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 pt-2 sm:pt-0">
            {isGmailConnected ? (
              <button
                type="button"
                onClick={handleDisconnectGmail}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
              >
                Disconnect Gmail
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center gap-2 transition-all disabled:opacity-60"
              >
                {connectingGmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting Google...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    Connect with Gmail
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Unauthorized Domain Diagnostic & Resolution Banner */}
        {unauthorizedDomainError && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-900">
                  Firebase Domain Authorization Required for Live Google Sign-In
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Firebase Authentication requires preview domains to be explicitly whitelisted. The current container domain is not yet on your Firebase project's authorized list:
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <code className="px-2 py-1 rounded bg-amber-100 border border-amber-300 font-mono text-[11px] text-amber-900 select-all">
                    {unauthorizedDomainError.domain}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyDomain}
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedDomain ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Domain
                      </>
                    )}
                  </button>
                </div>
                <div className="pt-2 text-[11px] text-amber-800 space-y-1">
                  <p className="font-semibold text-amber-900">How to authorize permanently in Firebase:</p>
                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                    <li>Go to <span className="font-medium text-amber-950">Firebase Console &gt; Authentication &gt; Settings</span></li>
                    <li>Click <span className="font-medium text-amber-950">Authorized domains</span> tab &gt; <span className="font-medium text-amber-950">Add domain</span></li>
                    <li>Paste <code className="font-mono text-[10px]">{unauthorizedDomainError.domain}</code> and save</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-amber-200/80 flex items-center justify-between gap-3">
              <span className="text-[11px] text-amber-800">
                Want to test Gmail features immediately without configuring Firebase domains?
              </span>
              <button
                type="button"
                onClick={handleEnablePreview}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <TestTube2 className="w-3.5 h-3.5" />
                Connect Preview Sandbox
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Profile & Business Details Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Profile & AI Tone Preferences</h3>
        <p className="text-xs text-slate-500 mb-6">
          These defaults are used when generating follow-up messages with Gemini AI.
        </p>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Your Name / Sender Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Business Type
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="freelancer">Solo Freelancer</option>
                <option value="consultant">Independent Consultant</option>
                <option value="agency">Agency / Studio</option>
                <option value="small_business">Small Business</option>
                <option value="service_provider">Service Provider</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default AI Tone
              </label>
              <select
                value={defaultTone}
                onChange={(e) => setDefaultTone(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="friendly">Friendly & Casual</option>
                <option value="professional">Professional & Polite</option>
                <option value="firm">Firm & Direct (For Invoices)</option>
                <option value="urgent">Urgent & Direct</option>
                <option value="short">Short & Punchy</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Default Currency Symbol
              </label>
              <input
                type="text"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                placeholder="$"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 transition-all disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* Workspace Data Management */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Workspace Data Management</h3>
            <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
              Reset your workspace to a clean empty state by removing any test contacts, follow-ups, leads, or appointments. Real user data only.
            </p>
          </div>
          <button
            onClick={handleResetWorkspace}
            disabled={clearing}
            className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-60 shrink-0"
          >
            <Trash2 className={`w-3.5 h-3.5 text-rose-600 ${clearing ? 'animate-spin' : ''}`} />
            {clearing ? 'Clearing...' : 'Reset Workspace to Clean State'}
          </button>
        </div>
      </div>

      {/* Security & Data Privacy Card */}
      <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900 text-sm">Strict Security & User Data Isolation</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your contact details and follow-up notes are strictly partitioned by Firebase Authentication user IDs. No third parties or other accounts have access to your CRM pipeline.
            </p>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-900">Signed in as {userProfile?.email}</p>
          <p className="text-[11px] text-slate-400">User ID: {userProfile?.uid}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};
