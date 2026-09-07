import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  Calendar,
  DollarSign,
  MessageCircle,
  Mail,
  ArrowRight,
  ArrowLeft,
  Clock,
  Zap,
  Building,
  Check,
} from 'lucide-react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import type { FollowUp } from '../../types';

export const RapidFollowUpSessionModal: React.FC = () => {
  const {
    followUpSessionOpen,
    closeFollowUpSession,
    sessionIndex,
    sessionQueue,
    completeSessionItem,
    snoozeSessionItem,
    nextSessionItem,
    prevSessionItem,
    openAiModal,
    contacts,
  } = useFollowUp();
  const { success, error: toastError } = useToast();
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customSnoozeDate, setCustomSnoozeDate] = useState('');

  if (!followUpSessionOpen) return null;

  const currentItem: FollowUp | undefined = sessionQueue[sessionIndex];
  const matchedContact = currentItem
    ? contacts.find((c) => c.id === currentItem.contactId)
    : null;

  const totalItems = sessionQueue.length;
  const progressPercent = totalItems > 0 ? Math.round(((sessionIndex + 1) / totalItems) * 100) : 100;

  const handleWhatsApp = () => {
    if (!currentItem) return;
    const phone = matchedContact?.whatsapp || matchedContact?.phone || '';
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const text = encodeURIComponent(
      `Hi ${currentItem.contactName}, following up regarding ${currentItem.title}.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleEmail = () => {
    if (!currentItem) return;
    const email = matchedContact?.email || '';
    const subject = encodeURIComponent(`Following up: ${currentItem.title}`);
    const body = encodeURIComponent(
      `Hi ${currentItem.contactName},\n\nI'm checking in regarding ${currentItem.title}.\n\nBest regards`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCompleteCurrent = async () => {
    if (!currentItem) return;
    await completeSessionItem(currentItem.id);
    success('Completed!', `Follow-up for ${currentItem.contactName} marked done.`);
    if (sessionIndex >= sessionQueue.length - 1) {
      if (sessionQueue.length <= 1) {
        closeFollowUpSession();
      } else {
        prevSessionItem();
      }
    }
  };

  const handleSnoozeCurrent = async (days: number) => {
    if (!currentItem) return;
    await snoozeSessionItem(currentItem.id, days);
    setSnoozeMenuOpen(false);
    setShowCustomDatePicker(false);
    success('Snoozed', `Moved ${days} day${days > 1 ? 's' : ''} ahead.`);
    if (sessionIndex >= sessionQueue.length - 1) {
      if (sessionQueue.length <= 1) {
        closeFollowUpSession();
      } else {
        prevSessionItem();
      }
    }
  };

  const handleCustomDateSnoozeCurrent = async () => {
    if (!currentItem) return;
    if (!customSnoozeDate) {
      toastError('Please select a valid date');
      return;
    }
    await snoozeSessionItem(currentItem.id, customSnoozeDate);
    setSnoozeMenuOpen(false);
    setShowCustomDatePicker(false);
    success('Snoozed', `Moved to ${customSnoozeDate}.`);
    if (sessionIndex >= sessionQueue.length - 1) {
      if (sessionQueue.length <= 1) {
        closeFollowUpSession();
      } else {
        prevSessionItem();
      }
    }
  };

  return (
    <div
      id="rapid-session-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-xl w-full p-6 sm:p-8 text-stone-900 dark:text-stone-100 relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Zap className="w-4 h-4 fill-amber-500/20" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Rapid Follow-Up Session</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Item {totalItems > 0 ? sessionIndex + 1 : 0} of {totalItems} in priority queue
              </p>
            </div>
          </div>
          <button
            onClick={closeFollowUpSession}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full my-4 overflow-hidden">
          <div
            className="bg-amber-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {totalItems === 0 || !currentItem ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">
                All Caught Up!
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mx-auto mt-1">
                You have cleared all overdue and today&apos;s follow-ups. Great momentum!
              </p>
            </div>
            <button
              onClick={closeFollowUpSession}
              className="px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold hover:bg-stone-800 dark:hover:bg-white transition-colors shadow-sm"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Contact & Deal Card */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                    {currentItem.contactName}
                  </h4>
                  {currentItem.contactCompany && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                      <Building className="w-3.5 h-3.5" />
                      {currentItem.contactCompany}
                    </p>
                  )}
                </div>

                {currentItem.amount && (
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {currentItem.currency || '$'}{currentItem.amount.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider">Revenue at stake</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-stone-700 dark:text-stone-300">
                    Objective: {currentItem.title}
                  </span>
                  {currentItem.description && (
                    <p className="text-stone-500 dark:text-stone-400 mt-0.5 text-xs">
                      {currentItem.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-stone-400 whitespace-nowrap pl-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Due: {currentItem.dueDate}</span>
                </div>
              </div>
            </div>

            {/* Quick Outreach Actions */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={handleWhatsApp}
                className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-stone-800 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-xs font-semibold text-stone-800 dark:text-stone-200 flex flex-col items-center gap-1.5 transition-all group"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>1-Click WhatsApp</span>
              </button>

              <button
                onClick={handleEmail}
                className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-stone-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 text-xs font-semibold text-stone-800 dark:text-stone-200 flex flex-col items-center gap-1.5 transition-all group"
              >
                <Mail className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span>1-Click Email</span>
              </button>

              <button
                onClick={() => {
                  closeFollowUpSession();
                  openAiModal(currentItem, matchedContact || undefined);
                }}
                className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 hover:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold text-amber-800 dark:text-amber-300 flex flex-col items-center gap-1.5 transition-all group"
              >
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                <span>AI Message Draft</span>
              </button>
            </div>

            {/* Resolution Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevSessionItem}
                  disabled={sessionIndex === 0}
                  className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setSnoozeMenuOpen(!snoozeMenuOpen)}
                    className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Snooze
                  </button>

                  {snoozeMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl shadow-xl p-2 z-50 text-xs space-y-1">
                      <p className="px-2 py-1 font-bold text-[10px] text-stone-400 uppercase tracking-wider">Snooze until</p>
                      <button
                        onClick={() => handleSnoozeCurrent(1)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium"
                      >
                        Tomorrow (+1d)
                      </button>
                      <button
                        onClick={() => handleSnoozeCurrent(3)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium"
                      >
                        In 3 Days
                      </button>
                      <button
                        onClick={() => handleSnoozeCurrent(7)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium"
                      >
                        1 Week (+7d)
                      </button>

                      <div className="pt-2 mt-1 border-t border-stone-100 dark:border-stone-700">
                        <button
                          onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                          className="w-full px-2 py-1 text-left text-stone-600 dark:text-stone-300 hover:text-blue-600 font-semibold text-[11px] flex items-center justify-between"
                        >
                          <span>Custom Date</span>
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        </button>
                        {showCustomDatePicker && (
                          <div className="mt-1.5 space-y-1.5">
                            <input
                              type="date"
                              min={new Date().toISOString().split('T')[0]}
                              value={customSnoozeDate}
                              onChange={(e) => setCustomSnoozeDate(e.target.value)}
                              className="w-full text-xs px-2 py-1 border border-stone-200 dark:border-stone-700 rounded-lg text-stone-800 dark:text-stone-100 bg-stone-50 dark:bg-stone-900"
                            />
                            <button
                              onClick={handleCustomDateSnoozeCurrent}
                              disabled={!customSnoozeDate}
                              className="w-full py-1 px-2 rounded-lg bg-blue-600 text-white font-bold text-[11px] disabled:opacity-50 hover:bg-blue-700 transition-colors"
                            >
                              Set Snooze
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={nextSessionItem}
                  disabled={sessionIndex >= sessionQueue.length - 1}
                  className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1 transition-colors disabled:opacity-40"
                >
                  Skip
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleCompleteCurrent}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Sent / Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
