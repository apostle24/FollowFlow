import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FollowUpProvider } from './context/FollowUpContext';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal } from './components/auth/AuthModal';
import { ToastProvider } from './components/common/Toast';
import { Sparkles } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-200 mb-4 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Loading FollowFlow...</p>
        <p className="text-xs text-slate-400 mt-1">Checking authentication session</p>
      </div>
    );
  }

  return (
    <>
      <AuthModal />
      {user ? (
        <FollowUpProvider>
          <AppLayout />
        </FollowUpProvider>
      ) : (
        <LandingPage />
      )}
    </>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
