import React from 'react';
import { LayoutDashboard, CalendarClock, Layers, BarChart3, Plus, Users, Settings } from 'lucide-react';
import type { AppView } from '../../types';

interface MobileNavProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onOpenNewFollowUp: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  setCurrentView,
  onOpenNewFollowUp,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {/* Today */}
      <button
        onClick={() => setCurrentView('dashboard')}
        className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[9px] font-semibold transition-colors ${
          currentView === 'dashboard' ? 'text-blue-600 font-bold' : 'text-slate-500'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Today</span>
      </button>

      {/* Sequences */}
      <button
        onClick={() => setCurrentView('sequences')}
        className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[9px] font-semibold transition-colors ${
          currentView === 'sequences' ? 'text-blue-600 font-bold' : 'text-slate-500'
        }`}
      >
        <Layers className="w-4 h-4" />
        <span>Sequences</span>
      </button>

      {/* Add Button (Centered Highlight) */}
      <button
        onClick={onOpenNewFollowUp}
        className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-300 active:scale-95 transition-all -mt-3 border-2 border-white"
        aria-label="Add Follow-up"
      >
        <Plus className="w-5 h-5 stroke-[3]" />
      </button>

      {/* Analytics */}
      <button
        onClick={() => setCurrentView('analytics')}
        className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[9px] font-semibold transition-colors ${
          currentView === 'analytics' ? 'text-blue-600 font-bold' : 'text-slate-500'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Analytics</span>
      </button>

      {/* Contacts */}
      <button
        onClick={() => setCurrentView('contacts')}
        className={`flex flex-col items-center gap-0.5 p-1 rounded-xl text-[9px] font-semibold transition-colors ${
          currentView === 'contacts' ? 'text-blue-600 font-bold' : 'text-slate-500'
        }`}
      >
        <Users className="w-4 h-4" />
        <span>Contacts</span>
      </button>
    </div>
  );
};

