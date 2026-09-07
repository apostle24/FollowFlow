import React, { useState, useEffect } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { calculateAutoPriority, getTodayString } from '../../services/db';
import {
  X,
  Sparkles,
  Calendar,
  DollarSign,
  User,
  AlertCircle,
  MessageSquare,
  Mail,
  Tag,
  Clock,
} from 'lucide-react';
import type {
  FollowUp,
  FollowUpType,
  FollowUpPriority,
  FollowUpChannel,
  FollowUpStatus,
  Contact,
} from '../../types';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  followUpToEdit?: FollowUp | null;
  initialContact?: Contact | null;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({
  isOpen,
  onClose,
  followUpToEdit,
  initialContact,
}) => {
  const { contacts, addFollowUp, editFollowUp } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [contactId, setContactId] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [type, setType] = useState<FollowUpType>('proposal');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('$');
  const [dueDate, setDueDate] = useState<string>(getTodayString());
  const [priority, setPriority] = useState<FollowUpPriority>('medium');
  const [autoPriority, setAutoPriority] = useState<boolean>(true);
  const [channel, setChannel] = useState<FollowUpChannel>('whatsapp');
  const [status, setStatus] = useState<FollowUpStatus>('pending');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (followUpToEdit) {
        setContactId(followUpToEdit.contactId);
        setTitle(followUpToEdit.title);
        setDescription(followUpToEdit.description || '');
        setType(followUpToEdit.type);
        setAmount(followUpToEdit.amount ? String(followUpToEdit.amount) : '');
        setCurrency(followUpToEdit.currency || '$');
        setDueDate(followUpToEdit.dueDate);
        setPriority(followUpToEdit.priority);
        setAutoPriority(followUpToEdit.priorityAutoCalculated ?? false);
        setChannel(followUpToEdit.channel);
        setStatus(followUpToEdit.status);
        setNotes(followUpToEdit.notes || '');
      } else {
        const defaultContact = initialContact || (contacts.length > 0 ? contacts[0] : null);
        setContactId(defaultContact ? defaultContact.id : '');
        setTitle('');
        setDescription('');
        setType('proposal');
        setAmount('');
        setCurrency('$');
        setDueDate(getTodayString());
        setPriority('medium');
        setAutoPriority(true);
        setChannel('whatsapp');
        setStatus('pending');
        setNotes('');
      }
    }
  }, [isOpen, followUpToEdit, initialContact, contacts]);

  // Auto calculate priority when fields change if autoPriority is active
  useEffect(() => {
    if (autoPriority && dueDate) {
      const suggested = calculateAutoPriority({
        dueDate,
        amount: amount ? parseFloat(amount) : undefined,
        type,
      });
      setPriority(suggested);
    }
  }, [dueDate, amount, type, autoPriority]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastError('Please enter a follow-up title');
      return;
    }

    const selectedContact = contacts.find((c) => c.id === contactId);

    setLoading(true);
    try {
      const parsedAmount = amount ? parseFloat(amount) : undefined;

      if (followUpToEdit) {
        await editFollowUp(followUpToEdit.id, {
          contactId,
          contactName: selectedContact?.name || followUpToEdit.contactName,
          contactCompany: selectedContact?.company,
          contactEmail: selectedContact?.email,
          contactPhone: selectedContact?.phone,
          contactWhatsapp: selectedContact?.whatsapp || selectedContact?.phone,
          title: title.trim(),
          description: description.trim(),
          type,
          amount: parsedAmount,
          currency,
          dueDate,
          priority,
          priorityAutoCalculated: autoPriority,
          channel,
          status,
          notes: notes.trim(),
        });
        success('Follow-up updated', 'Changes saved successfully.');
      } else {
        await addFollowUp({
          contactId,
          contactName: selectedContact?.name || 'General Contact',
          contactCompany: selectedContact?.company,
          contactEmail: selectedContact?.email,
          contactPhone: selectedContact?.phone,
          contactWhatsapp: selectedContact?.whatsapp || selectedContact?.phone,
          title: title.trim(),
          description: description.trim(),
          type,
          amount: parsedAmount,
          currency,
          dueDate,
          priority,
          priorityAutoCalculated: autoPriority,
          channel,
          status,
          notes: notes.trim(),
        });
        success('Follow-up created', 'Added to your queue.');
      }
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to save follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 text-slate-800 relative my-8 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {followUpToEdit ? 'Edit Follow-Up' : 'Create Follow-Up'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set deadlines, amounts, and automatic priority for follow-up reminders.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 py-4 space-y-4 flex-1">
          {/* Linked Contact */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Contact *
            </label>
            <select
              required
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.company ? `(${c.company})` : ''}
                </option>
              ))}
              {contacts.length === 0 && <option value="">No contacts yet (Add a contact first)</option>}
            </select>
          </div>

          {/* Title / Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Follow-Up Title / Goal *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Check in on proposal for website design"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Type & Amount Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FollowUpType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="proposal">Proposal / Quote</option>
                <option value="invoice">Invoice / Payment</option>
                <option value="lead">Lead / Inbound</option>
                <option value="appointment">Appointment</option>
                <option value="customer">Existing Customer</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Amount / Deal Value ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1500"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Due Date & Channel Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Preferred Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as FollowUpChannel)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="phone">Phone Call</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Priority & Auto-Suggest */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Priority Level</label>
              <label className="flex items-center gap-1.5 text-xs text-blue-600 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPriority}
                  onChange={(e) => setAutoPriority(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Auto-calculate priority
              </label>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {(['low', 'medium', 'high', 'urgent'] as FollowUpPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriority(p);
                    setAutoPriority(false);
                  }}
                  className={`py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : p === 'high'
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : p === 'medium'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-700 border-slate-700 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description & Context */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Context / Notes for AI Generator
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Sent $2,500 proposal 3 days ago. Client asked for time to review scope."
              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Status Selector (If editing) */}
          {followUpToEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="snoozed">Snoozed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold shadow-sm shadow-blue-200 transition-all disabled:opacity-60"
            >
              {loading ? 'Saving...' : followUpToEdit ? 'Save Changes' : 'Create Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
