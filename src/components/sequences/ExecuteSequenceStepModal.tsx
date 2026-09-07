import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Mail,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  Wand2,
  Phone,
} from 'lucide-react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import { generateSequenceVariations } from '../../services/ai';
import { getTodayString } from '../../services/db';
import type { SequenceEnrollment, Sequence, SequenceStep, SequenceVariation, FollowUpChannel } from '../../types';

export const ExecuteSequenceStepModal: React.FC = () => {
  const {
    executeModalOpen,
    activeEnrollmentToExecute,
    activeSequenceForExecution,
    closeExecuteModal,
    executeStep,
    changeEnrollmentStatus,
  } = useFollowUp();

  const { success, error: toastError } = useToast();

  const [messageText, setMessageText] = useState('');
  const [subjectText, setSubjectText] = useState('');
  const [activeChannel, setActiveChannel] = useState<FollowUpChannel>('email');
  const [copied, setCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [variations, setVariations] = useState<SequenceVariation[]>([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);

  // Determine current step details
  const currentStepNumber = activeEnrollmentToExecute?.currentStepNumber || 1;
  const currentStep: SequenceStep | undefined = activeSequenceForExecution?.steps.find(
    (s) => s.stepNumber === currentStepNumber
  );
  const nextStep: SequenceStep | undefined = activeSequenceForExecution?.steps.find(
    (s) => s.stepNumber === currentStepNumber + 1
  );

  useEffect(() => {
    if (executeModalOpen && activeEnrollmentToExecute && currentStep) {
      const contactName = activeEnrollmentToExecute.contactName || 'there';
      const companyName = activeEnrollmentToExecute.contactCompany || 'your team';
      const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      // Substitute placeholders in body
      const resolvedAmount = activeEnrollmentToExecute.dealValue ?? activeEnrollmentToExecute.amount;
      const dealAmount = resolvedAmount != null
        ? `${activeEnrollmentToExecute.currency || '$'}${resolvedAmount.toLocaleString()}`
        : '';

      let substitutedBody = currentStep.templateBody
        .replace(/\{\{name\}\}/gi, contactName)
        .replace(/\{\{contact_name\}\}/gi, contactName)
        .replace(/\{\{company\}\}/gi, companyName)
        .replace(/\{\{amount\}\}/gi, dealAmount)
        .replace(/\{amount\}/gi, dealAmount)
        .replace(/\{\{day\}\}/gi, day);

      // Substitute subject
      let substitutedSubject = (currentStep.templateSubject || `Follow-up regarding {{company}}`)
        .replace(/\{\{name\}\}/gi, contactName)
        .replace(/\{\{contact_name\}\}/gi, contactName)
        .replace(/\{\{company\}\}/gi, companyName)
        .replace(/\{\{amount\}\}/gi, dealAmount)
        .replace(/\{amount\}/gi, dealAmount)
        .replace(/\{\{day\}\}/gi, day);

      setMessageText(substitutedBody);
      setSubjectText(substitutedSubject);
      setActiveChannel(activeEnrollmentToExecute.nextStepChannel || currentStep.channel || 'email');
      setVariations(currentStep.variations || []);
    }
  }, [executeModalOpen, activeEnrollmentToExecute, currentStep]);

  if (!executeModalOpen || !activeEnrollmentToExecute || !currentStep) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      success('Message copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError('Failed to copy text');
    }
  };

  const handleOpenWhatsApp = () => {
    const rawPhone = activeEnrollmentToExecute.contactPhone || '';
    const cleanPhone = rawPhone.replace(/[^\d+]/g, '').replace('+', '');
    const encoded = encodeURIComponent(messageText);

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
    success('WhatsApp opened!');
  };

  const handleOpenEmail = () => {
    const to = activeEnrollmentToExecute.contactEmail || '';
    const sub = encodeURIComponent(subjectText);
    const body = encodeURIComponent(messageText);
    window.location.href = `mailto:${to}?subject=${sub}&body=${body}`;
    success('Email client opened!');
  };

  const handleGenerateVariations = async () => {
    setIsGeneratingVariations(true);
    try {
      const res = await generateSequenceVariations({
        sequenceName: activeSequenceForExecution?.name || 'Sequence',
        stepTitle: currentStep.title,
        baseMessage: messageText,
        channel: activeChannel,
      });

      if (res.success && res.variations?.length) {
        setVariations(res.variations);
        success('Generated 3 AI variations for this message!');
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to generate variations');
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const handleSelectVariation = (v: SequenceVariation) => {
    const contactName = activeEnrollmentToExecute.contactName || 'there';
    const companyName = activeEnrollmentToExecute.contactCompany || 'your team';

    let content = v.content
      .replace(/\{\{name\}\}/gi, contactName)
      .replace(/\{\{company\}\}/gi, companyName);

    setMessageText(content);
    if (v.subject && activeChannel === 'email') {
      setSubjectText(v.subject.replace(/\{\{name\}\}/gi, contactName).replace(/\{\{company\}\}/gi, companyName));
    }
    success(`Applied ${v.label} tone!`);
  };

  // Complete current step and queue next step or finish
  const handleCompleteAndAdvance = async () => {
    setIsExecuting(true);
    try {
      const todayStr = getTodayString();
      const historyItem = {
        stepNumber: currentStepNumber,
        stepTitle: currentStep.title,
        channel: activeChannel,
        tone: currentStep.tone || 'friendly',
        executedAt: new Date().toISOString(),
        subject: subjectText,
        content: messageText,
        notes: `Executed via FollowFlow ${activeChannel}`,
      };

      if (nextStep) {
        await executeStep(
          activeEnrollmentToExecute.id,
          historyItem,
          nextStep.delayDays,
          nextStep.channel,
          nextStep.title
        );
        success(`Step ${currentStepNumber} completed! Step ${currentStepNumber + 1} scheduled in +${nextStep.delayDays} days.`);
      } else {
        // Last step completed!
        await executeStep(activeEnrollmentToExecute.id, historyItem);
        success(`Final step completed! Sequence for ${activeEnrollmentToExecute.contactName} is now complete!`);
      }
      closeExecuteModal();
    } catch (err: any) {
      toastError(err.message || 'Failed to advance sequence.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleMarkWon = async () => {
    setIsExecuting(true);
    try {
      await changeEnrollmentStatus(activeEnrollmentToExecute.id, 'completed');
      success(`Congratulations! Sequence marked as won & complete.`);
      closeExecuteModal();
    } catch (err: any) {
      toastError('Failed to update sequence status.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Execute Step {currentStepNumber} of {activeEnrollmentToExecute.totalSteps}
                </h2>
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  {currentStep.title}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                To: <strong className="text-slate-800">{activeEnrollmentToExecute.contactName}</strong>{' '}
                {activeEnrollmentToExecute.contactCompany && `(${activeEnrollmentToExecute.contactCompany})`}
                {' • '}
                Sequence: <em>{activeEnrollmentToExecute.sequenceName}</em>
              </p>
            </div>
          </div>
          <button
            onClick={closeExecuteModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Channel Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveChannel('whatsapp')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeChannel === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('email')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeChannel === 'email'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('sms')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeChannel === 'sms'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SMS
              </button>
            </div>

            <button
              type="button"
              onClick={handleGenerateVariations}
              disabled={isGeneratingVariations}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 transition-colors disabled:opacity-50"
            >
              <Wand2 className={`w-3.5 h-3.5 ${isGeneratingVariations ? 'animate-spin' : ''}`} />
              {isGeneratingVariations ? 'Generating...' : 'AI Variations'}
            </button>
          </div>

          {/* AI Variations Pill Selector */}
          {variations.length > 0 && (
            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold text-indigo-900 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" /> Variations:
              </span>
              {variations.map((v, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectVariation(v)}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 text-xs font-medium border border-indigo-200 shrink-0 transition-all shadow-2xs"
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {/* Email Subject Line */}
          {activeChannel === 'email' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Subject Line</label>
              <input
                type="text"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
              />
            </div>
          )}

          {/* Message Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase">
                Message Content (Ready to Dispatch)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            </div>
            <textarea
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed bg-slate-50/50"
            />
          </div>

          {/* 1-Click Launch Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {activeChannel === 'whatsapp' ? (
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Open in WhatsApp Web / App
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : activeChannel === 'email' ? (
              <button
                type="button"
                onClick={handleOpenEmail}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center justify-center gap-2 transition-all"
              >
                <Mail className="w-4 h-4" />
                Open in Default Email App
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-200 flex items-center justify-center gap-2 transition-all"
              >
                <Copy className="w-4 h-4" />
                Copy SMS Text to Send
              </button>
            )}
          </div>
        </div>

        {/* Footer: Complete / Advance Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleMarkWon}
            disabled={isExecuting}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200 transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mark Lead Won / Deal Closed
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeExecuteModal}
              className="py-2 px-3.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCompleteAndAdvance}
              disabled={isExecuting}
              className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              {nextStep
                ? `Mark Sent & Schedule Step ${currentStepNumber + 1}`
                : 'Mark Final Step Complete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
