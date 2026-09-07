import React from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { CalendarCheck, AlertTriangle, FileText, Receipt, DollarSign, Info } from 'lucide-react';

export const StatCards: React.FC = () => {
  const { stats } = useFollowUp();

  return (
    <div className="space-y-3">
      {/* Primary Follow-Up & Revenue Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Follow-ups Today */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-ups Today</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.todayCount}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Due for action today</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>

        {/* 2. Overdue */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Overdue</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{stats.overdueCount}</h3>
            <p className="text-[11px] text-rose-400 mt-0.5">Needs urgent attention</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* 3. Money at Risk */}
        <div id="stat-money-at-risk" className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Money at Risk</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">
              ${(stats.moneyAtRisk || 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Active proposals & leads</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        {/* 4. Outstanding Invoices */}
        <div id="stat-outstanding-invoices" className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Outstanding Invoices</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">
              ${(stats.outstandingInvoices || 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Overdue & unpaid invoices</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        {/* 5. Total Follow-Up Value */}
        <div id="stat-total-value" className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Follow-Up Value</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              ${(stats.totalFollowUpValue || 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Combined active pipeline</p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Non-accounting software clarity notice */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>* FollowFlow tracks revenue follow-up opportunities and separates active proposals from overdue invoices. Not accounting or bookkeeping software.</span>
      </div>
    </div>
  );
};
