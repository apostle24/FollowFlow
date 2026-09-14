import React, { useState } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { getDaysDiffFromToday } from '../../services/db';
import { trackEvent } from '../../services/analytics';
import {
  Sparkles,
  MessageSquare,
  Mail,
  CheckCircle2,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  AlertCircle,
  DollarSign,
  Calendar,
  Building,
  User,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { FollowUp, FollowUpPriority, FollowUpType } from '../../types';

interface FollowUpCardProps {
  followUp: FollowUp;
  onEdit?: (followUp: FollowUp) => void;
  onDelete?: (followUp: FollowUp) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (followUp: FollowUp) => void;
}

export const FollowUpCard: React.FC<FollowUpCardProps> = ({
  followUp,
  onEdit,
  onDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
}) => {
  const { openAiModal, markCompleted, snooze, contacts } = useFollowUp();
  const { success, error: toastError, info } = useToast();

  const [menuOpen, setMenuOpen] = useState(false);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customSnoozeDate, setCustomSnoozeDate] = useState('');

  const matchedContact = contacts.find((c) => c.id === followUp.contactId);
  const contactName = followUp.contactName || matchedContact?.name || 'Contact';
  const contactCompany = followUp.contactCompany || matchedContact?.company;
  const contactEmail = followUp.contactEmail || matchedContact?.email;
  const contactPhone = followUp.contactWhatsapp || followUp.contactPhone || matchedContact?.whatsapp || matchedContact?.phone;

  const daysDiff = getDaysDiffFromToday(followUp.dueDate);
  const isOverdue = daysDiff < 0;
  const isToday = daysDiff === 0;

  const priorityStyles: Record<FollowUpPriority, { bg: string; text: string; border: string }> = {
    urgent: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
    high: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    medium: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    low: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  };

  const typeLabels: Record<FollowUpType, string> = {
    proposal: 'Proposal',
    invoice: 'Invoice',
    lead: 'Lead',
    appointment: 'Appointment',
    customer: 'Customer',
    general: 'General',
  };

  const handleComplete = async () => {
    setLoadingAction(true);
    try {
      await markCompleted(followUp.id);
      success('Completed!', `Marked "${followUp.title}" as completed.`);
    } catch (err: any) {
      toastError('Failed to complete follow-up');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSnooze = async (days: number) => {
    setLoadingAction(true);
    setSnoozeMenuOpen(false);
    setShowCustomDatePicker(false);
    try {
      await snooze(followUp.id, days);
      info(`Snoozed for ${days} day${days > 1 ? 's' : ''}`);
    } catch (err: any) {
      toastError('Failed to snooze follow-up');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCustomDateSnooze = async () => {
    if (!customSnoozeDate) {
      toastError('Please select a valid date');
      return;
    }
    setLoadingAction(true);
    setSnoozeMenuOpen(false);
    setShowCustomDatePicker(false);
    try {
      await snooze(followUp.id, customSnoozeDate);
      info(`Snoozed until ${customSnoozeDate}`);
    } catch (err: any) {
      toastError('Failed to snooze follow-up');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleQuickWhatsApp = () => {
    if (!contactPhone) {
      // Open AI modal to let user add phone or copy text
      openAiModal(followUp, matchedContact);
      return;
    }
    const sanitizedNumber = contactPhone.replace(/[^0-9]/g, '');
    const prefill = encodeURIComponent(
      `Hi ${contactName}, following up regarding ${followUp.title}. Hope you're doing well!`
    );
    window.open(`https://wa.me/${sanitizedNumber}?text=${prefill}`, '_blank', 'noopener,noreferrer');
  };

  const handleQuickEmail = () => {
    openAiModal(followUp, matchedContact, {
      channel: 'email',
      subject: `Following up on ${followUp.title}`,
      message: `Hi ${contactName},\n\nI hope you're having a great week! Just following up regarding ${followUp.title}.\n\nLooking forward to hearing from you.`,
    });
  };

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all hover:shadow-md relative ${
        selected
          ? 'ring-2 ring-blue-600 border-blue-400 bg-blue-50/30 shadow-sm'
          : isOverdue
          ? 'border-rose-200 bg-rose-50/10'
          : isToday
          ? 'border-blue-200 bg-blue-50/10'
          : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left info column with optional selection checkbox */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {selectable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(followUp);
              }}
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 mt-0.5 ${
                selected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'border-slate-300 bg-white hover:border-blue-400 text-transparent hover:bg-slate-50'
              }`}
              title={selected ? 'Deselect item' : 'Select item'}
              aria-label={selected ? 'Deselect item' : 'Select item'}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}

          <div className="space-y-2 flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Due date status badge */}
            {isOverdue && (
              <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 border border-rose-200">
                <AlertCircle className="w-3 h-3" /> Overdue by {Math.abs(daysDiff)}d
              </span>
            )}
            {isToday && (
              <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 border border-blue-200">
                <Clock className="w-3 h-3" /> Due Today
              </span>
            )}
            {!isOverdue && !isToday && (
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" /> Due {followUp.dueDate}
              </span>
            )}

            {/* Priority Badge */}
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                priorityStyles[followUp.priority].bg
              } ${priorityStyles[followUp.priority].text} ${priorityStyles[followUp.priority].border}`}
            >
              {followUp.priority}
            </span>

            {/* Type Badge */}
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium">
              {typeLabels[followUp.type] || followUp.type}
            </span>

            {/* Amount Badge */}
            {followUp.amount !== undefined && followUp.amount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                ${followUp.amount.toLocaleString()}
              </span>
            )}

            {/* Status if Contacted or Snoozed */}
            {followUp.status === 'contacted' && (
              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-semibold">
                ✓ Contacted
              </span>
            )}
            {followUp.status === 'snoozed' && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                Snoozed
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-base font-bold text-slate-900 leading-snug break-words">
            {followUp.title}
          </h4>

          {/* Description snippet if present */}
          {followUp.description && (
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {followUp.description}
            </p>
          )}

          {/* Contact Details */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 pt-1">
            <span className="font-semibold text-slate-800 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {contactName}
            </span>
            {contactCompany && (
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                {contactCompany}
              </span>
            )}
            {contactPhone && (
              <span className="text-slate-500 font-mono text-[11px]">
                {contactPhone}
              </span>
            )}
            {contactEmail && (
              <span className="text-slate-500 truncate max-w-[180px]">
                {contactEmail}
              </span>
            )}
          </div>
        </div>
      </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 justify-between lg:justify-end">
          {/* AI Generator Trigger */}
          <button
            onClick={() => openAiModal(followUp, matchedContact)}
            className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center gap-1.5 transition-all"
            title="Generate custom message with AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Message</span>
          </button>

          {/* 1-Click WhatsApp */}
          <button
            onClick={handleQuickWhatsApp}
            className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1 transition-colors"
            title="Open WhatsApp chat"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* 1-Click Email */}
          <button
            onClick={handleQuickEmail}
            className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
            title="Open email composer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Email</span>
          </button>

          {/* Complete Button */}
          <button
            onClick={handleComplete}
            disabled={loadingAction}
            className="py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-600 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Mark as completed"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>

          {/* Snooze Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSnoozeMenuOpen(!snoozeMenuOpen)}
              className="py-2 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs transition-colors"
              title="Snooze"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            {snoozeMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-20 animate-in fade-in zoom-in-95 text-xs">
                <p className="px-2 py-1 font-bold text-[10px] text-slate-400 uppercase tracking-wider">Snooze until</p>
                <button
                  onClick={() => handleSnooze(1)}
                  className="w-full px-2 py-1.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg font-medium"
                >
                  Tomorrow (+1d)
                </button>
                <button
                  onClick={() => handleSnooze(3)}
                  className="w-full px-2 py-1.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg font-medium"
                >
                  In 3 Days
                </button>
                <button
                  onClick={() => handleSnooze(7)}
                  className="w-full px-2 py-1.5 text-left text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg font-medium"
                >
                  1 Week (+7d)
                </button>

                <div className="pt-2 mt-1 border-t border-slate-100">
                  <button
                    onClick={() => setShowCustomDatePicker(!showCustomDatePicker)}
                    className="w-full px-2 py-1 text-left text-slate-600 hover:text-blue-600 font-semibold text-[11px] flex items-center justify-between"
                  >
                    <span>Custom Date</span>
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {showCustomDatePicker && (
                    <div className="mt-1.5 space-y-1.5">
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={customSnoozeDate}
                        onChange={(e) => setCustomSnoozeDate(e.target.value)}
                        className="w-full text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-800 bg-slate-50"
                      />
                      <button
                        onClick={handleCustomDateSnooze}
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

          {/* More options menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-20 animate-in fade-in zoom-in-95 text-xs">
                {onEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(followUp);
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-100 font-medium flex items-center gap-2"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(followUp);
                    }}
                    className="w-full px-3 py-2 text-left text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
