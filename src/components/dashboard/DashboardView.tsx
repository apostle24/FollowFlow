import React, { useState } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { StatCards } from './StatCards';
import { DeliveryMetricsBar } from './DeliveryMetricsBar';
import { SmartSummaryCard } from './SmartSummaryCard';
import { RevenuePaymentCharts } from './RevenuePaymentCharts';
import { FollowUpCard } from './FollowUpCard';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  DollarSign,
  Calendar,
  CheckCircle2,
  Plus,
  ArrowRight,
  Filter,
  Layers,
  Send,
  Flame,
  Zap,
} from 'lucide-react';
import type { FollowUp } from '../../types';

interface DashboardViewProps {
  onOpenNewFollowUp: () => void;
  onEditFollowUp: (followUp: FollowUp) => void;
  onDeleteFollowUp: (followUp: FollowUp) => void;
  searchQuery?: string;
  onNavigateToSequences?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenNewFollowUp,
  onEditFollowUp,
  onDeleteFollowUp,
  searchQuery = '',
}) => {
  const { userProfile } = useAuth();
  const {
    todayFollowUps,
    overdueFollowUps,
    highValueFollowUps,
    upcomingFollowUps,
    activeFollowUps,
    dueSequenceEnrollments,
    openExecuteModal,
    startFollowUpSession,
    loading,
  } = useFollowUp();

  const [activeTab, setActiveTab] = useState<'today' | 'overdue' | 'high-value' | 'upcoming' | 'all'>('today');

  // Filter items by search query if present
  const filterBySearch = (items: FollowUp[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.contactName?.toLowerCase().includes(q) ||
        item.contactCompany?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.amount && item.amount.toString().includes(q))
    );
  };

  const filteredToday = filterBySearch(todayFollowUps);
  const filteredOverdue = filterBySearch(overdueFollowUps);
  const filteredHighValue = filterBySearch(highValueFollowUps);
  const filteredUpcoming = filterBySearch(upcomingFollowUps);
  const filteredAll = filterBySearch(activeFollowUps);

  const displayedList =
    activeTab === 'today'
      ? filteredToday
      : activeTab === 'overdue'
      ? filteredOverdue
      : activeTab === 'high-value'
      ? filteredHighValue
      : activeTab === 'upcoming'
      ? filteredUpcoming
      : filteredAll;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Welcome & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Dashboard Overview</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Who needs follow-up today?
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Welcome back, <strong className="text-slate-800">{userProfile?.displayName || 'there'}</strong>. Here is your actionable follow-up queue.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {(todayFollowUps.length > 0 || overdueFollowUps.length > 0) && (
            <button
              onClick={() => startFollowUpSession()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 text-xs font-bold shadow-sm shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-4 h-4 fill-stone-950" />
              Rapid Follow-Up Session
            </button>
          )}

          <button
            onClick={onOpenNewFollowUp}
            className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-bold shadow-sm flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Follow-Up
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <StatCards />

      {/* Real Multi-Channel Delivery Engine Status & Metrics */}
      <DeliveryMetricsBar />

      {/* Sequence Cadence Due Notification Banner */}
      {dueSequenceEnrollments.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Flame className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {dueSequenceEnrollments.length} Sequence Follow-Up Step{dueSequenceEnrollments.length > 1 ? 's' : ''} Ready Today
                </h3>
                <span className="text-[10px] uppercase font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  Action Due
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Multi-step sequence steps scheduled for {dueSequenceEnrollments.map((e) => e.contactName).slice(0, 2).join(', ')}
                {dueSequenceEnrollments.length > 2 && ` and ${dueSequenceEnrollments.length - 2} more`}.
              </p>
            </div>
          </div>

          <button
            onClick={() => openExecuteModal(dueSequenceEnrollments[0])}
            className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            Execute Next Step
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI-Powered Smart Summary: Top 3 Priority Actions */}
      <SmartSummaryCard />

      {/* Monthly Revenue Trends & Upcoming Payment Deadlines */}
      <RevenuePaymentCharts
        onOpenNewFollowUp={onOpenNewFollowUp}
        onEditFollowUp={onEditFollowUp}
      />

      {/* Smart Categorized Queue Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'today'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Follow Up Today
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'today' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {todayFollowUps.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'overdue' ? 'bg-rose-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {overdueFollowUps.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('high-value')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'high-value'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              High Value
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'high-value' ? 'bg-amber-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {highValueFollowUps.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'upcoming'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Upcoming
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'upcoming' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {upcomingFollowUps.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All Active ({activeFollowUps.length})
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs">Loading follow-ups...</p>
            </div>
          ) : displayedList.length > 0 ? (
            displayedList.map((item) => (
              <FollowUpCard
                key={item.id}
                followUp={item}
                onEdit={onEditFollowUp}
                onDelete={onDeleteFollowUp}
              />
            ))
          ) : (
            /* Empty State */
            <div className="py-12 px-4 text-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {activeTab === 'today' && 'No follow-ups due today!'}
                {activeTab === 'overdue' && 'Great job! Zero overdue follow-ups.'}
                {activeTab === 'high-value' && 'No high-value opportunities pending.'}
                {activeTab === 'upcoming' && 'No upcoming follow-ups scheduled.'}
                {activeTab === 'all' && 'Your follow-up queue is completely clear.'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                {activeFollowUps.length === 0
                  ? 'Add your first contact and proposal/invoice follow-up to start protecting your revenue.'
                  : 'You are all caught up for this category.'}
              </p>

              {activeFollowUps.length === 0 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                  <button
                    onClick={onOpenNewFollowUp}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Follow-Up
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
