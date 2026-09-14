import React, { useState, useEffect, useRef } from 'react';
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
  logDeliveryAction,
  type EmailConfig,
} from '../../services/email';
import {
  sendEmailViaGmail,
  createGmailDraft,
  isUnauthorizedDomainError,
} from '../../services/gmail';
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
  AlertTriangle,
  TestTube2,
  Phone,
  Calendar,
  Clock,
  ChevronDown,
  FileText,
  Tag,
  Wand2,
  Paperclip,
  Trash2,
  CheckCheck,
  FileCheck,
} from 'lucide-react';
import type { MessageTone, FollowUpChannel, Contact, FollowUp } from '../../types';
import { ContactSelector, type TemporaryContact, type ExtraContactDetails } from './ContactSelector';

export const AiMessageGeneratorModal: React.FC = () => {
  const {
    user,
    userProfile,
    incrementAiUsage,
    isGmailConnected,
    isGmailPreviewMode,
    gmailUserEmail,
    connectGmail,
    enablePreviewGmail,
    gmailAccessToken,
  } = useAuth();
  const {
    aiModalOpen,
    aiTargetFollowUp,
    aiTargetContact,
    aiInitialTemplate,
    closeAiModal,
    contacts,
    followUps,
    markCompleted,
    openUpgradeModal,
    addContact,
    editContact,
    aiDraft,
    updateAiDraft,
    generateAiFollowUpMessage,
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
  const [isSendingViaGmail, setIsSendingViaGmail] = useState<boolean>(false);
  const [isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);
  const [isSchedulingEmail, setIsSchedulingEmail] = useState<boolean>(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState<boolean>(false);
  const [customScheduleDate, setCustomScheduleDate] = useState<string>('');
  const [customScheduleTime, setCustomScheduleTime] = useState<string>('09:00');
  const [unauthorizedDomainNotice, setUnauthorizedDomainNotice] = useState<{
    domain: string;
    isOpen: boolean;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  // Multi-Channel attachments & real delivery receipt
  const [attachments, setAttachments] = useState<
    Array<{ filename: string; content: string; mimeType: string; size: number }>
  >([]);
  const [deliveryReceipt, setDeliveryReceipt] = useState<{
    channel: string;
    recipient: string;
    sentAt: string;
    status: string;
    providerMessageId?: string;
    details?: string;
  } | null>(null);
  const [callNotes, setCallNotes] = useState<string>('');
  const [improvingWithAi, setImprovingWithAi] = useState<boolean>(false);

  // Load email configuration on mount
  useEffect(() => {
    getEmailConfig().then(setEmailConfig).catch(() => {});
  }, []);

  // Track open state transition to prevent background re-renders or updates from wiping generated text
  const prevOpenRef = useRef<boolean>(false);

  // Sync state when modal opens with target follow-up / contact
  useEffect(() => {
    if (aiModalOpen && !prevOpenRef.current) {
      prevOpenRef.current = true;
      getEmailConfig().then(setEmailConfig).catch(() => {});
      setAttachments([]);
      setDeliveryReceipt(null);
      setCallNotes('');

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
        const ch = aiTargetFollowUp.channel || 'whatsapp';
        setChannel(ch);
        if (aiTargetFollowUp.description) {
          setContextInput(aiTargetFollowUp.description);
        }
        if (ch === 'email') {
          setSubject(aiTargetFollowUp.title ? `Following up on ${aiTargetFollowUp.title}` : 'Quick follow-up');
        } else {
          setSubject('');
        }
      } else {
        setSelectedFollowUpId('');
        if (aiTargetContact?.name) {
          setSubject(`Following up with ${aiTargetContact.name}`);
        } else {
          setSubject('Quick follow-up');
        }
      }

      setExtraContextDetails(null);
      setCopied(false);
      setEditMode(false);
      setShowSchedulePicker(false);
      setMissingNumberInput('');
      setMissingEmailInput('');

      if (aiInitialTemplate) {
        setComposerMode('manual');
        if (aiInitialTemplate.channel) setChannel(aiInitialTemplate.channel);
        if (aiInitialTemplate.tone) setTone(aiInitialTemplate.tone);
        if (aiInitialTemplate.subject) setSubject(aiInitialTemplate.subject);
        if (aiInitialTemplate.message) setMessageText(aiInitialTemplate.message);
      } else if (aiDraft && aiDraft.messageText) {
        // Restore existing draft to prevent user text disappearance
        setComposerMode('manual');
        setMessageText(aiDraft.messageText);
        if (aiDraft.subject) setSubject(aiDraft.subject);
        if (aiDraft.channel) setChannel(aiDraft.channel);
        if (aiDraft.tone) setTone(aiDraft.tone);
        if (aiDraft.contextInput) setContextInput(aiDraft.contextInput);
      } else {
        setComposerMode('ai');
        setMessageText('');
      }

      // Default custom schedule date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCustomScheduleDate(tomorrow.toISOString().split('T')[0]);
    } else if (!aiModalOpen) {
      prevOpenRef.current = false;
    }
  }, [aiModalOpen, aiTargetFollowUp, aiTargetContact, aiInitialTemplate]);

  // Keep persistent AI draft in sync with current text to protect user progress during re-renders
  useEffect(() => {
    if (aiModalOpen && (messageText || subject || contextInput)) {
      updateAiDraft({
        messageText,
        subject,
        channel,
        tone,
        contextInput,
        contactId: selectedContactId,
        followUpId: selectedFollowUpId,
      });
    }
  }, [aiModalOpen, messageText, subject, channel, tone, contextInput, selectedContactId, selectedFollowUpId]);

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
      '{{invoice_number}}': currentFollowUp?.id ? `INV-${currentFollowUp.id.slice(-5).toUpperCase()}` : 'INV-001',
      '{{pain_point}}': 'operational efficiency',
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

      const result = await generateAiFollowUpMessage({
        contact: currentContact as Contact,
        followUp: currentFollowUp || (extraContextDetails?.amount != null ? ({
          title: extraContextDetails.project || 'Proposal follow-up',
          amount: extraContextDetails.amount,
          currency: extraContextDetails.currency || '$',
        } as any) : undefined),
        tone,
        channel,
        additionalContext: combinedContext,
        project: extraContextDetails?.project,
        amount: extraContextDetails?.amount,
        currency: extraContextDetails?.currency || '$',
      });

      setSubject(result.subject);
      setMessageText(result.message);
      setComposerMode('manual');
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
 
  const handleImproveWithAi = async () => {
    if (!messageText.trim()) {
      toastError('Draft or paste some text first before improving with AI.');
      return;
    }
    setImprovingWithAi(true);
    try {
      const instruction = `Improve this follow-up message to sound more concise, compelling, and effective. Preserve key facts and variables. Tone: ${tone}. Channel: ${channel}. Message:\n${messageText}`;
      const contactObj = currentContact || {
        id: 'c-temp',
        userId: user?.uid || '',
        name: currentFollowUp?.contactName || 'Contact',
        company: currentFollowUp?.contactCompany,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const result = await generateFollowUpMessage({
        contact: contactObj,
        followUp: currentFollowUp || undefined,
        tone,
        channel,
        additionalContext: instruction,
        userId: user?.uid,
        isPro: userProfile?.plan === 'pro',
        currentCount: userProfile?.aiGenerationsCount || 0,
      });

      if (result.message) {
        setMessageText(result.message);
        if (result.subject && channel === 'email') {
          setSubject(result.subject);
        }
        await incrementAiUsage();
        success('Message polished with AI!', 'Refined for tone, clarity, and higher response rate.');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to polish message with AI.';
      if (errMsg.toLowerCase().includes('limit reached') || errMsg.toLowerCase().includes('upgrade')) {
        openUpgradeModal(errMsg);
      } else {
        toastError(errMsg);
      }
    } finally {
      setImprovingWithAi(false);
    }
  };

  // File attachment handling
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        toastError(`File "${file.name}" exceeds 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopy = async () => {
    const resolvedSubj = resolveMessageVariables(subject);
    const resolvedBody = resolveMessageVariables(messageText);
    setSubject(resolvedSubj);
    setMessageText(resolvedBody);

    const textToCopy = channel === 'email' && resolvedSubj ? `Subject: ${resolvedSubj}\n\n${resolvedBody}` : resolvedBody;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);

    if (user && currentContact && !('isTemporary' in currentContact && currentContact.isTemporary)) {
      try {
        await logDeliveryAction({
          userId: user.uid,
          contactId: currentContact.id,
          followUpId: currentFollowUp?.id,
          channel: 'manual',
          type: 'manual_copied',
          title: `Manual Follow-Up Copied for ${currentContact.name}`,
          description: `Message copied: "${resolvedBody.slice(0, 90)}${resolvedBody.length > 90 ? '...' : ''}"`,
          recipient: currentContact.name,
        });
      } catch (e) {
        console.warn('Failed to log manual delivery action:', e);
      }
    }

    if (currentFollowUp && user) {
      await updateFollowUp(user.uid, currentFollowUp.id, {
        status: 'contacted',
        lastContactedAt: new Date().toISOString(),
      });
    }

    setDeliveryReceipt({
      channel: 'MANUAL/COPY',
      recipient: currentContact ? currentContact.name : 'Selected Recipient',
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Copied to Clipboard',
      details: 'Follow-up text copied and logged to timeline. Ready to paste.',
    });

    info('Copied to clipboard (variables resolved)');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = async () => {
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

    // Open WhatsApp Web or App directly
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    if (user && !('isTemporary' in currentContact && currentContact.isTemporary)) {
      trackEvent('whatsapp_opened', user.uid, { contactId: currentContact.id });
      try {
        await logDeliveryAction({
          userId: user.uid,
          contactId: currentContact.id,
          followUpId: currentFollowUp?.id,
          channel: 'whatsapp',
          type: 'whatsapp_opened',
          title: `WhatsApp Dispatched to ${currentContact.name}`,
          description: `Message: "${resolvedBody.slice(0, 90)}${resolvedBody.length > 90 ? '...' : ''}"`,
          recipient: `${currentContact.name} (${phone})`,
        });
      } catch (e) {
        console.warn('Failed to log WhatsApp delivery action:', e);
      }
    }

    if (currentFollowUp && user) {
      await updateFollowUp(user.uid, currentFollowUp.id, {
        status: 'contacted',
        lastContactedAt: new Date().toISOString(),
      });
    }

    setDeliveryReceipt({
      channel: 'WHATSAPP',
      recipient: `${currentContact.name} (${phone})`,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Dispatched to WhatsApp',
      details: 'Direct wa.me protocol triggered and logged in contact timeline.',
    });

    success('WhatsApp opened!', `Follow-up dispatched to ${currentContact.name}`);
  };

  const handleCallInitiation = async () => {
    if (!currentContact) {
      toastError('Please select a contact');
      return;
    }
    const phone = currentContact.phone || currentContact.whatsapp;
    if (!phone) {
      toastError('Add a phone number to continue.');
      return;
    }

    const sanitizedNumber = phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${sanitizedNumber}`;

    if (user && !('isTemporary' in currentContact && currentContact.isTemporary)) {
      trackEvent('call_initiated', user.uid, { contactId: currentContact.id });
      try {
        await logDeliveryAction({
          userId: user.uid,
          contactId: currentContact.id,
          followUpId: currentFollowUp?.id,
          channel: 'phone',
          type: 'call_initiated',
          title: `Phone Call Initiated to ${currentContact.name}`,
          description: callNotes ? `Notes: ${callNotes}` : `Direct call dialed to ${phone}`,
          recipient: `${currentContact.name} (${phone})`,
        });
      } catch (e) {
        console.warn('Failed to log call delivery action:', e);
      }
    }

    if (currentFollowUp && user) {
      await updateFollowUp(user.uid, currentFollowUp.id, {
        status: 'contacted',
        lastContactedAt: new Date().toISOString(),
      });
    }

    setDeliveryReceipt({
      channel: 'PHONE/CALL',
      recipient: `${currentContact.name} (${phone})`,
      sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Call Initiated',
      details: callNotes ? `Logged with notes: "${callNotes}"` : 'Tel dialer protocol launched and recorded.',
    });

    success('Call dialed!', `Follow-up logged for ${currentContact.name}`);
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

    // Trigger mail client safely in-page without creating a blank "Untitled" window
    const link = document.createElement('a');
    link.href = mailtoUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {}
    }, 250);
    success('Launching email client...');
  };

  const handleOpenGmailWeb = () => {
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

    if (user && !('isTemporary' in currentContact && currentContact.isTemporary)) {
      trackEvent('email_opened', user.uid, { contactId: currentContact.id, provider: 'gmail_web' });
    }

    const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(resolvedSubj)}&body=${encodeURIComponent(resolvedBody)}`;
    window.open(webGmailUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendWithPreviewSandbox = () => {
    const email = user?.email || userProfile?.email || 'founder@business.com';
    enablePreviewGmail(email);
    setUnauthorizedDomainNotice(null);
    info('Preview Sandbox Activated', `Using ${email} in sandbox mode. Dispatching now...`);
    setTimeout(() => {
      handleSendViaGmail();
    }, 150);
  };

  const handleCopyModalDomain = () => {
    const domain = unauthorizedDomainNotice?.domain || (typeof window !== 'undefined' ? window.location.hostname : '');
    if (domain) {
      navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  // Direct server-side real email delivery
  const handleSendDirectEmail = async () => {
    if (!currentContact?.email) {
      toastError('Add an email address to continue.');
      return;
    }
    const defaultSubj = currentFollowUp?.title
      ? `Following up on ${currentFollowUp.title}`
      : currentContact?.name
      ? `Following up with ${currentContact.name}`
      : 'Quick follow-up';
    const effectiveSubj = subject.trim() || defaultSubj;
    const resolvedSubj = resolveMessageVariables(effectiveSubj);
    const resolvedBody = resolveMessageVariables(messageText.trim());

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
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          mimeType: a.mimeType,
          size: a.size,
        })),
      });

      if (result.success && result.status === 'sent') {
        setDeliveryReceipt({
          channel: 'EMAIL',
          recipient: `${currentContact.name} (${currentContact.email})`,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'Delivered',
          providerMessageId: result.providerMessageId,
          details: `Dispatched via ${result.provider} · ${attachments.length > 0 ? `${attachments.length} attachment(s)` : 'No attachments'}`,
        });

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
      } else {
        toastError(result.error || 'Provider rejected email delivery.');
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('gmail.com') || errMsg.includes('domain is not verified')) {
        toastError('The gmail.com domain is not verified on Resend. Click "Send with Gmail" below to send directly with your Google account!');
      } else {
        toastError(errMsg || 'Failed to dispatch email.');
      }
    } finally {
      setIsSendingDirectEmail(false);
    }
  };

  // Direct send via official Google Workspace / Gmail API
  const handleSendViaGmail = async () => {
    if (!currentContact?.email) {
      toastError('Add an email address to continue.');
      return;
    }
    const defaultSubj = currentFollowUp?.title
      ? `Following up on ${currentFollowUp.title}`
      : currentContact?.name
      ? `Following up with ${currentContact.name}`
      : 'Quick follow-up';
    const effectiveSubj = subject.trim() || defaultSubj;
    const resolvedSubj = resolveMessageVariables(effectiveSubj);
    const resolvedBody = resolveMessageVariables(messageText.trim());

    if (!resolvedBody) {
      toastError('Please enter message text before sending.');
      return;
    }

    setSubject(resolvedSubj);
    setMessageText(resolvedBody);

    setIsSendingViaGmail(true);
    setUnauthorizedDomainNotice(null);
    try {
      let activeToken = gmailAccessToken;
      if (!activeToken) {
        try {
          const authResult = await connectGmail();
          activeToken = authResult.accessToken;
        } catch (authErr: any) {
          if (isUnauthorizedDomainError(authErr)) {
            const domain = typeof window !== 'undefined' ? window.location.hostname : 'this preview domain';
            setUnauthorizedDomainNotice({ domain, isOpen: true });
            return;
          }
          throw authErr;
        }
      }

      const res = await sendEmailViaGmail({
        to: currentContact.email,
        subject: resolvedSubj,
        body: resolvedBody,
        accessToken: activeToken,
        fromEmail: gmailUserEmail || undefined,
        userId: user?.uid,
        contactId: currentContact.id,
        followUpId: currentFollowUp?.id,
      });

      if (res.success) {
        const isPreview = activeToken.startsWith('preview-');
        success(
          isPreview ? 'Simulated Gmail Delivery (Preview Mode)' : 'Email Sent via Gmail!',
          `Message delivered to ${currentContact.email} ${isPreview ? '(Recorded in Sandbox)' : `from ${res.fromEmail || gmailUserEmail}`}`
        );
        if (currentFollowUp && user) {
          await updateFollowUp(user.uid, currentFollowUp.id, {
            status: 'contacted',
            lastContactedAt: new Date().toISOString(),
          });
        }
        closeAiModal();
      }
    } catch (err: any) {
      if (isUnauthorizedDomainError(err)) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this preview domain';
        setUnauthorizedDomainNotice({ domain, isOpen: true });
        return;
      }
      console.error('Gmail send error:', err);
      toastError(err.message || 'Failed to send email via Gmail.');
    } finally {
      setIsSendingViaGmail(false);
    }
  };

  // Create draft directly in Gmail inbox
  const handleCreateGmailDraft = async () => {
    if (!currentContact?.email) {
      toastError('Add an email address to continue.');
      return;
    }
    const defaultSubj = currentFollowUp?.title
      ? `Following up on ${currentFollowUp.title}`
      : currentContact?.name
      ? `Following up with ${currentContact.name}`
      : 'Quick follow-up';
    const effectiveSubj = subject.trim() || defaultSubj;
    const resolvedSubj = resolveMessageVariables(effectiveSubj);
    const resolvedBody = resolveMessageVariables(messageText.trim());

    if (!resolvedBody) {
      toastError('Message body is required.');
      return;
    }

    setIsCreatingDraft(true);
    setUnauthorizedDomainNotice(null);
    try {
      let activeToken = gmailAccessToken;
      if (!activeToken) {
        try {
          const authResult = await connectGmail();
          activeToken = authResult.accessToken;
        } catch (authErr: any) {
          if (isUnauthorizedDomainError(authErr)) {
            const domain = typeof window !== 'undefined' ? window.location.hostname : 'this preview domain';
            setUnauthorizedDomainNotice({ domain, isOpen: true });
            return;
          }
          throw authErr;
        }
      }

      await createGmailDraft({
        to: currentContact.email,
        subject: resolvedSubj,
        body: resolvedBody,
        accessToken: activeToken,
        fromEmail: gmailUserEmail || undefined,
      });

      success('Saved as Gmail Draft!', `Draft created in your Gmail inbox for ${currentContact.email}.`);
    } catch (err: any) {
      if (isUnauthorizedDomainError(err)) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : 'this preview domain';
        setUnauthorizedDomainNotice({ domain, isOpen: true });
        return;
      }
      toastError(err.message || 'Failed to create Gmail draft.');
    } finally {
      setIsCreatingDraft(false);
    }
  };

  // Automated server-side scheduled email dispatch
  const handleScheduleEmail = async (preset: 'tomorrow' | 'in_3_days' | 'custom') => {
    if (!currentContact?.email) {
      toastError('Add an email address to continue.');
      return;
    }
    const defaultSubj = currentFollowUp?.title
      ? `Following up on ${currentFollowUp.title}`
      : currentContact?.name
      ? `Following up with ${currentContact.name}`
      : 'Quick follow-up';
    const effectiveSubj = subject.trim() || defaultSubj;
    const resolvedSubj = resolveMessageVariables(effectiveSubj);
    const resolvedBody = resolveMessageVariables(messageText.trim());

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
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          mimeType: a.mimeType,
          size: a.size,
        })),
      });

      if (result.success) {
        setDeliveryReceipt({
          channel: 'EMAIL (SCHEDULED)',
          recipient: `${currentContact.name} (${currentContact.email})`,
          sentAt: `${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          status: 'Scheduled in Queue',
          providerMessageId: result.job?.id,
          details: `Automated server cron will deliver this message · ${attachments.length > 0 ? `${attachments.length} attachment(s)` : 'No attachments'}`,
        });

        success(
          'Email scheduled!',
          `Server will automatically dispatch to ${currentContact.email} on ${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        );
        setShowSchedulePicker(false);
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
                Generate with AI
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
                Channel Dispatch
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                  { id: 'phone', label: 'Phone Call', icon: Phone },
                  { id: 'manual', label: 'Manual/Copy', icon: Copy },
                ].map((ch) => {
                  const Icon = ch.icon;
                  const isSelected = channel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        const nextChan = ch.id as FollowUpChannel;
                        setChannel(nextChan);
                        if (nextChan === 'email' && !subject.trim()) {
                          const defaultSubj = currentFollowUp?.title
                            ? `Following up on ${currentFollowUp.title}`
                            : currentContact?.name
                            ? `Following up with ${currentContact.name}`
                            : 'Quick follow-up';
                          setSubject(defaultSubj);
                        }
                      }}
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="ai-email-subject-input"
                      className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider"
                    >
                      Email Subject Line <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Editable anytime
                    </span>
                  </div>
                  <input
                    id="ai-email-subject-input"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={`e.g. Following up with ${currentContact?.name || 'client'}`}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-hidden transition-all shadow-xs"
                  />
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
                {/* Improve with AI quick-action button */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">
                    {composerMode === 'manual' ? 'Drafting manually. AI assistance optional.' : 'AI message ready to edit or polish.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleImproveWithAi}
                    disabled={improvingWithAi || !messageText.trim()}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                  >
                    {improvingWithAi ? (
                      <>
                        <span className="inline-block w-3.5 h-3.5 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
                        Polishing tone & clarity...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5 text-purple-600" />
                        Improve with AI
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Email Attachments Manager */}
              {channel === 'email' && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      Email Attachments ({attachments.length})
                    </span>
                    <label className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-blue-50 transition-colors">
                      <span>+ Attach File</span>
                      <input
                        type="file"
                        multiple
                        onChange={handleAttachmentUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.xlsx,.txt"
                      />
                    </label>
                  </div>
                  {attachments.length === 0 ? (
                    <p className="text-[11px] text-stone-400 italic">
                      No files attached. Optional: attach PDF quotes, invoices, or proposal decks (up to 10MB each).
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-xs text-stone-800 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate font-medium">{att.filename}</span>
                            <span className="text-[10px] text-stone-400 shrink-0">
                              ({(att.size / 1024).toFixed(0)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="text-stone-400 hover:text-rose-600 p-0.5 transition-colors"
                            title="Remove attachment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Real Delivery Receipt (Visible after any successful dispatch) */}
              {deliveryReceipt && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2.5 animate-in fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                        <CheckCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded-sm bg-emerald-200/80 text-emerald-900">
                            {deliveryReceipt.channel}
                          </span>
                          <span className="text-xs font-bold text-emerald-900">
                            {deliveryReceipt.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          Recipient: <strong>{deliveryReceipt.recipient}</strong> · {deliveryReceipt.sentAt}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeliveryReceipt(null)}
                      className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>

                  {deliveryReceipt.details && (
                    <p className="text-[11px] text-emerald-800 font-mono bg-emerald-100/60 p-2 rounded-lg leading-relaxed">
                      {deliveryReceipt.details}
                      {deliveryReceipt.providerMessageId && (
                        <span className="block text-[10px] text-emerald-700 mt-0.5">
                          Provider Msg ID: {deliveryReceipt.providerMessageId}
                        </span>
                      )}
                    </p>
                  )}

                  {currentFollowUp && (
                    <div className="pt-1 flex items-center justify-end gap-2 border-t border-emerald-200/80">
                      <button
                        type="button"
                        onClick={handleMarkAsCompleted}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Check className="w-3 h-3" />
                        Mark Follow-Up Completed & Close
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Multi-Channel Dispatch */}
              <div className="pt-2 space-y-2.5">
                {/* Email Channel Action Suite */}
                {channel === 'email' && (
                  <div className="space-y-3">
                    {/* Gmail Direct Dispatch Banner / Controls */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-stone-900">
                              {isGmailConnected
                                ? `Gmail Connected (${gmailUserEmail})`
                                : 'Send with Your Personal Gmail Account'}
                            </p>
                            {isGmailConnected && isGmailPreviewMode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <TestTube2 className="w-2.5 h-2.5" /> Sandbox
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-600">
                            {isGmailConnected
                              ? isGmailPreviewMode
                                ? 'Sandbox testing enabled. API calls simulate Gmail delivery.'
                                : 'Delivers directly from your authenticated Google inbox.'
                              : 'Bypasses third-party domain restrictions. 1-click Google sign-in.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isGmailConnected ? (
                          <>
                            <button
                              type="button"
                              onClick={handleSendViaGmail}
                              disabled={isSendingViaGmail || !currentContact?.email || !messageText.trim()}
                              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              {isSendingViaGmail ? (
                                <>
                                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  Send with Gmail
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={handleCreateGmailDraft}
                              disabled={isCreatingDraft || !currentContact?.email || !messageText.trim()}
                              className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 font-medium text-xs transition-colors disabled:opacity-50"
                              title="Save as draft in your Gmail inbox"
                            >
                              {isCreatingDraft ? 'Saving...' : 'Save Draft'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendViaGmail}
                            disabled={isSendingViaGmail || !currentContact?.email || !messageText.trim()}
                            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {isSendingViaGmail ? (
                              <>
                                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Connecting Google...
                              </>
                            ) : (
                              <>
                                <Mail className="w-3.5 h-3.5" />
                                Connect & Send via Gmail
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Unauthorized Domain Diagnostic Warning */}
                    {unauthorizedDomainNotice?.isOpen && (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2.5 animate-in fade-in">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-amber-900">
                              Google Sign-In requires domain authorization in Firebase
                            </p>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              Firebase blocked Google popup login because this container domain is not whitelisted:
                            </p>
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              <code className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-mono text-[11px] text-amber-900 select-all">
                                {unauthorizedDomainNotice.domain}
                              </code>
                              <button
                                type="button"
                                onClick={handleCopyModalDomain}
                                className="px-2 py-0.5 rounded bg-white border border-amber-300 text-xs font-semibold text-amber-900 flex items-center gap-1 hover:bg-amber-100 transition-colors"
                              >
                                {copiedDomain ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" /> Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" /> Copy
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
                          <button
                            type="button"
                            onClick={handleSendWithPreviewSandbox}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                          >
                            <TestTube2 className="w-3.5 h-3.5" />
                            Send with Sandbox Mode
                          </button>
                          <button
                            type="button"
                            onClick={handleOpenGmailWeb}
                            className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-red-600" />
                            Open Pre-filled in Gmail Web
                          </button>
                          <button
                            type="button"
                            onClick={() => setUnauthorizedDomainNotice(null)}
                            className="ml-auto text-xs text-amber-800 hover:text-amber-950 font-medium px-2 py-1"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Direct Real Email Send via Resend/Server */}
                      <button
                        type="button"
                        onClick={handleSendDirectEmail}
                        disabled={isSendingDirectEmail || !currentContact?.email || !messageText.trim()}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        title={
                          emailConfig.isConfigured
                            ? 'Deliver email via server mail service'
                            : 'Server email service'
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
                            Send via Mail Server
                          </>
                        )}
                      </button>

                      {/* Open Pre-filled in Web Gmail */}
                      <button
                        type="button"
                        onClick={handleOpenGmailWeb}
                        disabled={!currentContact?.email}
                        className="py-2.5 px-3.5 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        title="Open composed message in mail.google.com"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-red-600" />
                        Gmail Web
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
                        Mail App
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
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        disabled={!hasWhatsAppNumber}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Open WhatsApp & Dispatch
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
                    <p className="text-[11px] text-stone-500 italic">
                      Launches WhatsApp with the formatted message loaded and records an audit event in {currentContact?.name}'s timeline.
                    </p>
                  </div>
                )}

                {/* Phone Call Channel Action Suite */}
                {channel === 'phone' && (
                  <div className="space-y-3 p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-amber-600" />
                        <span>
                          Direct Phone:{' '}
                          <strong className="text-amber-950 text-sm">
                            {currentContact?.phone || currentContact?.whatsapp || 'No number saved'}
                          </strong>
                        </span>
                      </div>
                      {(currentContact?.phone || currentContact?.whatsapp) && (
                        <span className="text-[10px] font-bold uppercase bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                          Dialer Ready
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                        Call Notes (Optional - Recorded in Client Timeline)
                      </label>
                      <input
                        type="text"
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="e.g. Left voicemail / Client requested proposal revision by Friday..."
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleCallInitiation}
                        disabled={!currentContact?.phone && !currentContact?.whatsapp}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call Now & Record in Timeline
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual / Copy Channel Action Suite */}
                {channel === 'manual' && (
                  <div className="space-y-2.5 p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                    <p className="text-[11px] text-stone-600">
                      Copy the generated message to paste directly into your messaging tool of choice (LinkedIn InMail, Slack, SMS, or CRM).
                    </p>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Formatted Message & Log Timeline Action
                    </button>
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
