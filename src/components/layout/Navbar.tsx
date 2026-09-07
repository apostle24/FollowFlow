import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { Sparkles, Plus, Zap, Search, UserPlus, Calendar } from 'lucide-react';
import type { AppView } from '../../types';

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onOpenNewFollowUp: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  onOpenNewFollowUp,
  searchQuery,
  setSearchQuery,
}) => {
  const { userProfile, isPro } = useAuth();
  const { openAiModal, openUpgradeModal, openLeadModal, openAppointmentModal } = useFollowUp();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Title / Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search follow-ups, contacts, amounts..."
            className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Quick Lead Button */}
        <button
          type="button"
          onClick={() => openLeadModal()}
          title="New Client Lead"
          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden md:inline">+ Lead</span>
        </button>

        {/* Quick Appointment Button */}
        <button
          type="button"
          onClick={() => openAppointmentModal()}
          title="Schedule Appointment"
          className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden md:inline">+ Book</span>
        </button>

        {/* AI Quick Generator Button */}
        <button
          type="button"
          onClick={() => openAiModal()}
          className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">AI Message</span>
        </button>

        {/* Plan Pill */}
        {isPro ? (
          <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400 fill-amber-400" /> Pro
          </span>
        ) : (
          <button
            type="button"
            onClick={() => openUpgradeModal()}
            className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold uppercase tracking-wider hidden sm:inline-flex items-center gap-1 hover:bg-amber-100 transition-colors"
          >
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Free Plan
          </button>
        )}

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={onOpenNewFollowUp}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span className="hidden sm:inline">Follow-Up</span>
        </button>
      </div>
    </header>
  );
};
