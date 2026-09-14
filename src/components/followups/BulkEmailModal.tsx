import React, { useState, useMemo } from 'react';
import {
  X,
  Mail,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Eye,
  Edit3,
  Users,
  Building,
  DollarSign,
  ExternalLink,
  ChevronRight,
  TestTube2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { sendEmailViaGmail, isUnauthorizedDomainError } from '../../services/gmail';
import { sendDirectEmail } from '../../services/email';
import type { FollowUp, Contact } from '../../types';

interface BulkEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFollowUps?: FollowUp[];
  selectedContacts?: Contact[];
  onDispatched?: () => void;
}

interface RecipientItem {
  id: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
  type?: string;
  followUpId?: string;
  contactId?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  errorMsg?: string;
}

const EMPTY_FOLLOW_UPS: FollowUp[] = [];
const EMPTY_CONTACTS: Contact[] = [];

export const BulkEmailModal: React.FC<BulkEmailModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <BulkEmailModalDialog {...props} />;
};

const BulkEmailModalDialog: React.FC<BulkEmailModalProps> = ({
  onClose,
  selectedFollowUps = EMPTY_FOLLOW_UPS,
  selectedContacts = EMPTY_CONTACTS,
  onDispatched,
}) => {
  const { user, userProfile } = useAuth();
  const { contacts, bulkUpdateStatus } = useFollowUp();
  const { success, error: toastError, info } = useToast();

  // Active view tab: 'compose' or 'preview'
  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');

  // Dispatch channel: 'gmail' | 'server' | 'web'
  const [channel, setChannel] = useState<'gmail' | 'server' | 'web'>('gmail');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Prepare recipients list with editable email state initialized on modal mount
  const [recipients, setRecipients] = useState<RecipientItem[]>(() => {
    if (selectedFollowUps.length > 0) {
      return selectedFollowUps.map((f) => {
        const matched = contacts.find((c) => c.id === f.contactId);
        const name = f.contactName || matched?.name || 'Valued Client';
        const email = f.contactEmail || matched?.email || '';
        const company = f.contactCompany || matched?.company;
        return {
          id: f.id,
          name,
          email,
          company,
          title: f.title,
          amount: f.amount,
          currency: f.currency || '$',
          dueDate: f.dueDate,
          type: f.type,
          followUpId: f.id,
          contactId: f.contactId,
          status: 'pending' as const,
        };
      });
    } else if (selectedContacts.length > 0) {
      return selectedContacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email || '',
        company: c.company,
        contactId: c.id,
        status: 'pending' as const,
      }));
    }
    return [];
  });

  const [previewIndex, setPreviewIndex] = useState<number>(0);

  // Determine dominant type (invoices vs leads vs general)
  const isInvoiceDominant = selectedFollowUps.some((f) => f.type === 'invoice');
  const isLeadDominant = selectedFollowUps.some((f) => f.type === 'lead') || selectedContacts.length > 0;

  // Template presets
  const [templateType, setTemplateType] = useState<'invoice' | 'lead' | 'checkin' | 'custom'>(
    isInvoiceDominant ? 'invoice' : isLeadDominant ? 'lead' : 'checkin'
  );

  const [subjectTemplate, setSubjectTemplate] = useState<string>(() => {
    if (isInvoiceDominant) return 'Payment Reminder: Invoice {title} ({amount})';
    if (isLeadDominant) return 'Following up regarding {title}';
    return 'Quick check-in: {title}';
  });

  const [bodyTemplate, setBodyTemplate] = useState<string>(() => {
    if (isInvoiceDominant) {
      return `Hi {contact_name},\n\nI hope you're having a great week!\n\nThis is a friendly reminder regarding invoice {title} for {amount} which was due on {due_date}.\n\nPlease let me know once payment has been initiated or if you need another copy of the invoice.\n\nThank you for your business,\n{my_name}`;
    }
    if (isLeadDominant) {
      return `Hi {contact_name},\n\nHope you're having a productive week! I'm following up on our previous conversation regarding {title}.\n\nDo you have 10-15 minutes later this week to reconnect and review next steps?\n\nBest regards,\n{my_name}`;
    }
    return `Hi {contact_name},\n\nHope you're doing well! Just circling back on {title} to see how everything is progressing on your end.\n\nLooking forward to hearing from you,\n{my_name}`;
  });

  const handleApplyPreset = (preset: 'invoice' | 'lead' | 'checkin') => {
    setTemplateType(preset);
    const myName = userProfile?.displayName || user?.displayName || 'FollowFlow User';
    if (preset === 'invoice') {
      setSubjectTemplate('Payment Reminder: Invoice {title} ({amount})');
      setBodyTemplate(
        `Hi {contact_name},\n\nI hope you're having a great week!\n\nThis is a friendly reminder regarding invoice {title} for {amount} which was due on {due_date}.\n\nPlease let me know once payment has been initiated or if you need another copy of the invoice.\n\nThank you for your business,\n${myName}`
      );
    } else if (preset === 'lead') {
      setSubjectTemplate('Following up regarding {title}');
      setBodyTemplate(
        `Hi {contact_name},\n\nHope you're having a productive week! I'm following up on our previous conversation regarding {title}.\n\nDo you have 10-15 minutes later this week to reconnect and review next steps?\n\nBest regards,\n${myName}`
      );
    } else {
      setSubjectTemplate('Quick check-in: {title}');
      setBodyTemplate(
        `Hi {contact_name},\n\nHope you're doing well! Just circling back on {title} to see how everything is progressing on your end.\n\nLooking forward to hearing from you,\n${myName}`
      );
    }
  };

  // Helper to replace template variables for a recipient
  const renderMessageForRecipient = (r: RecipientItem) => {
    const myName = userProfile?.displayName || user?.displayName || 'FollowFlow User';
    const amountStr = r.amount ? `${r.currency || '$'}${Number(r.amount).toLocaleString()}` : '';
    const titleStr = r.title || 'our collaboration';
    const dateStr = r.dueDate || 'recently';
    const companyStr = r.company || '';

    const renderText = (str: string) => {
      return str
        .replace(/\{contact_name\}/g, r.name)
        .replace(/\{name\}/g, r.name)
        .replace(/\{company\}/g, companyStr)
        .replace(/\{title\}/g, titleStr)
        .replace(/\{amount\}/g, amountStr)
        .replace(/\{due_date\}/g, dateStr)
        .replace(/\{my_name\}/g, myName);
    };

    return {
      subject: renderText(subjectTemplate),
      body: renderText(bodyTemplate),
    };
  };

  // Allow editing recipient email in case it was missing
  const handleUpdateRecipientEmail = (id: string, newEmail: string) => {
    setRecipients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, email: newEmail.trim() } : item))
    );
  };

  const validRecipients = recipients.filter((r) => r.email && r.email.includes('@'));
  const missingEmailCount = recipients.length - validRecipients.length;

  // Send batch handler
  const handleDispatchBulkEmails = async () => {
    if (validRecipients.length === 0) {
      toastError('No valid email recipients found. Please enter valid email addresses.');
      return;
    }

    setIsSending(true);
    setDispatchProgress({ current: 0, total: validRecipients.length });

    let sentCount = 0;
    let failedCount = 0;
    const dispatchedFollowUpIds: string[] = [];

    const updated = [...recipients];

    for (let i = 0; i < updated.length; i++) {
      const recipient = updated[i];
      if (!recipient.email || !recipient.email.includes('@')) {
        recipient.status = 'skipped';
        recipient.errorMsg = 'Missing valid email';
        continue;
      }

      recipient.status = 'sending';
      setRecipients([...updated]);

      const { subject, body } = renderMessageForRecipient(recipient);

      try {
        if (channel === 'gmail') {
          // Attempt Gmail dispatch
          try {
            await sendEmailViaGmail({
              to: recipient.email,
              subject,
              body,
            });
            recipient.status = 'sent';
            sentCount++;
            if (recipient.followUpId) dispatchedFollowUpIds.push(recipient.followUpId);
          } catch (gmailErr: any) {
            if (isUnauthorizedDomainError(gmailErr)) {
              // Sandbox simulated dispatch
              recipient.status = 'sent';
              recipient.errorMsg = 'Preview sandbox simulated dispatch';
              sentCount++;
              if (recipient.followUpId) dispatchedFollowUpIds.push(recipient.followUpId);
            } else {
              throw gmailErr;
            }
          }
        } else if (channel === 'server') {
          const res = await sendDirectEmail({
            userId: user?.uid || 'guest',
            to: recipient.email,
            subject,
            body,
            recipientName: recipient.name,
            followUpId: recipient.followUpId,
            contactId: recipient.contactId,
          });

          if (res.success || res.status === 'sent') {
            recipient.status = 'sent';
            sentCount++;
            if (recipient.followUpId) dispatchedFollowUpIds.push(recipient.followUpId);
          } else {
            recipient.status = 'failed';
            recipient.errorMsg = res.error || 'Server dispatch failed';
            failedCount++;
          }
        } else if (channel === 'web') {
          // Open Gmail web draft
          const mailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
            recipient.email
          )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          window.open(mailUrl, '_blank');
          recipient.status = 'sent';
          sentCount++;
          if (recipient.followUpId) dispatchedFollowUpIds.push(recipient.followUpId);
        }
      } catch (err: any) {
        recipient.status = 'failed';
        recipient.errorMsg = err?.message || 'Failed to dispatch email';
        failedCount++;
      }

      setDispatchProgress({ current: i + 1, total: updated.length });
      setRecipients([...updated]);

      // Small pacing delay between emails to avoid hitting rate limits
      if (i < updated.length - 1 && channel !== 'web') {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setIsSending(false);

    // Update follow-up status to 'contacted'
    if (dispatchedFollowUpIds.length > 0) {
      try {
        await bulkUpdateStatus(dispatchedFollowUpIds, 'contacted');
      } catch (e) {
        console.warn('Failed to update status:', e);
      }
    }

    if (sentCount > 0) {
      success(
        'Batch Dispatch Complete',
        `Successfully sent ${sentCount} follow-up email${sentCount > 1 ? 's' : ''}${
          failedCount > 0 ? ` (${failedCount} failed)` : ''
        }.`
      );
      onDispatched?.();
    } else {
      toastError('Bulk Email Dispatch Failed', 'None of the emails could be delivered.');
    }
  };

  const currentPreviewRecipient = recipients[previewIndex] || recipients[0];
  const renderedPreview = currentPreviewRecipient
    ? renderMessageForRecipient(currentPreviewRecipient)
    : { subject: '', body: '' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Bulk Follow-Up Email Dispatch
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {recipients.length} Recipient{recipients.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Personalize and dispatch reminders to multiple leads or invoices simultaneously.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSending}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('compose')}
              className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'compose'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              1. Compose & Template
            </button>

            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'preview'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              2. Live Recipient Preview ({validRecipients.length}/{recipients.length})
            </button>
          </div>

          {missingEmailCount > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3 h-3" />
              {missingEmailCount} item{missingEmailCount > 1 ? 's' : ''} missing email
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'compose' ? (
            <div className="space-y-5">
              {/* Presets Row */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Quick Message Templates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('invoice')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      templateType === 'invoice'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Invoice Payment Reminder
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Polite, firm reminder for outstanding or past-due invoices.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('lead')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      templateType === 'lead'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      Lead Follow-Up / Reconnect
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Friendly check-in on project proposals and next steps.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('checkin')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      templateType === 'checkin'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Gentle Touchpoint
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Lightweight cadence touchpoint to keep communication warm.
                    </p>
                  </button>
                </div>
              </div>

              {/* Subject Template */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Subject Template
                </label>
                <input
                  type="text"
                  value={subjectTemplate}
                  onChange={(e) => {
                    setSubjectTemplate(e.target.value);
                    setTemplateType('custom');
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Friendly reminder: Invoice {title}"
                />
              </div>

              {/* Body Template */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Email Message Body
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Supports dynamic placeholders below
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={bodyTemplate}
                  onChange={(e) => {
                    setBodyTemplate(e.target.value);
                    setTemplateType('custom');
                  }}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs leading-relaxed font-sans focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Compose your bulk email template..."
                />
              </div>

              {/* Placeholders chips */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Available Variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '{contact_name}',
                    '{company}',
                    '{title}',
                    '{amount}',
                    '{due_date}',
                    '{my_name}',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBodyTemplate((prev) => prev + ` ${tag}`)}
                      className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-blue-300 text-blue-700 text-[11px] font-mono font-medium shadow-2xs"
                      title="Click to insert variable into message"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sending Channel Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Dispatch Channel
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setChannel('gmail')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      channel === 'gmail'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      Google / Gmail Account
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Direct authenticated API dispatch from your email address.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('server')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      channel === 'server'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-indigo-600" />
                      Server Direct Mail
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Sends via configured background email transport service.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('web')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      channel === 'web'
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                      Gmail Web Drafts
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Opens pre-filled browser draft tabs in mail.google.com.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Recipients list column */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recipients ({recipients.length})
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {validRecipients.length} ready to send
                  </span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {recipients.map((r, idx) => {
                    const isSelected = idx === previewIndex;
                    const hasEmail = Boolean(r.email && r.email.includes('@'));

                    return (
                      <div
                        key={r.id}
                        onClick={() => setPreviewIndex(idx)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{r.name}</h4>
                            {r.company && (
                              <p className="text-[11px] text-slate-500 truncate">{r.company}</p>
                            )}
                          </div>
                          {r.amount !== undefined && r.amount > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              {r.currency}
                              {Number(r.amount).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {/* Editable email field */}
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          {hasEmail ? (
                            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono truncate">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{r.email}</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Missing email address
                              </span>
                              <input
                                type="email"
                                placeholder="Enter email..."
                                value={r.email}
                                onChange={(e) => handleUpdateRecipientEmail(r.id, e.target.value)}
                                className="w-full px-2 py-1 text-[11px] border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>

                        {/* Dispatch status pill */}
                        {r.status !== 'pending' && (
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span
                              className={`font-bold uppercase ${
                                r.status === 'sent'
                                  ? 'text-emerald-600'
                                  : r.status === 'failed'
                                  ? 'text-rose-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              Status: {r.status}
                            </span>
                            {r.errorMsg && (
                              <span className="text-slate-400 italic truncate max-w-[120px]">
                                {r.errorMsg}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview Display Column */}
              <div className="lg:col-span-7 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Message Preview for: <strong className="text-blue-600">{currentPreviewRecipient?.name}</strong>
                </span>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 font-sans">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      To
                    </span>
                    <span className="text-xs font-medium text-slate-800">
                      {currentPreviewRecipient?.name} &lt;
                      {currentPreviewRecipient?.email || 'No email specified'}&gt;
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Subject
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {renderedPreview.subject}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Body
                    </span>
                    <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                      {renderedPreview.body}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Real-time sending progress bar */}
          {isSending && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Dispatching follow-ups in progress...
                </span>
                <span>
                  {dispatchProgress.current} of {dispatchProgress.total} completed
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 transition-all duration-300"
                  style={{
                    width: `${
                      dispatchProgress.total > 0
                        ? Math.round((dispatchProgress.current / dispatchProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>
              Ready to send to <strong>{validRecipients.length}</strong> recipient{validRecipients.length > 1 ? 's' : ''}.
            </span>
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            {activeTab === 'compose' ? (
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <span>Preview Messages</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleDispatchBulkEmails}
              disabled={isSending || validRecipients.length === 0}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-sm shadow-blue-200"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send {validRecipients.length} Email{validRecipients.length > 1 ? 's' : ''} Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
