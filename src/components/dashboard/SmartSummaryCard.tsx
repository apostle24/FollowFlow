import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { fetchSmartSummary } from '../../services/ai';
import type { SmartSummaryResult, SmartSummaryPriorityAction, FollowUp, Contact } from '../../types';
import {
  Sparkles,
  RefreshCw,
  Target,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Send,
  MessageSquare,
  Mail,
  Phone,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Clock,
  Flame,
  Zap,
} from 'lucide-react';

export const SmartSummaryCard: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    activeFollowUps,
    todayFollowUps,
    overdueFollowUps,
    contacts,
    openAiModal,
    markCompleted,
  } = useFollowUp();
  const { success, error: toastError, info } = useToast();

  const [summary, setSummary] = useState<SmartSummaryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [copiedHookIndex, setCopiedHookIndex] = useState<number | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  // Combine relevant pending items (today, overdue, or all active)
  const pendingItems = useMemo(() => {
    // If we have active follow-ups, use activeFollowUps
    return activeFollowUps || [];
  }, [activeFollowUps]);

  // Load smart summary
  const loadSummary = useCallback(
    async (forceRefresh = false) => {
      if (loading) return;

      // Check localStorage cache if not forcing refresh
      const cacheKey = `followflow_smart_summary_${userProfile?.uid || 'guest'}`;
      if (!forceRefresh && !hasLoadedOnce) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Cache valid for 30 minutes
            const cacheAge = Date.now() - new Date(parsed.generatedAt).getTime();
            if (cacheAge < 30 * 60 * 1000 && parsed.topActions) {
              setSummary(parsed);
              setHasLoadedOnce(true);
              return;
            }
          }
        } catch (e) {
          // ignore cache read failure
        }
      }

      setLoading(true);
      try {
        const res = await fetchSmartSummary({
          pendingFollowUps: pendingItems,
          contacts,
          userProfile: {
            displayName: userProfile?.displayName,
            email: userProfile?.email,
          },
        });

        if (res.summary) {
          setSummary(res.summary);
          setIsFallbackMode(Boolean(res.isFallback));
          setHasLoadedOnce(true);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res.summary));
          } catch (e) {
            // ignore storage quota errors
          }
          if (forceRefresh) {
            success('Smart Summary refreshed with latest priority analysis');
          }
        }
      } catch (err: any) {
        // Safe handling if network/endpoint was temporarily interrupted
        setHasLoadedOnce(true);
      } finally {
        setLoading(false);
      }
    },
    [loading, hasLoadedOnce, userProfile, pendingItems, contacts, success]
  );

  const hasTriggeredFetchRef = useRef<boolean>(false);

  // Auto-fetch on initial mount if not yet loaded
  useEffect(() => {
    if (!hasLoadedOnce && !hasTriggeredFetchRef.current && pendingItems.length > 0) {
      hasTriggeredFetchRef.current = true;
      loadSummary(false);
    }
  }, [hasLoadedOnce, pendingItems.length, loadSummary]);

  // Copy recommended message hook
  const handleCopyHook = (hook: string, index: number) => {
    navigator.clipboard.writeText(hook);
    setCopiedHookIndex(index);
    success('Message hook copied to clipboard');
    setTimeout(() => setCopiedHookIndex(null), 2500);
  };

  // Find matching followUp object
  const getMatchedFollowUp = (action: SmartSummaryPriorityAction): FollowUp | undefined => {
    if (action.id) {
      const match = pendingItems.find((f) => f.id === action.id);
      if (match) return match;
    }
    // Fallback match by contact name
    return pendingItems.find((f) => f.contactName === action.contactName);
  };

  // Find matching contact object
  const getMatchedContact = (action: SmartSummaryPriorityAction): Contact | undefined => {
    if (action.contactId) {
      const match = contacts.find((c) => c.id === action.contactId);
      if (match) return match;
    }
    return contacts.find((c) => c.name.toLowerCase() === action.contactName.toLowerCase());
  };

  // Handle action click: open AI modal
  const handleDraftMessage = (action: SmartSummaryPriorityAction) => {
    const matchedF = getMatchedFollowUp(action);
    const matchedC = getMatchedContact(action);
    openAiModal(matchedF, matchedC);
  };

  // Handle direct WhatsApp click
  const handleDirectWhatsApp = (action: SmartSummaryPriorityAction) => {
    const matchedF = getMatchedFollowUp(action);
    const matchedC = getMatchedContact(action);
    const phone = matchedF?.contactWhatsapp || matchedF?.contactPhone || matchedC?.whatsapp || matchedC?.phone;

    if (!phone) {
      info(`No WhatsApp number recorded for ${action.contactName}. Opening AI drafter instead.`);
      openAiModal(matchedF, matchedC);
      return;
    }

    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const message = action.recommendedMessageHook || `Hi ${action.contactName}, following up on our recent conversation.`;
    const url = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    success(`Opening WhatsApp for ${action.contactName}`);
  };

  // Handle direct Email click
  const handleDirectEmail = (action: SmartSummaryPriorityAction) => {
    const matchedF = getMatchedFollowUp(action);
    const matchedC = getMatchedContact(action);
    const email = matchedF?.contactEmail || matchedC?.email;

    if (!email) {
      info(`No email recorded for ${action.contactName}. Opening AI drafter instead.`);
      openAiModal(matchedF, matchedC);
      return;
    }

    const subject = `Follow up: ${action.actionTitle}`;
    const body = action.recommendedMessageHook || `Hi ${action.contactName},\n\nI hope you're having a great week! Just following up regarding ${action.actionTitle}.`;
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const link = document.createElement('a');
    link.href = mailto;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {}
    }, 200);
    success(`Opening email client for ${action.contactName}`);
  };

  // Handle quick complete
  const handleMarkComplete = async (action: SmartSummaryPriorityAction) => {
    const matched = getMatchedFollowUp(action);
    if (matched) {
      try {
        await markCompleted(matched.id);
        success(`Marked "${action.actionTitle}" as completed`);
        // Remove completed item from current view
        if (summary) {
          setSummary({
            ...summary,
            topActions: summary.topActions.filter((a) => a.id !== action.id),
          });
        }
      } catch (err) {
        toastError('Failed to mark follow-up as completed');
      }
    } else {
      info(`Follow-up "${action.actionTitle}" was already completed or updated.`);
    }
  };

  // Helper for rank badge styling
  const getRankBadgeStyle = (rank: number) => {
    if (rank === 1) {
      return {
        pill: 'bg-rose-500 text-white shadow-xs shadow-rose-500/20',
        cardBorder: 'border-rose-200 hover:border-rose-300 bg-gradient-to-br from-rose-50/40 via-white to-white',
        rankIcon: <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />,
        accentText: 'text-rose-700',
        badgeBg: 'bg-rose-100/80 text-rose-800 border-rose-200',
      };
    }
    if (rank === 2) {
      return {
        pill: 'bg-amber-500 text-slate-950 shadow-xs shadow-amber-500/20',
        cardBorder: 'border-amber-200 hover:border-amber-300 bg-gradient-to-br from-amber-50/40 via-white to-white',
        rankIcon: <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />,
        accentText: 'text-amber-800',
        badgeBg: 'bg-amber-100/80 text-amber-900 border-amber-200',
      };
    }
    return {
      pill: 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/20',
      cardBorder: 'border-indigo-200 hover:border-indigo-300 bg-gradient-to-br from-indigo-50/30 via-white to-white',
      rankIcon: <Target className="w-3.5 h-3.5 text-indigo-600" />,
      accentText: 'text-indigo-800',
      badgeBg: 'bg-indigo-100/80 text-indigo-800 border-indigo-200',
    };
  };

  return (
    <div
      id="smart-summary-container"
      className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/90 shadow-sm transition-all duration-300"
    >
      {/* Top Banner & Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 py-4 text-white sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-indigo-400 to-cyan-300 text-slate-950 shadow-md shadow-indigo-500/30">
              <Sparkles className="h-5 w-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Gemini Smart Summary
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      isFallbackMode
                        ? 'bg-amber-400/20 border-amber-400/30 text-amber-200'
                        : 'bg-indigo-500/30 border-indigo-400/30 text-indigo-200'
                    }`}
                  >
                    {isFallbackMode ? 'Priority Engine' : 'AI Prioritization'}
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Analyzes current pending follow-ups to pinpoint the 3 highest-revenue actions for today.
              </p>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              id="refresh-smart-summary-btn"
              onClick={() => loadSummary(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:opacity-50"
              title="Refresh analysis using current follow-up data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Analyzing...' : 'Refresh AI Analysis'}</span>
              <span className="sm:hidden">{loading ? '...' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
              aria-label={isCollapsed ? 'Expand Smart Summary' : 'Collapse Smart Summary'}
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Collapsed quick ticker summary */}
        {isCollapsed && summary && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-amber-300">Top Priority:</span>
              <span className="truncate">{summary.topActions[0]?.actionTitle || summary.headline}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
              <span>{summary.topActions.length} Priority Actions</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">
                ${summary.totalAtStake.toLocaleString()} Pipeline Focus
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Main Body */}
      {!isCollapsed && (
        <div className="p-5 sm:p-6 space-y-6">
          {/* Loading State */}
          {loading && !summary && (
            <div className="py-12 px-4 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3 animate-pulse">
                <Sparkles className="h-6 w-6 animate-spin" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Gemini is analyzing your pending follow-ups...
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Evaluating overdue invoices, proposal velocity, deal amounts, and contact timing to identify your top 3 priority actions.
              </p>
            </div>
          )}

          {/* Empty / Zero Pending Follow-Ups State */}
          {!loading && pendingItems.length === 0 && (
            <div className="py-8 px-4 text-center rounded-2xl bg-slate-50 border border-slate-100">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">All caught up! Zero pending follow-ups</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                There are no active or overdue follow-ups waiting right now. Create a new follow-up or add a contact to let Gemini prioritize your next actions.
              </p>
            </div>
          )}

          {/* Active Summary Content */}
          {summary && pendingItems.length > 0 && (
            <>
              {/* Executive Briefing Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-indigo-100/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Executive Briefing
                    </span>
                    <span className="text-[10px] text-slate-400">
                      • {new Date(summary.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {summary.headline}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    {summary.overview}
                  </p>
                </div>

                {/* Pipeline value metric badge */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Pipeline Focus
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-black text-slate-900">
                      ${summary.totalAtStake.toLocaleString()}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-indigo-600 mt-0.5">
                    {summary.totalPendingCount} pending item{summary.totalPendingCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              {/* Section Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Top 3 Priority Actions for Today
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Ranked by revenue risk, deadline sensitivity, and conversion probability.
                  </p>
                </div>
              </div>

              {/* TOP 3 ACTION CARDS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {summary.topActions.map((action, index) => {
                  const style = getRankBadgeStyle(action.rank);
                  const matchedF = getMatchedFollowUp(action);
                  const matchedC = getMatchedContact(action);

                  return (
                    <div
                      key={action.id || `action-${index}`}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all duration-200 shadow-2xs hover:shadow-md ${style.cardBorder}`}
                    >
                      {/* Card Header: Rank & Badges */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${style.pill}`}
                            >
                              #{action.rank}
                            </span>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Priority {action.rank}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style.badgeBg}`}
                          >
                            {style.rankIcon}
                            {action.badge}
                          </span>
                        </div>

                        {/* Contact Name & Company */}
                        <div className="mb-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <h5 className="text-sm font-extrabold text-slate-900 truncate">
                              {action.contactName}
                            </h5>
                            {action.financialImpact && (
                              <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md shrink-0">
                                {action.financialImpact}
                              </span>
                            )}
                          </div>
                          {action.contactCompany && (
                            <p className="text-[11px] font-medium text-slate-500 truncate">
                              {action.contactCompany}
                            </p>
                          )}
                        </div>

                        {/* Action Title */}
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs mb-3">
                          <p className="text-xs font-bold text-slate-800 leading-snug">
                            {action.actionTitle}
                          </p>
                        </div>

                        {/* Strategic Reason (Why this is priority #1, 2, or 3) */}
                        <div className="mb-3">
                          <div className="flex items-start gap-1.5 text-xs text-slate-600 bg-slate-100/70 p-2.5 rounded-xl border border-slate-200/50">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] leading-relaxed text-slate-600">
                              <strong className="text-slate-800 font-semibold">Why now: </strong>
                              {action.reason}
                            </p>
                          </div>
                        </div>

                        {/* Recommended Message Hook / Snippet */}
                        {action.recommendedMessageHook && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Suggested Hook
                              </span>
                              <button
                                onClick={() => handleCopyHook(action.recommendedMessageHook!, index)}
                                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                              >
                                {copiedHookIndex === index ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy hook</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100/60 text-[11px] italic text-slate-700 font-serif">
                              "{action.recommendedMessageHook}"
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-slate-200/70 space-y-2 mt-auto">
                        {/* Primary Button: Draft with AI */}
                        <button
                          onClick={() => handleDraftMessage(action)}
                          className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          Draft Message with AI
                          <ArrowRight className="w-3 h-3 ml-auto opacity-70" />
                        </button>

                        {/* Secondary Actions: Direct Channel Outreach & Quick Done */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {/* Channel direct action */}
                          {action.channel === 'whatsapp' ? (
                            <button
                              onClick={() => handleDirectWhatsApp(action)}
                              className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold border border-emerald-200 flex items-center justify-center gap-1 transition-all"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-600" />
                              WhatsApp
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDirectEmail(action)}
                              className="py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold border border-blue-200 flex items-center justify-center gap-1 transition-all"
                            >
                              <Mail className="w-3 h-3 text-blue-600" />
                              Email
                            </button>
                          )}

                          {/* Mark Done button */}
                          <button
                            onClick={() => handleMarkComplete(action)}
                            className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-600 text-[11px] font-semibold border border-slate-200 flex items-center justify-center gap-1 transition-all"
                            title="Mark this priority item complete"
                          >
                            <CheckCircle2 className="w-3 h-3 text-slate-500 group-hover:text-emerald-600" />
                            Mark Done
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tactical Advice Footer Bar */}
              {summary.tacticalAdvice && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-900">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Lightbulb className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                  </div>
                  <div className="text-xs">
                    <strong className="font-bold text-amber-950">Gemini Sales Execution Tip: </strong>
                    <span className="text-amber-900/90">{summary.tacticalAdvice}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
