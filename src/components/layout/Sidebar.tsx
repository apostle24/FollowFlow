import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import {
  LayoutDashboard,
  CalendarClock,
  Layers,
  BarChart3,
  Users,
  Settings,
  Sparkles,
  Zap,
  LogOut,
  Plus,
  DollarSign,
  FileCode2,
} from 'lucide-react';
import type { AppView } from '../../types';

interface SidebarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  onOpenNewFollowUp: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onOpenNewFollowUp }) => {
  const { userProfile, signOut, isPro } = useAuth();
  const { stats, openUpgradeModal, activeFollowUps, contacts, activeEnrollments, dueSequenceEnrollments } = useFollowUp();

  const navItems = [
    { id: 'dashboard' as AppView, label: 'Today & Dashboard', icon: LayoutDashboard, badge: stats.todayCount + stats.overdueCount },
    { id: 'follow-ups' as AppView, label: 'All Follow-Ups', icon: CalendarClock, badge: activeFollowUps.length },
    {
      id: 'sequences' as AppView,
      label: 'Sequences',
      icon: Layers,
      badge: dueSequenceEnrollments.length > 0 ? dueSequenceEnrollments.length : activeEnrollments.length > 0 ? activeEnrollments.length : undefined,
      badgeColor: dueSequenceEnrollments.length > 0 ? 'bg-amber-500 text-white' : undefined,
    },
    { id: 'templates' as AppView, label: 'Templates Library', icon: FileCode2 },
    { id: 'analytics' as AppView, label: 'Analytics', icon: BarChart3 },
    { id: 'contacts' as AppView, label: 'Contacts', icon: Users, badge: contacts.length },
    { id: 'settings' as AppView, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 bg-white min-h-screen fixed left-0 top-0 bottom-0 z-30">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-200">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">FollowFlow</span>
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="p-4 shrink-0">
        <button
          onClick={onOpenNewFollowUp}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          New Follow-Up
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-bold border-r-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.badgeColor
                      ? item.badgeColor
                      : isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Plan & Revenue Stats Widget */}
      <div className="p-4 border-t border-slate-100 shrink-0">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Money Waiting</span>
            <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              Pipeline
            </span>
          </div>
          <p className="text-lg font-black text-slate-900 flex items-center">
            ${stats.moneyWaiting.toLocaleString()}
          </p>
          <div className="mt-2 pt-2 border-t border-blue-100/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Plan: <strong className="uppercase text-blue-700">{isPro ? 'Pro' : (userProfile?.plan || 'Free')}</strong></span>
            {!isPro && (
              <button
                onClick={() => openUpgradeModal()}
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
              >
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                Upgrade
              </button>
            )}
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {userProfile?.displayName || 'FollowFlow User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{userProfile?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
