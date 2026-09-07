import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarPlus,
  X,
  Database,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { ProposedAction } from '../../types';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  action: ProposedAction | null;
  processing: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  action,
  processing,
}) => {
  if (!isOpen || !action) return null;

  const getActionBadge = () => {
    switch (action.type) {
      case 'create_followup':
        return {
          icon: <CalendarPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          label: 'Create Follow-Up',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        };
      case 'snooze_followup':
        return {
          icon: <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          label: 'Snooze Follow-Up',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        };
      case 'complete_followup':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          label: 'Mark as Completed',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        };
      default:
        return {
          icon: <Database className="w-4 h-4 text-stone-600 dark:text-stone-400" />,
          label: 'Database Modification',
          badgeClass: 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
        };
    }
  };

  const badge = getActionBadge();
  const payload = action.payload || {};

  return (
    <div
      id="flow-action-confirmation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flow-confirm-title"
    >
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 id="flow-confirm-title" className="font-semibold text-stone-900 dark:text-stone-100 text-base">
                Approve Database Action
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Explicit confirmation required before saving changes
              </p>
            </div>
          </div>
          <button
            id="flow-confirm-close-btn"
            onClick={onClose}
            disabled={processing}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 text-sm text-stone-700 dark:text-stone-300">
          {/* Action Type Badge */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${badge.badgeClass}`}>
              {badge.icon}
              <span>{badge.label}</span>
            </div>
            <span className="text-xs text-stone-400 flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              Direct write operation
            </span>
          </div>

          {/* Action Overview Card */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 space-y-3">
            <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
              {action.title}
            </h4>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {action.summary}
            </p>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-700/60 grid grid-cols-2 gap-3 text-xs">
              {payload.contactName && (
                <div>
                  <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium">
                    Contact
                  </span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {payload.contactName}
                    {payload.company ? ` (${payload.company})` : ''}
                  </span>
                </div>
              )}

              {payload.amount && (
                <div>
                  <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium">
                    Financial Value
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {payload.currency || '$'}{Number(payload.amount).toLocaleString()}
                  </span>
                </div>
              )}

              {payload.dueDate && (
                <div>
                  <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium">
                    Due Date
                  </span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {payload.dueDate}
                  </span>
                </div>
              )}

              {payload.days && (
                <div>
                  <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium">
                    Snooze Duration
                  </span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    +{payload.days} days
                  </span>
                </div>
              )}

              {payload.channel && (
                <div>
                  <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium">
                    Preferred Channel
                  </span>
                  <span className="font-semibold capitalize text-stone-800 dark:text-stone-200">
                    {payload.channel}
                  </span>
                </div>
              )}

              {payload.priority && (
                <div>
                  <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium">
                    Priority
                  </span>
                  <span className="font-semibold capitalize text-stone-800 dark:text-stone-200">
                    {payload.priority}
                  </span>
                </div>
              )}
            </div>

            {payload.description && (
              <div className="pt-2 border-t border-stone-200 dark:border-stone-700/60 text-xs">
                <span className="text-stone-400 block text-[11px] uppercase tracking-wider font-medium mb-1">
                  Task Notes
                </span>
                <p className="text-stone-600 dark:text-stone-300 italic bg-white dark:bg-stone-900/60 p-2.5 rounded-lg border border-stone-200 dark:border-stone-800">
                  "{payload.description}"
                </p>
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Approving this action will write changes directly to your FollowFlow workspace. You can edit or revert it anytime from the Follow-Ups view.
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-900/50 flex items-center justify-end gap-3">
          <button
            id="flow-confirm-cancel-btn"
            type="button"
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 font-medium text-xs transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            id="flow-confirm-approve-btn"
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Writing to Database...</span>
              </>
            ) : (
              <>
                <span>Approve & Execute</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
