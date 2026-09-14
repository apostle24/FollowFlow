import React, { useState, useEffect } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { DateTimePicker } from '../common/DateTimePicker';
import { formatAppointmentTimestamp, getTodayString } from '../../services/db';
import {
  X,
  UserPlus,
  Building,
  Mail,
  Phone,
  DollarSign,
  Globe,
  Share2,
  Calendar,
  CheckCircle2,
  Tag,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import type { Lead, LeadSource, LeadStatus } from '../../types';

interface LeadEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLead?: Partial<Lead> | null;
  onScheduleAppointment?: (lead: Lead | Partial<Lead>) => void;
}

const LEAD_SOURCE_OPTIONS: { value: LeadSource; label: string; icon: string }[] = [
  { value: 'website', label: 'Website Inbound', icon: '🌐' },
  { value: 'referral', label: 'Client Referral', icon: '🤝' },
  { value: 'linkedin', label: 'LinkedIn / Social', icon: '💼' },
  { value: 'cold_outreach', label: 'Cold Outreach / Email', icon: '🎯' },
  { value: 'advertisement', label: 'Paid Advertisement', icon: '📢' },
  { value: 'event', label: 'Event / Conference', icon: '🎟️' },
  { value: 'inbound_call', label: 'Inbound Phone Call', icon: '📞' },
  { value: 'partner', label: 'Strategic Partner', icon: '✨' },
  { value: 'other', label: 'Other Channel', icon: '📌' },
];

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New Lead', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'qualified', label: 'Qualified Prospect', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'won', label: 'Won / Closed', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { value: 'lost', label: 'Lost / Disqualified', color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

export const LeadEntryModal: React.FC<LeadEntryModalProps> = ({
  isOpen,
  onClose,
  initialLead,
}) => {
  const { addLead, editLead } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [name, setName] = useState<string>('');
  const [company, setCompany] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [whatsapp, setWhatsapp] = useState<string>('');
  const [leadSource, setLeadSource] = useState<LeadSource>('website');
  const [expectedDealValue, setExpectedDealValue] = useState<string>('');
  const [currency, setCurrency] = useState<string>('$');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [notes, setNotes] = useState<string>('');

  // Schedule Appointment Toggle
  const [scheduleAppointmentNow, setScheduleAppointmentNow] = useState<boolean>(false);
  const [appointmentTimestamp, setAppointmentTimestamp] = useState<string>(() =>
    formatAppointmentTimestamp(getTodayString(), '11:00')
  );

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialLead) {
        setName(initialLead.name || '');
        setCompany(initialLead.company || '');
        setEmail(initialLead.email || '');
        setPhone(initialLead.phone || '');
        setWhatsapp(initialLead.whatsapp || initialLead.phone || '');
        setLeadSource((initialLead.leadSource as LeadSource) || 'website');
        setExpectedDealValue(
          initialLead.expectedDealValue ? String(initialLead.expectedDealValue) : ''
        );
        setCurrency(initialLead.currency || '$');
        setStatus(initialLead.status || 'new');
        setNotes(initialLead.notes || '');
        if (initialLead.appointmentTimestamp) {
          setScheduleAppointmentNow(true);
          setAppointmentTimestamp(initialLead.appointmentTimestamp);
        } else {
          setScheduleAppointmentNow(false);
          setAppointmentTimestamp(formatAppointmentTimestamp(getTodayString(), '11:00'));
        }
      } else {
        setName('');
        setCompany('');
        setEmail('');
        setPhone('');
        setWhatsapp('');
        setLeadSource('website');
        setExpectedDealValue('');
        setCurrency('$');
        setStatus('new');
        setNotes('');
        setScheduleAppointmentNow(false);
        setAppointmentTimestamp(formatAppointmentTimestamp(getTodayString(), '11:00'));
      }
    }
  }, [isOpen, initialLead]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Please enter the client contact name');
      return;
    }

    setLoading(true);
    try {
      const parsedValue = expectedDealValue ? parseFloat(expectedDealValue) : 0;

      if (initialLead && initialLead.id) {
        await editLead(initialLead.id, {
          name: name.trim(),
          company: company.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          whatsapp: (whatsapp.trim() || phone.trim()) || undefined,
          leadSource,
          expectedDealValue: parsedValue,
          currency,
          status,
          notes: notes.trim() || undefined,
          appointmentTimestamp: scheduleAppointmentNow ? appointmentTimestamp : undefined,
        });
        success('Lead updated', 'Lead details updated successfully.');
      } else {
        await addLead({
          name: name.trim(),
          company: company.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          whatsapp: (whatsapp.trim() || phone.trim()) || undefined,
          leadSource,
          expectedDealValue: parsedValue,
          currency,
          status,
          notes: notes.trim() || undefined,
          appointmentTimestamp: scheduleAppointmentNow ? appointmentTimestamp : undefined,
        });
        success(
          'Lead created successfully',
          `Contact details and ${parsedValue > 0 ? `${currency}${parsedValue.toLocaleString()} ` : ''}deal value recorded.`
        );
      }
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to save lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 text-slate-800 relative my-8 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {initialLead?.id ? 'Edit Client Lead' : 'New Lead Entry'}
              </h2>
              <p className="text-xs text-slate-500">
                Record client contact details, source channel, and pipeline deal value.
              </p>
            </div>
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
          {/* Client Name & Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Client Contact Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Liam Montgomery"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Company / Organization
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Horizon Labs"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="liam@horizonlabs.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Phone / WhatsApp Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!whatsapp) setWhatsapp(e.target.value);
                  }}
                  placeholder="+1 (555) 345-6789"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Lead Source & Expected Deal Value Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lead Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Lead Source *
              </label>
              <select
                required
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {LEAD_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Expected Deal Value */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Expected Deal Value *
              </label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-2.5 bg-slate-100 text-sm font-bold border-r border-slate-200 focus:outline-none"
                >
                  <option value="$">$ USD</option>
                  <option value="€">€ EUR</option>
                  <option value="£">£ GBP</option>
                  <option value="₦">₦ NGN</option>
                  <option value="C$">C$ CAD</option>
                  <option value="A$">A$ AUD</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={expectedDealValue}
                  onChange={(e) => setExpectedDealValue(e.target.value)}
                  placeholder="3500"
                  className="w-full px-3.5 py-2.5 bg-transparent text-sm focus:outline-none font-semibold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Lead Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Pipeline Stage / Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LEAD_STATUS_OPTIONS.map((st) => {
                const isSelected = status === st.value;
                return (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setStatus(st.value)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? `${st.color} ring-2 ring-emerald-500/30 font-bold shadow-xs`
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{st.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule Introductory Appointment Toggle */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Schedule Intro Appointment Now?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setScheduleAppointmentNow((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  scheduleAppointmentNow ? 'bg-emerald-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    scheduleAppointmentNow ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {scheduleAppointmentNow && (
              <div className="pt-2 border-t border-emerald-100/60 animate-in fade-in duration-150">
                <DateTimePicker
                  value={appointmentTimestamp}
                  onChange={(iso) => setAppointmentTimestamp(iso)}
                  label="Appointment Date & Time"
                  required
                />
              </div>
            )}
          </div>

          {/* Notes / Context */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Lead Notes & Requirements
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Client inquiry details, project scope, budget discussion, referral notes..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <span>Saving Lead...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{initialLead?.id ? 'Update Lead' : 'Save Lead'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
