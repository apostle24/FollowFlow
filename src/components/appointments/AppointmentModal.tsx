import React, { useState, useEffect } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { DateTimePicker } from '../common/DateTimePicker';
import { formatAppointmentTimestamp, getTodayString } from '../../services/db';
import {
  X,
  Calendar,
  Clock,
  User,
  Building,
  Mail,
  Phone,
  Video,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Check,
} from 'lucide-react';
import type { Appointment, Contact, FollowUpChannel } from '../../types';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAppointment?: Partial<Appointment> | null;
  initialContact?: Contact | null;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  initialAppointment,
  initialContact,
}) => {
  const { contacts, addAppointment, editAppointment } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [contactId, setContactId] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [contactCompany, setContactCompany] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState<string>(() =>
    formatAppointmentTimestamp(getTodayString(), '10:00')
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [channel, setChannel] = useState<FollowUpChannel>('phone');
  const [locationOrLink, setLocationOrLink] = useState<string>('');
  const [expectedDealValue, setExpectedDealValue] = useState<string>('');
  const [currency, setCurrency] = useState<string>('$');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      if (initialAppointment) {
        setContactId(initialAppointment.contactId || '');
        setContactName(initialAppointment.contactName || '');
        setContactCompany(initialAppointment.contactCompany || '');
        setContactEmail(initialAppointment.contactEmail || '');
        setContactPhone(initialAppointment.contactPhone || initialAppointment.contactWhatsapp || '');
        setTitle(initialAppointment.title || '');
        setDescription(initialAppointment.description || '');
        setScheduledAt(
          initialAppointment.scheduledAt || formatAppointmentTimestamp(getTodayString(), '10:00')
        );
        setDurationMinutes(initialAppointment.durationMinutes || 30);
        setChannel(initialAppointment.channel || 'phone');
        setLocationOrLink(initialAppointment.locationOrLink || '');
        setExpectedDealValue(
          initialAppointment.expectedDealValue ? String(initialAppointment.expectedDealValue) : ''
        );
        setCurrency(initialAppointment.currency || '$');
        setNotes(initialAppointment.notes || '');
      } else if (initialContact) {
        setContactId(initialContact.id);
        setContactName(initialContact.name);
        setContactCompany(initialContact.company || '');
        setContactEmail(initialContact.email || '');
        setContactPhone(initialContact.phone || initialContact.whatsapp || '');
        setTitle(`Meeting with ${initialContact.name}`);
        setDescription('');
        setScheduledAt(formatAppointmentTimestamp(getTodayString(), '10:00'));
        setDurationMinutes(30);
        setChannel(initialContact.whatsapp ? 'whatsapp' : 'phone');
        setLocationOrLink('');
        setExpectedDealValue('');
        setCurrency('$');
        setNotes('');
      } else {
        setContactId('');
        setContactName('');
        setContactCompany('');
        setContactEmail('');
        setContactPhone('');
        setTitle('');
        setDescription('');
        setScheduledAt(formatAppointmentTimestamp(getTodayString(), '10:00'));
        setDurationMinutes(30);
        setChannel('phone');
        setLocationOrLink('');
        setExpectedDealValue('');
        setCurrency('$');
        setNotes('');
      }
    }
  }, [isOpen, initialAppointment, initialContact]);

  // Handle contact selection change
  const handleSelectContact = (cId: string) => {
    setContactId(cId);
    if (cId) {
      const selected = contacts.find((c) => c.id === cId);
      if (selected) {
        setContactName(selected.name);
        setContactCompany(selected.company || '');
        setContactEmail(selected.email || '');
        setContactPhone(selected.phone || selected.whatsapp || '');
        if (!title) {
          setTitle(`Discovery Call with ${selected.name}`);
        }
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toastError('Please enter an appointment title');
      return;
    }
    if (!contactName.trim()) {
      toastError('Please specify client contact name');
      return;
    }

    setLoading(true);
    try {
      if (initialAppointment && initialAppointment.id) {
        await editAppointment(initialAppointment.id, {
          contactId: contactId || undefined,
          contactName: contactName.trim(),
          contactCompany: contactCompany.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          contactWhatsapp: contactPhone.trim() || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          scheduledAt,
          durationMinutes,
          channel,
          locationOrLink: locationOrLink.trim() || undefined,
          expectedDealValue: expectedDealValue ? parseFloat(expectedDealValue) : undefined,
          currency,
          notes: notes.trim() || undefined,
        });
        success('Appointment updated', 'Saved to Firebase with consistent timestamp formatting.');
      } else {
        await addAppointment({
          contactId: contactId || undefined,
          contactName: contactName.trim(),
          contactCompany: contactCompany.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          contactWhatsapp: contactPhone.trim() || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          scheduledAt,
          durationMinutes,
          channel,
          locationOrLink: locationOrLink.trim() || undefined,
          status: 'scheduled',
          expectedDealValue: expectedDealValue ? parseFloat(expectedDealValue) : undefined,
          currency,
          notes: notes.trim() || undefined,
        });
        success('Appointment scheduled', 'Stored in Firebase and synced to follow-ups.');
      }
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to save appointment to Firebase');
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
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {initialAppointment?.id ? 'Edit Appointment' : 'Schedule Appointment'}
              </h2>
              <p className="text-xs text-slate-500">
                Schedule client appointments and calendar reminders.
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
          {/* Quick Select Existing Contact */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Link Existing Contact (Optional)
              </label>
              <select
                value={contactId}
                onChange={(e) => handleSelectContact(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Choose from existing contacts or fill below --</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Client Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Client Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Company / Organization
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactCompany}
                  onChange={(e) => setContactCompany(e.target.value)}
                  placeholder="e.g. Nexus Tech"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Contact Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Phone / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Meeting Title / Goal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Meeting Title / Goal *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Discovery & Needs Assessment Call"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
            />
          </div>

          {/* DATE & TIME PICKER INTEGRATION */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <DateTimePicker
              value={scheduledAt}
              onChange={(iso) => setScheduledAt(iso)}
              durationMinutes={durationMinutes}
              onDurationChange={(m) => setDurationMinutes(m)}
              required
            />
          </div>

          {/* Meeting Channel & Location/Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Meeting Medium
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as FollowUpChannel)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="phone">Phone Call</option>
                <option value="whatsapp">WhatsApp Voice / Video</option>
                <option value="email">Video Conference (Meet / Zoom)</option>
                <option value="other">In-Person Meeting</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Meeting Link or Location
              </label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={locationOrLink}
                  onChange={(e) => setLocationOrLink(e.target.value)}
                  placeholder="https://meet.google.com/xyz or Office address"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Expected Deal Value */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Expected Deal Value (Optional)
            </label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white">
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
                value={expectedDealValue}
                onChange={(e) => setExpectedDealValue(e.target.value)}
                placeholder="2500"
                className="w-full px-3.5 py-2.5 bg-transparent text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Agenda / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Agenda & Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key talking points, client questions, or required preparation..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Submit Button */}
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
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <span>Saving to Firebase...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{initialAppointment?.id ? 'Update Appointment' : 'Save Appointment'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
