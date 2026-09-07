import React, { useState, useEffect } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { generateFollowUpMessage } from '../../services/ai';
import { logGeneratedMessage, completeFollowUp, updateFollowUp } from '../../services/db';
import { trackEvent } from '../../services/analytics';
import {
  getEmailConfig,
  sendDirectEmail,
  scheduleEmail,
  type EmailConfig,
} from '../../services/email';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Send,
  Mail,
  MessageSquare,
  RefreshCw,
  Edit3,
  ExternalLink,
  AlertCircle,
  Phone,
  Calendar,
  Clock,
  ChevronDown,
  FileText,
  Tag,
  Wand2,
} from 'lucide-react';
import type { MessageTone, FollowUpChannel, Contact, FollowUp } from '../../types';
import { ContactSelector, type TemporaryContact, type ExtraContactDetails } from './ContactSelector';

export const AiMessageGeneratorModal: React.FC = () => {
  const { user, userProfile, incrementAiUsage } = useAuth();
  const {
    aiModalOpen,
    aiTargetFollowUp,
    aiTargetContact,
    closeAiModal,
    contacts,
    followUps,
    markCompleted,
    openUpgradeModal,
    addContact,
    editContact,
  } = useFollowUp();
  const { success, error: toastError, info } = useToast();

  const [composerMode, setComposerMode] = useState<'ai' | 'manual'>('ai');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [temporaryContact, setTemporaryContact] = useState<TemporaryContact | null>(null);
  const [extraContextDetails, setExtraContextDetails] = useState<ExtraContactDetails | null>(null);

  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string>('');
  const [tone, setTone] = useState<MessageTone>('professional');
  const [channel, setChannel] = useState<FollowUpChannel>('whatsapp');
  const [contextInput, setContextInput] = useState<string>('');
  const [generating, setGenerating] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);

  // Missing contact detail quick-fix inputs
  const [missingNumberInput, setMissingNumberInput] = useState<string>('');
  const [missingEmailInput, setMissingEmailInput] = useState<string>('');

  // Email provider & scheduling states
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    isConfigured: false,
    provider: 'none',
    fromEmail: '',
  });
  const [isSendingDirectEmail, setIsSendingDirectEmail] = useState<boolean>(false);
  const [isSchedulingEmail, setIsSchedulingEmail] = useState<boolean>(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState<boolean>(false);
  const [customScheduleDate, setCustomScheduleDate] = useState<string>('');
  const [customScheduleTime, setCustomScheduleTime] = useState<string>('09:00');

  // Load email configuration on mount
  useEffect(() => {
    getEmailConfig().then(setEmailConfig).catch(() => {});
  }, []);

  // Sync state when modal opens with target follow-up / contact
  useEffect(() => {
    if (aiModalOpen) {
      getEmailConfig().then(setEmailConfig).catch(() => {});

      if (aiTargetContact) {
        setSelectedContactId(aiTargetContact.id);
        setTemporaryContact(null);
      } else if (aiTargetFollowUp?.contactId) {
        setSelectedContactId(aiTargetFollowUp.contactId);
        setTemporaryContact(null);
      } else if (contacts.length > 0) {
        setSelectedContactId(contacts[0].id);
        setTemporaryContact(null);
      } else {
        setSelectedContactId('');
        setTemporaryContact(null);
      }

      if (aiTargetFollowUp) {
        setSelectedFollowUpId(aiTargetFollowUp.id);
        setChannel(aiTargetFollowUp.channel || 'whatsapp');
        if (aiTargetFollowUp.description) {
          setContextInput(aiTargetFollowUp.description);
        }
      } else {
        setSelectedFollowUpId('');
      }

      setExtraContextDetails(null);
      setMessageText('');
      setSubject('');
      setCopied(false);
      setEditMode(false);
      setShowSchedulePicker(false);
      setComposerMode('ai');
      setMissingNumberInput('');
      setMissingEmailInput('');

      // Default custom schedule date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCustomScheduleDate(tomorrow.toISOString().split('T')[0]);
    }
  }, [aiModalOpen, aiTargetFollowUp, aiTargetContact, contacts]);

  if (!aiModalOpen) return null;

  // Resolve current active contact (temporary or saved)
  const currentContact: Contact | TemporaryContact | undefined =
    temporaryContact || contacts.find((c) => c.id === selectedContactId);

  const currentFollowUp: FollowUp | undefined = followUps.find((f) => f.id === selectedFollowUpId);

  const toneOptions: { id: MessageTone; label: string; desc: string }[] = [
    { id: 'friendly', label: 'Friendly', desc: 'Approachable and encouraging' },
    { id: 'professional', label: 'Professional', desc: 'Clear, polite, and direct' },
    { id: 'casual', label: 'Casual', desc: 'Relaxed, short, and modern' },
    { id: 'warm', label: 'Warm', desc: 'Empathetic and relationship-focused' },
    { id: 'firm', label: 'Firm', desc: 'Assertive on deadlines & invoices' },
    { id: 'urgent', label: 'Urgent', desc: 'Time-sensitive next steps' },
  ];

  const quickContextChips = [
    'Sent proposal 3 days ago, checking for questions',
    'Invoice is past due, requesting payment update',
    'Following up after our initial discovery call',
    'Confirming our appointment tomorrow',
    'Checking in to see if scope changes are needed',
  ];

  const variableTags = [
    { tag: '{{contact_name}}', label: 'Contact Name' },
    { tag: '{{company_name}}', label: 'Company' },
    { tag: '{{project_name}}', label: 'Project' },
    { tag: '{{service}}', label: 'Service' },
    { tag: '{{amount}}', label: 'Amount' },
    { tag: '{{due_date}}', label: 'Due Date' },
    { tag: '{{my_name}}', label: 'My Name' },
  ];

  // Helper to replace template variables with real data
  const resolveMessageVariables = (rawText: string): string => {
    if (!rawText) return '';
    let resolved = rawText;

    const contactName = currentContact?.name || '';
    const companyName = currentContact?.company || '';
    const projectName =
      extraContextDetails?.project ||
      currentFollowUp?.title ||
      '';
    const service =
      extraContextDetails?.service ||
      extraContextDetails?.project ||
      currentFollowUp?.title ||
      '';
    const resolvedAmount =
      extraContextDetails?.amount != null
        ? `${extraContextDetails.currency || '$'}${extraContextDetails.amount.toLocaleString()}`
        : currentFollowUp?.amount != null
        ? `${currentFollowUp.currency || '$'}${currentFollowUp.amount.toLocaleString()}`
        : '';
    const dueDate = currentFollowUp?.dueDate || 'soon';
    const myName = userProfile?.displayName || user?.displayName || 'FollowFlow';

    const map: Record<string, string> = {
      '{{contact_name}}': contactName,
      '{{company_name}}': companyName,
      '{{project_name}}': projectName,
      '{{service}}': service,
      '{{amount}}': resolvedAmount,
      '{{due_date}}': dueDate,
      '{{my_name}}': myName,
      // Common convenience synonyms
      '{{name}}': contactName,
      '{{company}}': companyName,
    };

    for (const [tag, val] of Object.entries(map)) {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      resolved = resolved.replace(new RegExp(escaped, 'gi'), val);
    }

    return resolved;
  };

  const handleInsertVariable = (tag: string) => {
    setMessageText((prev) => {
      if (!prev) return tag;
      return `${prev} ${tag}`;
    });
    info(`Inserted ${tag}`);
  };

  const handleApplyPersonalization = () => {
    const resolvedSubj = resolveMessageVariables(subject);
    const resolvedBody = resolveMessageVariables(messageText);
    setSubject(resolvedSubj);
    setMessageText(resolvedBody);
    success('Personalization applied', 'Variables resolved with contact details.');
  };

  // Contact management handlers
  const handleSaveNewContact = async (
    contactData: Omit<Contact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    extraDetails?: ExtraContactDetails
  ) => {
    try {
      const newId = await addContact(contactData);
      setSelectedContactId(newId);
      setTemporaryContact(null);
      if (extraDetails) {
        setExtraContextDetails(extraDetails);
        if (!contextInput) {
          const parts: string[] = [];
          if (extraDetails.project) parts.push(`Project: ${extraDetails.project}`);
          if (extraDetails.amount != null) parts.push(`Amount: ${extraDetails.currency || '$'}${extraDetails.amount}`);
          if (parts.length > 0) setContextInput(parts.join('. '));
        }
      }
      success('Contact saved!', `${contactData.name} has been added to your CRM and selected.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to save contact');
      throw err;
    }
  };

  const handleUseTemporaryContact = (
    temp: TemporaryContact,
    extraDetails?: ExtraContactDetails
  ) => {
    setTemporaryContact(temp);
    setSelectedContactId('');
    if (extraDetails) {
      setExtraContextDetails(extraDetails);
      if (!contextInput) {
        const parts: string[] = [];
        if (extraDetails.project) parts.push(`Project: ${extraDetails.project}`);
        if (extraDetails.amount != null) parts.push(`Amount: ${extraDetails.currency || '$'}${extraDetails.amount}`);
        if (parts.length > 0) setContextInput(parts.join('. '));
      }
    }
    info('Using temporary contact', `${temp.name} will be used in-memory for this message without saving to CRM.`);
  };

  const handleSaveTemporaryAsPermanent = async (temp: TemporaryContact) => {
    if (!temp.name) return;
    try {
      const newId = await addContact({
        name: temp.name,
        company: temp.company,
        email: temp.email,
        phone: temp.phone,
        whatsapp: temp.whatsapp,
        notes: temp.notes,
        tags: ['Client'],
      });
      setSelectedContactId(newId);
      setTemporaryContact(null);
      success('Contact saved!', `${temp.name} is now permanently saved to your CRM.`);
    } catch (err: any) {
      toastError(err.message || 'Failed to save contact to CRM');
    }
  };

  // Inline contact detail update handlers
  const handleSaveMissingNumber = async () => {
    if (!missingNumberInput.trim()) {
      toastError('Please enter a phone or WhatsApp number');
      return;
    }
    const cleanNumber = missingNumberInput.trim();
    if (temporaryContact) {
      setTemporaryContact({
        ...temporaryContact,
        phone: cleanNumber,
        whatsapp: cleanNumber,
      });
      setMissingNumberInput('');
      success('Number updated', 'Added phone number to temporary contact.');
    } else if (currentContact && user) {
      try {
        await editContact(currentContact.id, {
          phone: cleanNumber,
          whatsapp: cleanNumber,
        });
        setMissingNumberInput('');
        success('Number saved', 'Saved phone number to contact record.');
      } catch (err: any) {
        toastError(err.message || 'Failed to update contact');
      }
    }
  };

  const handleSaveMissingEmail = async () => {
    if (!missingEmailInput.trim()) {
      toastError('Please enter an email address');
      return;
    }
    const cleanEmail = missingEmailInput.trim();
    if (temporaryContact) {
      setTemporaryContact({
        ...temporaryContact,
        email: cleanEmail,
      });
      setMissingEmailInput('');
      success('Email updated', 'Added email to temporary contact.');
    } else if (currentContact && user) {
      try {
        await editContact(currentContact.id, {
          email: cleanEmail,
        });
        setMissingEmailInput('');
        success('Email saved', 'Saved email to contact record.');
      } catch (err: any) {
        toastError(err.message || 'Failed to update contact');
      }
    }
  };

  const handleGenerate = async () => {
    if (!currentContact) {
      toastError('Please select or add a target contact.');
      return;
    }

    // Check usage limits if on free plan
    if (userProfile?.plan === 'free' && (userProfile.aiGenerationsCount || 0) >= 25) {
      openUpgradeModal("You've reached your monthly AI message generation limit on the Free plan.");
      return;
    }

    setGenerating(true);

    try {
      let combinedContext = contextInput.trim();
      if (extraContextDetails?.project) {
        combinedContext += ` Project/Service: ${extraContextDetails.project}.`;
      }
      if (extraContextDetails?.amount != null) {
        combinedContext += ` Amount: ${extraContextDetails.currency || '$'}${extraContextDetails.amount}.`;
      }
      if (currentContact.notes) {
        combinedContext += ` Notes: ${currentContact.notes}.`;
      }

      const result = await generateFollowUpMessage({
        contact: currentContact,
        followUp: currentFollowUp || (extraContextDetails?.amount != null ? {
          title: extraContextDetails.project || 'Proposal follow-up',
          amount: extraContextDetails.amount,
          currency: extraContextDetails.currency || '$',
        } : undefined),
        tone,
        channel,
        additionalContext: combinedContext,
        userId: user?.uid,
      });

      setSubject(result.subject || '');
      setMessageText(result.message);
      await incrementAiUsage();

      // Only log saved contacts to permanent database history
      if (user && !('isTemporary' in currentContact && currentContact.isTemporary)) {
        await logGeneratedMessage(user.uid, {
          followUpId: currentFollowUp?.id,
          contactId: currentContact.id,
          contactName: currentContact.name,
          tone,
          channel,
          context: combinedContext,
          subject: result.subject,
          generatedContent: result.message,
          finalContent: result.message,
        });

        await trackEvent('ai_message_generated', user.uid, {
          tone,
          channel,
          contactId: currentContact.id,
          followUpId: currentFollowUp?.id,
        });
      }

      success('Message generated!', 'Review, edit, or dispatch directly.');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to generate message. Please try again.';
      if (errMsg.toLowerCase().includes('limit reached') || errMsg.toLowerCase().includes('upgrade')) {
        openUpgradeModal(errMsg);
      } else {
        toastError(errMsg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    const resolvedSubj = resolveMessageVariables(subject);
    const resolvedBody = resolveMessageVariables(messageText);
    setSubject(resolvedSubj);
    setMessageText(resolvedBody);

    const textToCopy = channel === 'email' && resolvedSubj ? `Subject: ${resolvedSubj}\n\n${resolvedBody}` : resolvedBody;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    info('Copied to clipboard (variables resolved)');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!currentContact) {
      toastError('Please select a contact');
      return;
    }
    const phone = currentContact.whatsapp || currentContact.phone;

    if (!phone) {
      toastError('Add a WhatsApp number to continue.');
      return;
    }

    const resolvedBody = resolveMessageVariables(messageText);
    setMessageText(resolvedBody);

    const sanitizedNumber = phone.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(resolvedBody);
    const whatsappUrl = `https://wa.me/${sanitizedNumber}?text=${encodedText}`;

    if (user && !('isTemporary' in currentContact && currentContact.isTemporary)) {
      trackEvent('whatsapp_opened', user.uid, { contactId: currentContact.id });
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenEmail = () => {
    if (!currentContact) {
      toastError('Please select a contact');
      return;
    }
    const email = currentContact.email;
    if (!email) {
      toastError('Add an email address to continue.');
      return;
    }

    const resolvedSubj = resolveMessageVariables(
      subject || (currentFollowUp?.title ? `Following up on ${currentFollowUp.title}` : 'Following up')
    );
    const resolvedBody = resolveMessageVariables(messageText);

    setSubject(resolvedSubj);
    setMessageText(resolvedBody);

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(resolvedSubj)}&body=${encodeURIComponent(resolvedBody)}`;

    if (user && !('isTemporary' in currentContact && currentContact.isTemporary)) {
      trackEvent('email_opened', user.uid, { contactId: currentContact.id });
    }

    window.open(mailtoUrl, '_blank');
  };

  // Direct server-side real email delivery
  const handleSendDirectEmail = async () => {
    if (!currentContact?.email) {
      toastError('Add an email address to continue.');
      return;
    }
    const resolvedSubj = resolveMessageVariables(subject.trim());
    const resolvedBody = resolveMessageVariables(messageText.trim());

    if (!resolvedSubj) {
      toastError('Please enter an email subject line.');
      return;
    }
    if (!resolvedBody) {
      toastError('Please enter message text before sending.');
      return;
    }

    setSubject(resolvedSubj);
    setMessageText(resolvedBody);

    setIsSendingDirectEmail(true);
    try {
      const idempotencyKey = `direct-${user?.uid || 'guest'}-${currentFollowUp?.id || currentContact.id}-${Date.now()}`;
      const result = await sendDirectEmail({
        userId: user?.uid || 'guest',
        contactId: currentContact.id,
        followUpId: currentFollowUp?.id,
        to: currentContact.email,
        subject: resolvedSubj,
        body: resolvedBody,
        idempotencyKey,
      });

      if (result.success && result.status === 'sent') {
        success(
          'Email sent successfully!',
          `Delivered to ${currentContact.email} via ${result.provider} (ID: ${result.providerMessageId})`
        );
        if (currentFollowUp && user) {
          await updateFollowUp(user.uid, currentFollowUp.id, {
            status: 'contacted',
            lastContactedAt: new Date().toISOString(),
          });
        }
        closeAiModal();
      } else {
        toastError(result.error || 'Provider rejected email delivery.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to dispatch email.');
    } finally {
      setIsSendingDirectEmail(false);
    }
  };

  // Automated server-side scheduled email dispatch
  const handleScheduleEmail = async (preset: 'tomorrow' | 'in_3_days' | 'custom') => {
    if (!currentContact?.email) {
      toastError('Add an email address to continue.');
      return;
    }
    const resolvedSubj = resolveMessageVariables(subject.trim());
    const resolvedBody = resolveMessageVariables(messageText.trim());

    if (!resolvedSubj) {
      toastError('Please enter an email subject line.');
      return;
    }
    if (!resolvedBody) {
      toastError('Please enter message text before scheduling.');
      return;
    }

    setSubject(resolvedSubj);
    setMessageText(resolvedBody);

    let scheduledDate = new Date();
    if (preset === 'tomorrow') {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(9, 0, 0, 0);
    } else if (preset === 'in_3_days') {
      scheduledDate.setDate(scheduledDate.getDate() + 3);
      scheduledDate.setHours(9, 0, 0, 0);
    } else {
      if (!customScheduleDate) {
        toastError('Please select a date.');
        return;
      }
      const [hours, minutes] = (customScheduleTime || '09:00').split(':');
      scheduledDate = new Date(`${customScheduleDate}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`);
      if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
        toastError('Please choose a future date and time.');
        return;
      }
    }

    setIsSchedulingEmail(true);
    try {
      const idempotencyKey = `sched-${user?.uid || 'guest'}-${currentFollowUp?.id || currentContact.id}-${scheduledDate.toISOString()}`;
      const result = await scheduleEmail({
        userId: user?.uid || 'guest',
        contactId: currentContact.id,
        followUpId: currentFollowUp?.id,
        to: currentContact.email,
        subject: resolvedSubj,
        body: resolvedBody,
        scheduledFor: scheduledDate.toISOString(),
        idempotencyKey,
      });

      if (result.success) {
        success(
          'Email scheduled!',
          `Server will automatically dispatch to ${currentContact.email} on ${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        );
        setShowSchedulePicker(false);
        closeAiModal();
      } else {
        toastError(result.error || 'Failed to schedule email.');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to schedule email.');
    } finally {
      setIsSchedulingEmail(false);
    }
  };

  const handleMarkAsContacted = async () => {
    if (!currentFollowUp || !user) {
      toastError('No active follow-up selected.');
      return;
    }
    try {
      await updateFollowUp(user.uid, currentFollowUp.id, {
        status: 'contacted',
        lastContactedAt: new Date().toISOString(),
      });
      success('Status updated', 'Marked follow-up as contacted.');
      closeAiModal();
    } catch (err) {
      toastError('Failed to update status');
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!currentFollowUp) {
      toastError('No active follow-up selected.');
      return;
    }
    try {
      await markCompleted(currentFollowUp.id);
      success('Follow-up completed!', 'Great job closing the loop.');
      closeAiModal();
    } catch (err) {
      toastError('Failed to complete follow-up');
    }
  };

  const hasWhatsAppNumber = Boolean(
    currentContact?.whatsapp?.trim() || currentContact?.phone?.trim()
  );
  const hasEmailAddress = Boolean(currentContact?.email?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-7 text-slate-800 relative my-6 animate-in zoom-in-95 duration-200 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              {composerMode === 'ai' ? <Sparkles className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {composerMode === 'ai' ? 'AI Follow-Up Generator' : 'Manual Follow-Up Composer'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {composerMode === 'ai'
                  ? 'Generate high-converting, fact-accurate messages in seconds'
                  : 'Write and personalize your own message with variables'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setComposerMode('ai')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  composerMode === 'ai'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                AI Assisted
              </button>
              <button
                type="button"
                onClick={() => setComposerMode('manual')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  composerMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                Write Manually
              </button>
            </div>
            <button
              onClick={closeAiModal}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto pr-1 py-4 space-y-4 flex-1">
          {/* Target Contact Selector Component */}
          <ContactSelector
            contacts={contacts}
            selectedContact={currentContact || null}
            onSelectContact={(c) => {
              if ('isTemporary' in c && c.isTemporary) {
                setTemporaryContact(c as TemporaryContact);
                setSelectedContactId('');
              } else {
                setSelectedContactId(c.id);
                setTemporaryContact(null);
              }
            }}
            onSaveNewContact={handleSaveNewContact}
            onUseTemporaryContact={handleUseTemporaryContact}
            onSaveTemporaryAsPermanent={handleSaveTemporaryAsPermanent}
          />

          {/* Linked Follow-Up & Target Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Linked Follow-Up (Optional)
              </label>
              <select
                value={selectedFollowUpId}
                onChange={(e) => setSelectedFollowUpId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="">-- General follow-up --</option>
                {followUps
                  .filter((f) => !selectedContactId || f.contactId === selectedContactId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} ({f.type} {f.amount ? `· $${f.amount}` : ''})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Channel Formatting
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  { id: 'phone', label: 'Phone Call', icon: Phone },
                ].map((ch) => {
                  const Icon = ch.icon;
                  const isSelected = channel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setChannel(ch.id as FollowUpChannel)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{ch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Validation Notice: Missing WhatsApp Number */}
          {channel === 'whatsapp' && currentContact && !hasWhatsAppNumber && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Add a WhatsApp number to continue.</p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    {currentContact.name} does not have a phone or WhatsApp number. Enter one below to open WhatsApp directly:
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="tel"
                  value={missingNumberInput}
                  onChange={(e) => setMissingNumberInput(e.target.value)}
                  placeholder="e.g. +1 555 019 2834"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSaveMissingNumber}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                >
                  Save Number
                </button>
              </div>
            </div>
          )}

          {/* Validation Notice: Missing Email Address */}
          {channel === 'email' && currentContact && !hasEmailAddress && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Add an email address to continue.</p>
                  <p className="text-amber-800 text-[11px] mt-0.5">
                    {currentContact.name} does not have an email stored. Enter one below to send or schedule emails:
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="email"
                  value={missingEmailInput}
                  onChange={(e) => setMissingEmailInput(e.target.value)}
                  placeholder="e.g. client@example.com"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSaveMissingEmail}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
                >
                  Save Email
                </button>
              </div>
            </div>
          )}

          {/* AI-Assisted Controls (Tone & Context) */}
          {composerMode === 'ai' && (
            <>
              {/* Tone Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Select Tone
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {toneOptions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        tone === t.id
                          ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 font-semibold text-blue-950'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold">{t.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Context Input & Chips */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Context & Real Facts (Zero Hallucination Input)
                </label>
                <textarea
                  rows={2}
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  placeholder="e.g. Sent project proposal last week. Client requested time to review internally."
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none placeholder:text-slate-400"
                />
                {/* Quick Context Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {quickContextChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setContextInput(chip)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !currentContact}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating follow-up message...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {messageText ? 'Regenerate Message' : 'Generate Follow-Up Message'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Output Display / Composer Area (Available in Manual Mode OR after AI Generation) */}
          {(messageText || composerMode === 'manual') && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  {composerMode === 'ai' ? (
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  {composerMode === 'ai' ? 'Generated Message' : 'Manual Follow-Up Composer'}
                </span>
                <div className="flex items-center gap-1.5">
                  {composerMode === 'ai' && (
                    <button
                      type="button"
                      onClick={() => setEditMode(!editMode)}
                      className="text-xs font-semibold px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-200/70 transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      {editMode ? 'Done' : 'Edit'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 shadow-xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Text'}
                  </button>
                </div>
              </div>

              {/* Personalization Variable Insertion Chips */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3 text-blue-600" />
                    Insert Personalization Variables
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyPersonalization}
                    className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 underline underline-offset-2"
                  >
                    <Wand2 className="w-2.5 h-2.5" />
                    Preview / Resolve Now
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {variableTags.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 text-slate-700 text-[11px] font-mono transition-colors"
                      title={`Click to append ${v.tag} (${v.label})`}
                    >
                      + {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Line (Email Only) */}
              {channel === 'email' && (
                <div>
                  <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Subject Line *
                  </span>
                  {editMode || composerMode === 'manual' ? (
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Following up on {{project_name}} for {{company_name}}"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-900 bg-white p-2.5 rounded-xl border border-slate-200">
                      {subject || 'No subject line'}
                    </p>
                  )}
                </div>
              )}

              {/* Message Body Textarea */}
              <div>
                <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Message Body *
                </span>
                {editMode || composerMode === 'manual' ? (
                  <textarea
                    rows={5}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your follow-up message here... Click any variable chip above to insert dynamic tags."
                    className="w-full p-3 rounded-xl border border-slate-300 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-normal leading-relaxed"
                  />
                ) : (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {messageText}
                  </div>
                )}
              </div>

              {/* Action Buttons: Multi-Channel Dispatch */}
              <div className="pt-2 space-y-2.5">
                {/* Email Channel Action Suite */}
                {channel === 'email' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Direct Real Email Send */}
                      <button
                        type="button"
                        onClick={handleSendDirectEmail}
                        disabled={isSendingDirectEmail || !currentContact?.email || !messageText.trim()}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        title={
                          emailConfig.isConfigured
                            ? 'Deliver real email via Resend'
                            : 'Resend API key not set - will report provider status'
                        }
                      >
                        {isSendingDirectEmail ? (
                          <>
                            <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Dispatching...
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Send Email Now
                          </>
                        )}
                      </button>

                      {/* Schedule Button */}
                      <button
                        type="button"
                        onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                        disabled={isSchedulingEmail || !currentContact?.email || !messageText.trim()}
                        className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        Schedule Email
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>

                      {/* Client Mailto Fallback */}
                      <button
                        type="button"
                        onClick={handleOpenEmail}
                        disabled={!currentContact?.email}
                        className="py-2.5 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Open in Mail App
                      </button>
                    </div>

                    {/* Schedule Picker Dropdown Panel */}
                    {showSchedulePicker && (
                      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-md space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            Automated Server Delivery Schedule
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">Executes server-side</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleScheduleEmail('tomorrow')}
                            disabled={isSchedulingEmail}
                            className="p-2 rounded-lg border border-slate-200 text-left hover:border-blue-500 hover:bg-blue-50 text-xs font-medium text-slate-700 transition-colors"
                          >
                            <p className="font-bold text-slate-900">Tomorrow, 9:00 AM</p>
                            <p className="text-[10px] text-slate-500">Next business day morning</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleScheduleEmail('in_3_days')}
                            disabled={isSchedulingEmail}
                            className="p-2 rounded-lg border border-slate-200 text-left hover:border-blue-500 hover:bg-blue-50 text-xs font-medium text-slate-700 transition-colors"
                          >
                            <p className="font-bold text-slate-900">In 3 Days, 9:00 AM</p>
                            <p className="text-[10px] text-slate-500">Mid-week check-in</p>
                          </button>
                        </div>

                        {/* Custom Date & Time Picker */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            Custom Date & Time
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={customScheduleDate}
                              onChange={(e) => setCustomScheduleDate(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800"
                            />
                            <input
                              type="time"
                              value={customScheduleTime}
                              onChange={(e) => setCustomScheduleTime(e.target.value)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleScheduleEmail('custom')}
                            disabled={isSchedulingEmail}
                            className="w-full py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {isSchedulingEmail ? 'Scheduling...' : 'Confirm Scheduled Send'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp Channel Action Suite */}
                {channel === 'whatsapp' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      disabled={!hasWhatsAppNumber}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Open WhatsApp with Message
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="py-2.5 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs shadow-xs flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      Copy Text
                    </button>
                  </div>
                )}

                {/* Phone Call Channel Action Suite */}
                {channel === 'phone' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-amber-600" />
                        <span>
                          Phone Number:{' '}
                          <strong className="text-amber-950">
                            {currentContact?.phone || currentContact?.whatsapp || 'No number saved'}
                          </strong>
                        </span>
                      </div>
                      {(currentContact?.phone || currentContact?.whatsapp) && (
                        <a
                          href={`tel:${(currentContact.phone || currentContact.whatsapp || '').replace(/[^\d+]/g, '')}`}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          Call Now
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Mark Contacted helper */}
                {currentFollowUp && (
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleMarkAsContacted}
                      className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5 text-blue-600" />
                      Mark as Contacted
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span>
            {composerMode === 'ai'
              ? 'AI strictly uses provided facts. Never fabricates dates or amounts.'
              : 'Manual Composer: Type directly and insert tags for dynamic personalization.'}
          </span>
          {currentFollowUp && (
            <button
              onClick={handleMarkAsCompleted}
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              Mark follow-up as fully completed
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
