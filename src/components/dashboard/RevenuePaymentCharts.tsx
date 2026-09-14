import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Send,
  Plus,
  Receipt,
  FileText,
  BarChart3,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';
import { useFollowUp } from '../../context/FollowUpContext';
import type { FollowUp } from '../../types';

interface RevenuePaymentChartsProps {
  onOpenNewFollowUp: () => void;
  onEditFollowUp?: (followUp: FollowUp) => void;
}

type ChartViewMode = 'trends' | 'deadlines' | 'split';
type TimeframeOption = '6m' | '12m' | 'ytd';

interface MonthlyRevenueData {
  monthKey: string; // "YYYY-MM"
  label: string; // "Jan 26"
  collected: number; // Completed/Paid deals & invoices
  projected: number; // Pending/Upcoming payment deadlines
  total: number;
  paidCount: number;
  pendingCount: number;
}

interface DeadlineHorizonData {
  horizon: string;
  count: number;
  amount: number;
  color: string;
  urgency: 'overdue' | 'high' | 'medium' | 'normal' | 'future';
}

export const RevenuePaymentCharts: React.FC<RevenuePaymentChartsProps> = ({
  onOpenNewFollowUp,
  onEditFollowUp,
}) => {
  const {
    followUps,
    contacts,
    openAiModal,
    markCompleted,
  } = useFollowUp();

  const [viewMode, setViewMode] = useState<ChartViewMode>('split');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('6m');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // 1. Process Monthly Revenue Trends
  const { monthlyData, totalCollected, totalProjected, momGrowthPercent } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Determine how many months back to show
    let monthsCount = 6;
    if (timeframe === '12m') monthsCount = 12;
    if (timeframe === 'ytd') monthsCount = currentMonth + 1;

    // Generate month slots [oldest -> newest + next 1 month projection]
    const slots: MonthlyRevenueData[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = monthsCount - 1; i >= -1; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
      const shortYear = String(y).slice(-2);
      const label = `${monthNames[m]} '${shortYear}`;

      slots.push({
        monthKey,
        label,
        collected: 0,
        projected: 0,
        total: 0,
        paidCount: 0,
        pendingCount: 0,
      });
    }

    const slotMap = new Map<string, MonthlyRevenueData>();
    slots.forEach((s) => slotMap.set(s.monthKey, s));

    let collectedSum = 0;
    let projectedSum = 0;

    // Aggregate follow-ups into months
    followUps.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (amt <= 0) return;

      if (f.status === 'completed') {
        collectedSum += amt;
        const dateStr = f.completedAt || f.updatedAt || f.createdAt;
        if (dateStr) {
          const monthKey = dateStr.slice(0, 7);
          const slot = slotMap.get(monthKey);
          if (slot) {
            slot.collected += amt;
            slot.paidCount += 1;
          }
        }
      } else if (f.status === 'pending' || f.status === 'contacted') {
        projectedSum += amt;
        const dueKey = f.dueDate ? f.dueDate.slice(0, 7) : null;
        if (dueKey && slotMap.has(dueKey)) {
          const slot = slotMap.get(dueKey)!;
          slot.projected += amt;
          slot.pendingCount += 1;
        } else {
          // If no specific slot or in current month
          const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
          const slot = slotMap.get(currentMonthKey);
          if (slot) {
            slot.projected += amt;
            slot.pendingCount += 1;
          }
        }
      }
    });

    slots.forEach((s) => {
      s.total = s.collected + s.projected;
    });

    // Calculate Month-over-Month Growth for collected revenue
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const currentMonthCollected = slotMap.get(currentMonthKey)?.collected || 0;
    const prevMonthCollected = slotMap.get(prevMonthKey)?.collected || 0;

    let growth: number | null = null;
    if (prevMonthCollected > 0) {
      growth = Math.round(((currentMonthCollected - prevMonthCollected) / prevMonthCollected) * 100);
    } else if (currentMonthCollected > 0) {
      growth = 100;
    }

    return {
      monthlyData: slots,
      totalCollected: collectedSum,
      totalProjected: projectedSum,
      momGrowthPercent: growth,
    };
  }, [followUps, timeframe]);

  // 2. Process Upcoming Payment Deadlines
  const { upcomingDeadlines, deadlineHorizons, overdueTotal, dueThisWeekTotal, dueNext30Total } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const fourteenDaysLater = new Date(today);
    fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14);

    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const items: Array<FollowUp & { daysRemaining: number; urgency: 'overdue' | 'today' | 'week' | 'upcoming' }> = [];

    let overdueAmt = 0;
    let overdueCnt = 0;
    let weekAmt = 0;
    let weekCnt = 0;
    let twoWeeksAmt = 0;
    let twoWeeksCnt = 0;
    let monthAmt = 0;
    let monthCnt = 0;
    let futureAmt = 0;
    let futureCnt = 0;

    followUps.forEach((f) => {
      const isUnpaid = f.status === 'pending' || f.status === 'contacted';
      const hasValue = (f.amount && Number(f.amount) > 0) || f.type === 'invoice' || f.type === 'proposal';
      if (!isUnpaid || !hasValue) return;

      const amt = Number(f.amount) || 0;
      let daysRemaining = 0;
      let urgency: 'overdue' | 'today' | 'week' | 'upcoming' = 'upcoming';

      if (f.dueDate) {
        const dueDate = new Date(`${f.dueDate}T00:00:00`);
        const diffMs = dueDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          urgency = 'overdue';
          overdueAmt += amt;
          overdueCnt += 1;
        } else if (daysRemaining === 0) {
          urgency = 'today';
          weekAmt += amt;
          weekCnt += 1;
        } else if (daysRemaining <= 7) {
          urgency = 'week';
          weekAmt += amt;
          weekCnt += 1;
        } else if (daysRemaining <= 14) {
          urgency = 'upcoming';
          twoWeeksAmt += amt;
          twoWeeksCnt += 1;
        } else if (daysRemaining <= 30) {
          urgency = 'upcoming';
          monthAmt += amt;
          monthCnt += 1;
        } else {
          urgency = 'upcoming';
          futureAmt += amt;
          futureCnt += 1;
        }
      } else {
        monthAmt += amt;
        monthCnt += 1;
      }

      items.push({
        ...f,
        daysRemaining,
        urgency,
      });
    });

    // Sort deadlines: overdue first (most negative days first), then closest due date
    items.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const horizons: DeadlineHorizonData[] = [
      {
        horizon: 'Overdue',
        count: overdueCnt,
        amount: overdueAmt,
        color: '#e11d48', // rose-600
        urgency: 'overdue',
      },
      {
        horizon: 'Next 7 Days',
        count: weekCnt,
        amount: weekAmt,
        color: '#f59e0b', // amber-500
        urgency: 'high',
      },
      {
        horizon: '8 - 14 Days',
        count: twoWeeksCnt,
        amount: twoWeeksAmt,
        color: '#3b82f6', // blue-500
        urgency: 'medium',
      },
      {
        horizon: '15 - 30 Days',
        count: monthCnt,
        amount: monthAmt,
        color: '#6366f1', // indigo-500
        urgency: 'normal',
      },
      {
        horizon: '30+ Days',
        count: futureCnt,
        amount: futureAmt,
        color: '#94a3b8', // slate-400
        urgency: 'future',
      },
    ];

    return {
      upcomingDeadlines: items,
      deadlineHorizons: horizons,
      overdueTotal: overdueAmt,
      dueThisWeekTotal: weekAmt,
      dueNext30Total: overdueAmt + weekAmt + twoWeeksAmt + monthAmt,
    };
  }, [followUps]);

  const handleMarkAsPaid = async (item: FollowUp) => {
    try {
      setMarkingPaidId(item.id);
      await markCompleted(item.id);
    } catch (err) {
      console.error('Failed to mark payment complete:', err);
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleOpenReminder = (item: FollowUp) => {
    const contact = contacts.find((c) => c.id === item.contactId);
    openAiModal(item, contact);
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${val.toLocaleString()}`;
  };

  const hasAnyRevenueData = totalCollected > 0 || totalProjected > 0 || upcomingDeadlines.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-100 bg-linear-to-r from-slate-50/70 via-white to-slate-50/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Revenue Trends & Payment Deadlines
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 pl-10">
              Monthly cash collection velocity and actionable payment due date tracking
            </p>
          </div>

          {/* Controls: View Mode & Timeframe */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* View Mode Switcher */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'split'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View revenue trends and payment deadlines side-by-side"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('trends')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'trends'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Monthly Revenue</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('deadlines')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'deadlines'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Payment Deadlines</span>
                {overdueTotal > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            </div>

            {/* Timeframe filter (for trends) */}
            {(viewMode === 'trends' || viewMode === 'split') && (
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTimeframe('6m')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    timeframe === '6m' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  6M
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('12m')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    timeframe === '12m' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  12M
                </button>
                <button
                  type="button"
                  onClick={() => setTimeframe('ytd')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    timeframe === 'ytd' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  YTD
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Collected Revenue</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-emerald-950 mt-1">
              ${totalCollected.toLocaleString()}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 mt-0.5 font-semibold">
              {momGrowthPercent !== null && momGrowthPercent >= 0 ? (
                <>
                  <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                  <span>+{momGrowthPercent}% vs last month</span>
                </>
              ) : momGrowthPercent !== null ? (
                <>
                  <ArrowDownRight className="w-3 h-3 text-rose-600" />
                  <span>{momGrowthPercent}% vs last month</span>
                </>
              ) : (
                <span>Closed & paid value</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Active Pipeline</span>
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-blue-950 mt-1">
              ${totalProjected.toLocaleString()}
            </p>
            <p className="text-[10px] text-blue-700 mt-0.5 font-medium">
              Expected from pending deals
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Due in 30 Days</span>
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-amber-950 mt-1">
              ${dueNext30Total.toLocaleString()}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5 font-medium">
              {upcomingDeadlines.length} scheduled payment{upcomingDeadlines.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Overdue Payments</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <p className="text-lg sm:text-xl font-black text-rose-950 mt-1">
              ${overdueTotal.toLocaleString()}
            </p>
            <p className="text-[10px] text-rose-700 mt-0.5 font-medium">
              {overdueTotal > 0 ? 'Urgent follow-up needed' : 'Zero overdue payments'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Charts Content Area */}
      <div className="p-4 sm:p-6">
        {!hasAnyRevenueData ? (
          /* Empty State */
          <div className="py-12 px-4 text-center rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No payment or revenue records yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Add follow-ups with invoice amounts, client proposals, or retainer values to automatically see
              monthly cash collection trajectories and payment deadline countdowns.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={onOpenNewFollowUp}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Payment / Invoice Follow-Up
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grid Layout depending on viewMode */}
            <div
              className={`grid gap-6 ${
                viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
              }`}
            >
              {/* Section 1: Monthly Revenue Trends Chart */}
              {(viewMode === 'trends' || viewMode === 'split') && (
                <div
                  className={`flex flex-col justify-between ${
                    viewMode === 'split' ? 'xl:col-span-7' : 'w-full'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Monthly Cash Trends</span>
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          Collected vs. Projected
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Track historical collected revenue and upcoming deal volume
                      </p>
                    </div>

                    {/* Chart Style Toggle (Area vs Bar) */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setChartType('area')}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                          chartType === 'area'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Area chart visualization"
                      >
                        Smooth
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartType('bar')}
                        className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                          chartType === 'bar'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Bar chart visualization"
                      >
                        Bars
                      </button>
                    </div>
                  </div>

                  {/* Recharts Container */}
                  <div className="h-[280px] sm:h-[320px] w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'area' ? (
                        <AreaChart
                          data={monthlyData}
                          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => formatCurrency(v)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null;
                              const data = payload[0]?.payload as MonthlyRevenueData;
                              if (!data) return null;
                              return (
                                <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-800 min-w-[170px]">
                                  <p className="font-bold text-slate-200 border-b border-slate-800 pb-1">
                                    {label}
                                  </p>
                                  <div className="flex items-center justify-between text-emerald-400 font-semibold">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                      Collected:
                                    </span>
                                    <span>${data.collected.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-blue-300 font-semibold">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                                      Projected:
                                    </span>
                                    <span>${data.projected.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800 font-bold">
                                    <span>Total Volume:</span>
                                    <span>${data.total.toLocaleString()}</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="collected"
                            name="Collected Revenue"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorCollected)"
                          />
                          <Area
                            type="monotone"
                            dataKey="projected"
                            name="Projected Pipeline"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            strokeDasharray="4 4"
                            fillOpacity={1}
                            fill="url(#colorProjected)"
                          />
                        </AreaChart>
                      ) : (
                        <BarChart
                          data={monthlyData}
                          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => formatCurrency(v)}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, '']}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#1e293b',
                              borderRadius: '0.75rem',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="circle"
                            wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                          />
                          <Bar
                            dataKey="collected"
                            name="Collected Revenue"
                            fill="#10b981"
                            radius={[6, 6, 0, 0]}
                          />
                          <Bar
                            dataKey="projected"
                            name="Projected Pipeline"
                            fill="#3b82f6"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Section 2: Upcoming Payment Deadlines & Horizon Visualizer */}
              {(viewMode === 'deadlines' || viewMode === 'split') && (
                <div
                  className={`flex flex-col justify-between ${
                    viewMode === 'split' ? 'xl:col-span-5' : 'w-full'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Payment Deadlines Horizon</span>
                        {overdueTotal > 0 ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            ${overdueTotal.toLocaleString()} Overdue
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            All on track
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cash flow obligations organized by upcoming payment due windows
                      </p>
                    </div>
                  </div>

                  {/* Horizon Distribution Mini-Bar Chart */}
                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 mb-4">
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Upcoming Due Distribution
                    </p>
                    <div className="h-[100px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={deadlineHorizons}
                          margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="horizon"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => formatCurrency(v)}
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Amount']}
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderRadius: '0.5rem',
                              color: '#fff',
                              fontSize: '11px',
                              padding: '6px 10px',
                            }}
                          />
                          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                            {deadlineHorizons.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Horizon breakdown badges */}
                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[10px]">
                      {deadlineHorizons.slice(0, 3).map((h) => (
                        <div key={h.horizon} className="text-center">
                          <span className="text-slate-400 block truncate">{h.horizon}</span>
                          <span className="font-bold text-slate-800">${h.amount.toLocaleString()}</span>
                          <span className="text-slate-400 text-[9px] block">({h.count})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Critical Upcoming Deadlines List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Next Deadlines to Collect
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {upcomingDeadlines.length} total
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {upcomingDeadlines.length === 0 ? (
                        <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 text-xs">
                          No pending payment deadlines scheduled.
                        </div>
                      ) : (
                        upcomingDeadlines.slice(0, 4).map((item) => {
                          const isOverdue = item.daysRemaining < 0;
                          const isToday = item.daysRemaining === 0;

                          return (
                            <div
                              key={item.id}
                              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                isOverdue
                                  ? 'bg-rose-50/50 border-rose-200'
                                  : isToday
                                  ? 'bg-amber-50/50 border-amber-200'
                                  : 'bg-white border-slate-200/80 hover:border-slate-300'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                      isOverdue
                                        ? 'bg-rose-600 text-white'
                                        : isToday
                                        ? 'bg-amber-500 text-slate-950 font-black'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {isOverdue
                                      ? `${Math.abs(item.daysRemaining)}d overdue`
                                      : isToday
                                      ? 'Due Today'
                                      : `In ${item.daysRemaining}d`}
                                  </span>

                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {item.contactName}
                                  </h4>
                                  {item.contactCompany && (
                                    <span className="text-[11px] text-slate-400 truncate">
                                      • {item.contactCompany}
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {item.title}
                                </p>
                              </div>

                              {/* Amount & Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <span className="text-xs font-black text-slate-900 block">
                                    ${(Number(item.amount) || 0).toLocaleString()}
                                  </span>
                                  <span className="text-[10px] text-slate-400 uppercase">
                                    {item.type}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReminder(item)}
                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-all"
                                    title="Send payment reminder or AI follow-up"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    disabled={markingPaidId === item.id}
                                    onClick={() => handleMarkAsPaid(item)}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 disabled:opacity-50 transition-all"
                                    title="Mark as Paid / Collected"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Insight / Action Bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-600">
                  <strong className="text-slate-900">Revenue Protection:</strong> Following up within 24 hours of an upcoming deadline increases on-time client payment rates by up to 64%.
                </span>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={onOpenNewFollowUp}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Invoice / Deal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
