import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Clock,
  Sparkles,
  Filter,
  Download,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  Send,
  Users,
  Layers,
  ChevronRight,
  Info,
  FileText,
  ShieldCheck,
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
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { generateAnalyticsRecommendations, type RecommendationItem } from '../../services/ai';
import { generateRevenuePdfReport } from '../../services/exportPdf';
import type { Contact, FollowUp, FollowUpChannel, FollowUpType } from '../../types';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export const AnalyticsView: React.FC = () => {
  const { followUps, contacts, sequences, sequenceEnrollments, stats } = useFollowUp();
  const { user, userProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'ytd' | 'all'>('30d');
  const [contactTypeFilter, setContactTypeFilter] = useState<string>('all');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);

  // Filter follow-ups by date and contact type
  const filteredFollowUps = useMemo(() => {
    const now = new Date();
    let cutoffDays = 30;
    if (dateRange === '7d') cutoffDays = 7;
    if (dateRange === '30d') cutoffDays = 30;
    if (dateRange === '90d') cutoffDays = 90;
    if (dateRange === 'ytd') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      cutoffDays = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    }
    if (dateRange === 'all') cutoffDays = 3650;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return followUps.filter((f) => {
      // Date filter
      const fDate = f.completedAt || f.dueDate || f.createdAt;
      if (fDate < cutoffStr) return false;

      // Contact type filter
      if (contactTypeFilter !== 'all') {
        const c = contacts.find((item) => item.id === f.contactId);
        if (contactTypeFilter === 'lead' && f.type !== 'lead' && !c?.tags?.includes('Lead')) return false;
        if (contactTypeFilter === 'proposal' && f.type !== 'proposal' && !c?.tags?.includes('Proposal')) return false;
        if (contactTypeFilter === 'invoice' && f.type !== 'invoice' && !c?.tags?.includes('Invoice')) return false;
        if (contactTypeFilter === 'vip' && !c?.tags?.includes('VIP')) return false;
      }

      return true;
    });
  }, [followUps, contacts, dateRange, contactTypeFilter]);

  // Metric Computations
  const totalFollowUps = filteredFollowUps.length;
  const completedFollowUps = filteredFollowUps.filter((f) => f.status === 'completed');
  const activeFollowUps = filteredFollowUps.filter((f) => f.status === 'pending' || f.status === 'contacted');
  const overdueFollowUps = filteredFollowUps.filter((f) => {
    const today = new Date().toISOString().split('T')[0];
    return (f.status === 'pending' || f.status === 'contacted') && f.dueDate < today;
  });

  const overallSuccessRate = totalFollowUps > 0 ? Math.round((completedFollowUps.length / totalFollowUps) * 100) : 0;

  // Money waiting vs recovered
  const moneyWaiting = activeFollowUps.reduce((acc, f) => acc + (f.amount || 0), 0);
  const moneyRecovered = completedFollowUps.reduce((acc, f) => acc + (f.amount || 0), 0);
  const moneyAtRisk = overdueFollowUps.reduce((acc, f) => acc + (f.amount || 0), 0);
  const lostRevenuePrevented = moneyRecovered;

  // Follow-up Consistency Score (0-100% based on non-overdue execution rate)
  const consistencyScore = useMemo(() => {
    if (totalFollowUps === 0) return 100;
    const nonOverdueCount = totalFollowUps - overdueFollowUps.length;
    return Math.max(0, Math.min(100, Math.round((nonOverdueCount / totalFollowUps) * 100)));
  }, [totalFollowUps, overdueFollowUps.length]);

  // Avg days to close
  const avgDaysToClose = useMemo(() => {
    const closedWithDates = completedFollowUps.filter((f) => f.createdAt && f.completedAt);
    if (closedWithDates.length === 0) return 0;
    const totalDays = closedWithDates.reduce((acc, f) => {
      const created = new Date(f.createdAt).getTime();
      const completed = new Date(f.completedAt!).getTime();
      const diffDays = Math.max(1, Math.round((completed - created) / (1000 * 60 * 60 * 24)));
      return acc + diffDays;
    }, 0);
    return Math.round((totalDays / closedWithDates.length) * 10) / 10;
  }, [completedFollowUps]);

  // Channel Conversion Breakdown
  const channelData = useMemo(() => {
    const channels: FollowUpChannel[] = ['whatsapp', 'email', 'sms', 'phone'];
    return channels.map((ch) => {
      const chFollowUps = filteredFollowUps.filter((f) => f.channel === ch);
      const chCompleted = chFollowUps.filter((f) => f.status === 'completed');
      const convRate = chFollowUps.length > 0 ? Math.round((chCompleted.length / chFollowUps.length) * 100) : 0;
      const revenue = chCompleted.reduce((acc, f) => acc + (f.amount || 0), 0);

      const labelMap: Record<string, string> = {
        whatsapp: 'WhatsApp',
        email: 'Email',
        sms: 'SMS',
        phone: 'Phone Call',
      };

      return {
        name: labelMap[ch] || ch,
        total: chFollowUps.length,
        completed: chCompleted.length,
        conversionRate: convRate,
        revenue,
      };
    });
  }, [filteredFollowUps]);

  // Deal Type / Average Time to Close
  const dealTypeData = useMemo(() => {
    const types: FollowUpType[] = ['proposal', 'invoice', 'lead', 'customer', 'appointment'];
    const labelMap: Record<string, string> = {
      proposal: 'Proposals',
      invoice: 'Invoices',
      lead: 'New Leads',
      customer: 'Retainers',
      appointment: 'Meetings',
    };

    return types.map((t) => {
      const subset = filteredFollowUps.filter((f) => f.type === t);
      const won = subset.filter((f) => f.status === 'completed');
      const rate = subset.length > 0 ? Math.round((won.length / subset.length) * 100) : 0;
      const waiting = subset
        .filter((f) => f.status === 'pending' || f.status === 'contacted')
        .reduce((sum, f) => sum + (f.amount || 0), 0);

      // Real avg days calculated from completed deals
      const typeClosed = won.filter((f) => f.createdAt && f.completedAt);
      const avgDays = typeClosed.length > 0
        ? Math.round(
            (typeClosed.reduce((sum, f) => {
              const created = new Date(f.createdAt).getTime();
              const completed = new Date(f.completedAt!).getTime();
              return sum + Math.max(1, Math.round((completed - created) / (1000 * 60 * 60 * 24)));
            }, 0) /
              typeClosed.length) *
              10
          ) / 10
        : 0;

      return {
        type: labelMap[t] || t,
        total: subset.length,
        won: won.length,
        successRate: rate,
        avgDays,
        moneyWaiting: waiting,
      };
    });
  }, [filteredFollowUps]);

  // Money waiting breakdown by category (for Donut Chart)
  const categoryMoneyData = useMemo(() => {
    const map: Record<string, number> = {};
    activeFollowUps.forEach((f) => {
      const typeKey = f.type || 'general';
      map[typeKey] = (map[typeKey] || 0) + (f.amount || 0);
    });

    const labelMap: Record<string, string> = {
      proposal: 'Proposals',
      invoice: 'Unpaid Invoices',
      lead: 'Lead Pipeline',
      customer: 'Customer Upgrades',
      appointment: 'Bookings',
      general: 'General Tasks',
    };

    return Object.entries(map)
      .map(([key, val]) => ({
        name: labelMap[key] || key,
        value: val,
      }))
      .filter((item) => item.value > 0);
  }, [activeFollowUps]);

  // Success Trend over Time (Real user timeline without artificial baselines)
  const trendData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (completedFollowUps.length === 0 && activeFollowUps.length === 0) {
      return days.map((day) => ({ day, completed: 0, active: 0, successRate: 0 }));
    }
    return days.map((day, idx) => {
      const dayCompleted = completedFollowUps.filter((f) => {
        if (!f.completedAt) return false;
        const d = new Date(f.completedAt).getDay();
        const mappedIdx = d === 0 ? 6 : d - 1;
        return mappedIdx === idx;
      }).length;
      const dayActive = activeFollowUps.filter((f) => {
        if (!f.dueDate) return false;
        const d = new Date(f.dueDate).getDay();
        const mappedIdx = d === 0 ? 6 : d - 1;
        return mappedIdx === idx;
      }).length;
      const totalDay = dayCompleted + dayActive;
      const successRate = totalDay > 0 ? Math.round((dayCompleted / totalDay) * 100) : 0;
      return {
        day,
        completed: dayCompleted,
        active: dayActive,
        successRate,
      };
    });
  }, [completedFollowUps, activeFollowUps]);

  // Fetch AI Strategic Insights
  const fetchAiRecommendations = async () => {
    setIsLoadingRecommendations(true);
    try {
      const topCh = channelData.sort((a, b) => b.conversionRate - a.conversionRate)[0]?.name || 'WhatsApp';
      const res = await generateAnalyticsRecommendations({
        totalFollowUps,
        completedCount: completedFollowUps.length,
        successRate: overallSuccessRate,
        avgDaysToClose,
        moneyWaiting,
        moneyRecovered,
        moneyAtRisk,
        topChannel: topCh,
        overdueCount: overdueFollowUps.length,
      });

      if (res.success && res.recommendations?.length) {
        setRecommendations(res.recommendations);
        success('AI Generated Strategic Recommendations!');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to generate recommendations');
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    // Initial load recommendations
    fetchAiRecommendations();
  }, []);

  const handleExportCSV = () => {
    const headers = ['FollowUp Title', 'Contact', 'Type', 'Channel', 'Amount', 'Status', 'Due Date'];
    const rows = filteredFollowUps.map((f) => [
      `"${f.title.replace(/"/g, '""')}"`,
      `"${f.contactName.replace(/"/g, '""')}"`,
      f.type,
      f.channel,
      f.amount || 0,
      f.status,
      f.dueDate,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `followflow_analytics_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Exported analytics data to CSV');
  };

  const handleExportPDF = () => {
    const rangeLabels: Record<string, string> = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 90 Days',
      'ytd': 'Year to Date',
      'all': 'All Time',
    };

    const catLabels: Record<string, string> = {
      'all': 'All Contacts & Categories',
      'lead': 'Leads Only',
      'proposal': 'Proposals Only',
      'invoice': 'Invoices Only',
      'vip': 'VIPs Only',
    };

    generateRevenuePdfReport({
      reportDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dateRangeLabel: rangeLabels[dateRange] || dateRange,
      categoryFilterLabel: catLabels[contactTypeFilter] || contactTypeFilter,
      totalFollowUps,
      completedFollowUps: completedFollowUps.length,
      overallSuccessRate,
      moneyWaiting,
      moneyRecovered,
      moneyAtRisk,
      avgDaysToClose,
      categoryBreakdown: categoryMoneyData,
      channelBreakdown: channelData,
      activeDeals: filteredFollowUps,
      userEmail: user?.email || undefined,
      userName: userProfile?.displayName || undefined,
    });

    success('Generated Revenue PDF report for financial record-keeping.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Advanced Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time pipeline performance, conversion rates by channel, and AI recommendations
          </p>
        </div>

        {/* Global Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="text-xs font-bold text-slate-700 bg-transparent pr-2 py-1 outline-hidden cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="ytd">Year to Date</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Contact Type Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={contactTypeFilter}
              onChange={(e) => setContactTypeFilter(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent pr-2 py-1 outline-hidden cursor-pointer"
            >
              <option value="all">All Contacts</option>
              <option value="lead">Leads Only</option>
              <option value="proposal">Proposals Only</option>
              <option value="invoice">Invoices Only</option>
              <option value="vip">VIPs Only</option>
            </select>
          </div>

          {/* CSV Export */}
          <button
            onClick={handleExportCSV}
            className="py-2 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5"
            title="Download CSV Report"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            CSV
          </button>

          {/* PDF Financial Report Export */}
          <button
            onClick={handleExportPDF}
            className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs shadow-blue-200 transition-all flex items-center gap-1.5"
            title="Export official financial record PDF"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
            Export PDF Report
          </button>
        </div>
      </div>

      {/* KPI HERO CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Success Rate */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Follow-Up Success Rate
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{overallSuccessRate}%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {completedFollowUps.length} converted out of {totalFollowUps} total
          </p>
        </div>

        {/* 2. Revenue Closed / Recovered */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Revenue Recovered / Won
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">${moneyRecovered.toLocaleString()}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> Won
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            From closed follow-ups in this period
          </p>
        </div>

        {/* 3. Lost Revenue Prevented */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
              Lost Revenue Prevented
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-teal-700">${lostRevenuePrevented.toLocaleString()}</span>
            <span className="text-xs font-bold text-teal-600 flex items-center">
              Saved
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Prevented from slipping through cracks
          </p>
        </div>

        {/* 4. Follow-up Consistency Score */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
              Consistency Score
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Target className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-900">{consistencyScore}/100</span>
            <span className="text-xs font-bold text-indigo-600 flex items-center">
              {consistencyScore >= 80 ? 'Excellent' : consistencyScore >= 50 ? 'Good' : 'Needs Focus'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Based on on-time cadence vs overdue items
          </p>
        </div>

        {/* 5. Money Waiting */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Money Waiting in Pipeline
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600">${moneyWaiting.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {activeFollowUps.length} active proposals & invoices
          </p>
        </div>

        {/* 6. Avg Days to Close */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Average Time to Close
            </span>
            <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{avgDaysToClose}</span>
            <span className="text-sm font-bold text-slate-500">Days</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            From first contact to final agreement
          </p>
        </div>
      </div>

      {/* AI STRATEGIC RECOMMENDATIONS SECTION */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/30 text-indigo-300 flex items-center justify-center border border-indigo-400/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                AI Strategic Insights & Revenue Recommendations
              </h3>
              <p className="text-xs text-indigo-200">
                Actionable optimizations based on your current response speed and channel metrics
              </p>
            </div>
          </div>

          <button
            onClick={fetchAiRecommendations}
            disabled={isLoadingRecommendations}
            className="py-1.5 px-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-bold border border-indigo-400/40 transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isLoadingRecommendations ? 'animate-spin' : ''}`} />
            {isLoadingRecommendations ? 'Analyzing...' : 'Refresh AI Insights'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {recommendations.length === 0 ? (
            <div className="col-span-3 py-6 text-center text-xs text-indigo-200">
              Loading AI optimizations...
            </div>
          ) : (
            recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 hover:border-indigo-400/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        rec.impact === 'High'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : rec.impact === 'Quick Win'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {rec.impact} Impact
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1.5 leading-snug">{rec.title}</h4>
                  <p className="text-[11px] text-indigo-100/80 leading-relaxed">{rec.description}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] font-bold text-indigo-300">
                  <span>{rec.actionText}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Conversion Rate by Channel */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Conversion Rate by Channel (%)</h3>
              <p className="text-xs text-slate-500">Comparison of deal win rates across messaging channels</p>
            </div>
            {(() => {
              const bestChannel = [...channelData].sort((a, b) => b.conversionRate - a.conversionRate)[0];
              if (!bestChannel || bestChannel.conversionRate === 0) return null;
              return (
                <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                  Top: {bestChannel.name} ({bestChannel.conversionRate}%)
                </span>
              );
            })()}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Conversion Rate']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="conversionRate" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Follow-up Success Trend */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Success Rate Trend Over Time</h3>
              <p className="text-xs text-slate-500">Progressive response rate by cadence day</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Success Rate']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="successRate" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSuccess)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Average Time to Close Deals by Type */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Average Days to Close by Deal Category</h3>
              <p className="text-xs text-slate-500">Turnaround speed from initial follow-up to payment/won</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dealTypeData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" unit="d" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis dataKey="type" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} days`, 'Avg Close Time']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="avgDays" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Money Waiting Pipeline Breakdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Money Waiting Breakdown</h3>
              <p className="text-xs text-slate-500">Total pipeline distribution across deal stages</p>
            </div>
            <span className="text-xs font-bold text-slate-900">${moneyWaiting.toLocaleString()} Total</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {categoryMoneyData.length === 0 ? (
              <p className="text-xs text-slate-400">No active pipeline deals with amounts</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryMoneyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryMoneyData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Pipeline Value']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(val) => <span className="text-xs font-semibold text-slate-600">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
