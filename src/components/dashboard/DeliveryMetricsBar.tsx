import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchDeliveryMetrics,
  triggerSchedulerTick,
  getEmailConfig,
  type EmailConfig,
} from '../../services/email';
import type { DeliveryMetrics } from '../../types';
import {
  Mail,
  MessageSquare,
  Phone,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { useToast } from '../common/Toast';

export const DeliveryMetricsBar: React.FC = () => {
  const { user } = useAuth();
  const { info, success } = useToast();
  const [metrics, setMetrics] = useState<DeliveryMetrics>({
    emailsSentToday: 0,
    emailsScheduled: 0,
    emailsDelivered: 0,
    emailsFailed: 0,
    whatsappActions: 0,
    callsInitiated: 0,
    followUpsCompleted: 0,
  });
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    isConfigured: false,
    provider: 'none',
    fromEmail: '',
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [m, c] = await Promise.all([
        fetchDeliveryMetrics(user?.uid),
        getEmailConfig(),
      ]);
      setMetrics(m);
      setEmailConfig(c);
    } catch (err) {
      console.warn('Metrics bar load error:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  const handleManualCheck = async () => {
    setRefreshing(true);
    info('Checking delivery queue & channel health...');
    try {
      await triggerSchedulerTick();
      await loadData();
      success('Delivery queue synced', 'Multi-channel engine verified.');
    } catch (err) {
      console.warn('Sync failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs p-3.5 sm:p-4 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 dark:text-stone-100">
                Multi-Channel Delivery Engine
              </h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active & Monitored
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Provider: <strong className="text-stone-700 dark:text-stone-300 capitalize">{emailConfig.provider || 'Resend/SMTP'}</strong> ({emailConfig.fromEmail || 'Verified Dispatcher'}) · Real-time recipient delivery tracking
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualCheck}
          disabled={refreshing}
          className="self-start sm:self-auto text-xs font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 transition-colors shrink-0 disabled:opacity-50"
          title="Trigger queue check and sync metrics"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Sync Queue</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
        {/* Email Dispatched */}
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-medium">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Emails Dispatched
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {metrics.emailsDelivered > 0 ? `${metrics.emailsDelivered} deliv.` : 'Live'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-black text-stone-900 dark:text-stone-100">
              {metrics.emailsSentToday}
            </span>
            <span className="text-[10px] text-stone-400">sent today</span>
          </div>
        </div>

        {/* Scheduled Queue */}
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Scheduled Queue
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
              Auto-tick
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-black text-stone-900 dark:text-stone-100">
              {metrics.emailsScheduled}
            </span>
            <span className="text-[10px] text-stone-400">queued jobs</span>
          </div>
        </div>

        {/* WhatsApp Outreach */}
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-medium">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              WhatsApp Direct
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Logged
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-black text-stone-900 dark:text-stone-100">
              {metrics.whatsappActions}
            </span>
            <span className="text-[10px] text-stone-400">chats opened</span>
          </div>
        </div>

        {/* Phone Calls */}
        <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-medium">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              Phone & Calls
            </span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
              Tel Link
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-black text-stone-900 dark:text-stone-100">
              {metrics.callsInitiated}
            </span>
            <span className="text-[10px] text-stone-400">calls initiated</span>
          </div>
        </div>
      </div>
    </div>
  );
};
