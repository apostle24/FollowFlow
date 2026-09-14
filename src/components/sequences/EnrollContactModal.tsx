import React, { useState, useEffect } from 'react';
import { X, Search, User, Layers, Calendar, ArrowRight, CheckCircle2, Phone, Mail, MessageSquare } from 'lucide-react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { getTodayString } from '../../services/db';
import type { Contact, Sequence, FollowUpChannel } from '../../types';

interface EnrollContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContact?: Contact | null;
  initialSequence?: Sequence | null;
}

export const EnrollContactModal: React.FC<EnrollContactModalProps> = ({
  isOpen,
  onClose,
  initialContact,
  initialSequence,
}) => {
  const { contacts, sequences, enrollContact } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('');
  const [customChannel, setCustomChannel] = useState<FollowUpChannel | 'auto'>('auto');
  const [startImmediate, setStartImmediate] = useState<boolean>(true);
  const [contactSearch, setContactSearch] = useState<string>('');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialContact) {
        setSelectedContactId(initialContact.id);
      } else if (contacts.length > 0) {
        setSelectedContactId(contacts[0].id);
      }

      if (initialSequence) {
        setSelectedSequenceId(initialSequence.id);
      } else if (sequences.length > 0) {
        setSelectedSequenceId(sequences[0].id);
      }

      setCustomChannel('auto');
      setStartImmediate(true);
      setContactSearch('');
    }
  }, [isOpen, initialContact, initialSequence, contacts, sequences]);

  if (!isOpen) return null;

  const activeSequences = sequences.filter((s) => s.isActive);
  const selectedContact = contacts.find((c) => c.id === selectedContactId);
  const selectedSequence = sequences.find((s) => s.id === selectedSequenceId);

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company && c.company.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) {
      toastError('Please select a contact to enroll.');
      return;
    }
    if (!selectedSequence) {
      toastError('Please select a sequence.');
      return;
    }

    const firstStep = selectedSequence.steps[0];
    if (!firstStep) {
      toastError('The selected sequence has no steps.');
      return;
    }

    setIsEnrolling(true);
    try {
      const todayStr = getTodayString();
      let nextDueDate = todayStr;

      if (!startImmediate && firstStep.delayDays > 0) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + firstStep.delayDays);
        nextDueDate = nextDate.toISOString().split('T')[0];
      }

      const channelToUse: FollowUpChannel =
        customChannel !== 'auto'
          ? (customChannel as FollowUpChannel)
          : (firstStep.channel as FollowUpChannel) ||
            (selectedContact.preferredChannel && selectedContact.preferredChannel !== 'no_preference'
              ? (selectedContact.preferredChannel as FollowUpChannel)
              : 'email');

      await enrollContact({
        sequenceId: selectedSequence.id,
        sequenceName: selectedSequence.name,
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        contactCompany: selectedContact.company,
        contactEmail: selectedContact.email,
        contactPhone: selectedContact.phone || selectedContact.whatsapp,
        currentStepNumber: 1,
        totalSteps: selectedSequence.steps.length,
        status: 'active',
        nextStepDueAt: nextDueDate,
        nextStepChannel: channelToUse,
        nextStepTitle: firstStep.title,
      });

      success(`Successfully enrolled ${selectedContact.name} in "${selectedSequence.name}"!`);
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to enroll contact in sequence.');
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Enroll Contact in Sequence</h2>
              <p className="text-xs text-slate-500">Initiate automated follow-up cadence for a lead or client</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleEnroll} className="p-6 space-y-5">
          {/* Step 1: Select Contact */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              1. Select Contact *
            </label>
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search contacts by name, company..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filteredContacts.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 text-center">No matching contacts found</p>
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = c.id === selectedContactId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedContactId(c.id)}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 font-semibold text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{c.company || c.email || 'No company'}</p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Step 2: Select Sequence */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              2. Select Follow-up Sequence *
            </label>
            <div className="space-y-1.5">
              {activeSequences.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  No active sequences available. Please create a sequence first.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {activeSequences.map((seq) => {
                    const isSelected = seq.id === selectedSequenceId;
                    return (
                      <div
                        key={seq.id}
                        onClick={() => setSelectedSequenceId(seq.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-400'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">{seq.name}</span>
                          <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            {seq.steps.length} Steps
                          </span>
                        </div>
                        {seq.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1">{seq.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Timing & Channel Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Start Schedule
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStartImmediate(true)}
                  className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    startImmediate
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Start Today (Step 1)
                </button>
                <button
                  type="button"
                  onClick={() => setStartImmediate(false)}
                  className={`flex-1 py-2 px-2 text-xs font-bold rounded-lg border text-center transition-all ${
                    !startImmediate
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Apply Step Delay
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Channel Preference
              </label>
              <select
                value={customChannel}
                onChange={(e) => setCustomChannel(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-hidden bg-white"
              >
                <option value="auto">Auto (Sequence Default)</option>
                <option value="whatsapp">Force WhatsApp</option>
                <option value="email">Force Email</option>
                <option value="sms">Force SMS</option>
                <option value="phone">Force Phone Call</option>
              </select>
            </div>
          </div>

          {/* Summary Preview */}
          {selectedContact && selectedSequence && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500">Enrolling:</span>{' '}
                <strong className="text-slate-900">{selectedContact.name}</strong>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-slate-500">Sequence:</span>{' '}
                <strong className="text-slate-900">{selectedSequence.name}</strong>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isEnrolling || !selectedContact || !selectedSequence}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isEnrolling ? 'Enrolling...' : 'Confirm & Start Sequence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
