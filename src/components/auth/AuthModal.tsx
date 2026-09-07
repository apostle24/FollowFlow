import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    signIn,
    signUp,
    signInWithGoogle,
    signInDemo,
    resetPassword,
    authError,
    clearAuthError,
  } = useAuth();
  const { success } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('followflow_last_email') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (email) {
      localStorage.setItem('followflow_last_email', email);
    }
  }, [email]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearAuthError();

    try {
      if (authModalMode === 'login') {
        await signIn(email, password);
        success('Welcome back!', 'Successfully signed in to FollowFlow.');
      } else if (authModalMode === 'register') {
        await signUp(email, password, name);
        success('Account created!', 'Welcome to FollowFlow.');
      } else if (authModalMode === 'forgot-password') {
        await resetPassword(email);
        setResetSent(true);
        success('Email sent', 'Check your inbox for password reset instructions.');
      }
    } catch (err) {
      // Error is set in AuthContext and displayed below
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    clearAuthError();
    try {
      await signInWithGoogle();
      success('Welcome!', 'Signed in via Google.');
    } catch (err) {
      // Handled in AuthContext
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setDemoLoading(true);
    clearAuthError();
    try {
      await signInDemo();
      success('Demo Session Started', 'Exploring FollowFlow with preloaded data.');
    } catch (err) {
      // Handled in AuthContext
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-7 sm:p-8 text-slate-800 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-40 h-40 bg-blue-50 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          id="auth-modal-close-btn"
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">FollowFlow</h2>
            <p className="text-xs text-slate-500 font-medium">Revenue Follow-Up & Retention</p>
          </div>
        </div>

        {/* Title */}
        <div className="mb-5">
          <h3 className="text-2xl font-bold text-slate-900">
            {authModalMode === 'login' && 'Welcome Back'}
            {authModalMode === 'register' && 'Start Your Free Account'}
            {authModalMode === 'forgot-password' && 'Reset Password'}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {authModalMode === 'login' && 'Sign in to access your pipeline, revenue analytics, and follow-ups.'}
            {authModalMode === 'register' && '20 free contacts & 10 active follow-ups. No credit card required.'}
            {authModalMode === 'forgot-password' && 'Enter your account email and we’ll send a secure reset link.'}
          </p>
        </div>

        {/* Google & Demo Quick Sign In (for login and register) */}
        {authModalMode !== 'forgot-password' && (
          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              id="auth-google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading || demoLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-2xs flex items-center justify-center gap-2.5 transition-all disabled:opacity-60"
            >
              {googleLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              id="auth-demo-signin-btn"
              onClick={handleDemoSignIn}
              disabled={demoLoading || loading || googleLoading}
              className="w-full py-2.5 px-4 rounded-xl border border-amber-200 bg-amber-50/80 hover:bg-amber-100/80 text-amber-900 font-semibold text-xs shadow-2xs flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            >
              {demoLoading ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              )}
              <span>Instant Demo Account (1-Click Test Sign-In)</span>
            </button>

            <div className="relative flex items-center justify-center pt-2">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
                or with email
              </span>
            </div>
          </div>
        )}

        {/* Error Alert with Smart Recovery */}
        {authError && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{authError}</p>
            </div>
            {authModalMode === 'login' && (authError.includes('Invalid email') || authError.includes('not found')) && (
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  openAuthModal('register');
                }}
                className="self-start text-[11px] font-bold text-rose-700 underline hover:text-rose-900 ml-6"
              >
                No account yet? Create it with this email →
              </button>
            )}
          </div>
        )}

        {/* Password Reset Confirmation */}
        {resetSent && authModalMode === 'forgot-password' ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">Check your inbox</h4>
            <p className="text-sm text-slate-600 mt-1">
              We sent a password reset link to <strong className="text-slate-800">{email}</strong>.
            </p>
            <button
              onClick={() => {
                setResetSent(false);
                openAuthModal('login');
              }}
              className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {authModalMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Your Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    id="auth-name-input"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (authError) clearAuthError();
                    }}
                    placeholder="Alex Morgan"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  id="auth-email-input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  placeholder="name@business.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {authModalMode !== 'forgot-password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  {authModalMode === 'login' && (
                    <button
                      type="button"
                      id="auth-forgot-password-link"
                      onClick={() => openAuthModal('forgot-password')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    id="auth-password-input"
                    minLength={6}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authError) clearAuthError();
                    }}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              id="auth-submit-btn"
              disabled={loading || googleLoading || demoLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {authModalMode === 'login' && 'Sign In'}
                  {authModalMode === 'register' && 'Create Free Account'}
                  {authModalMode === 'forgot-password' && 'Send Reset Link'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Mode Switcher */}
        <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
          {authModalMode === 'login' && (
            <p>
              Don’t have an account yet?{' '}
              <button
                type="button"
                id="auth-switch-to-register"
                onClick={() => {
                  clearAuthError();
                  openAuthModal('register');
                }}
                className="text-blue-600 hover:text-blue-700 font-bold ml-1"
              >
                Sign up free
              </button>
            </p>
          )}
          {authModalMode === 'register' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                id="auth-switch-to-login"
                onClick={() => {
                  clearAuthError();
                  openAuthModal('login');
                }}
                className="text-blue-600 hover:text-blue-700 font-bold ml-1"
              >
                Sign in
              </button>
            </p>
          )}
          {authModalMode === 'forgot-password' && (
            <p>
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  clearAuthError();
                  openAuthModal('login');
                }}
                className="text-blue-600 hover:text-blue-700 font-bold ml-1"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
