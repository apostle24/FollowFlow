import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Mail,
  MessageSquare,
  Phone,
  Clock,
  Wand2,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  HelpCircle,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { generateSequenceStepTemplate, generateSequenceVariations } from '../../services/ai';
import type {
  Sequence,
  SequenceStep,
  SequenceVariation,
  FollowUpChannel,
  FollowUpType,
  MessageTone,
  SequenceTriggerType,
} from '../../types';

interface SequenceBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sequenceData: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  sequenceToEdit?: Sequence | null;
}

const DEFAULT_STEP_TEMPLATES: Array<Omit<SequenceStep, 'id'>> = [
  {
    stepNumber: 1,
    delayDays: 0,
    title: 'Initial Proposal Follow-up',
    channel: 'email',
    tone: 'friendly',
    templateSubject: 'Following up on our proposal - {{company}}',
    templateBody: `Hi {{name}},\n\nI hope your week is off to a great start! Just wanted to check in and see if you had any questions regarding the proposal we discussed for {{company}}.\n\nLooking forward to hearing your thoughts.\n\nBest regards,`,
    aiPromptGuidance: 'Friendly first check-in after proposal submission',
  },
  {
    stepNumber: 2,
    delayDays: 3,
    title: 'Value-Add / Quick Check-in',
    channel: 'whatsapp',
    tone: 'casual',
    templateBody: `Hey {{name}}, wanted to share a quick case study that relates closely to what we planned for {{company}}. Let me know if you'd like to jump on a quick 5-min call this week!`,
    aiPromptGuidance: 'Casual short WhatsApp message offering quick value or call',
  },
  {
    stepNumber: 3,
    delayDays: 5,
    title: 'Decision & Timeline Nudge',
    channel: 'email',
    tone: 'firm',
    templateSubject: 'Timeline update regarding {{company}} project',
    templateBody: `Hi {{name}},\n\nI'm currently planning our project calendar for the upcoming month. To ensure we can reserve capacity for {{company}}, could you let me know if we're still on track to proceed?\n\nHappy to address any final questions.\n\nBest,`,
    aiPromptGuidance: 'Firm polite deadline check-in for scheduling capacity',
  },
];

export const SequenceBuilderModal: React.FC<SequenceBuilderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  sequenceToEdit,
}) => {
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Sequence['category']>('proposal');
  const [triggerType, setTriggerType] = useState<SequenceTriggerType>('tag');
  const [triggerValue, setTriggerValue] = useState('Proposal');
  const [targetChannel, setTargetChannel] = useState<FollowUpChannel | 'auto'>('auto');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Active AI generation states per step
  const [aiGeneratingStepIndex, setAiGeneratingStepIndex] = useState<number | null>(null);
  const [variationsGeneratingStepIndex, setVariationsGeneratingStepIndex] = useState<number | null>(null);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (sequenceToEdit) {
        setName(sequenceToEdit.name);
        setDescription(sequenceToEdit.description || '');
        setCategory(sequenceToEdit.category);
        setTriggerType(sequenceToEdit.triggerType);
        setTriggerValue(sequenceToEdit.triggerValue || 'Lead');
        setTargetChannel(sequenceToEdit.targetChannel);
        setIsActive(sequenceToEdit.isActive);
        setSteps(sequenceToEdit.steps || []);
      } else {
        // Defaults for new sequence
        setName('High-Conversion Proposal Sequence');
        setDescription('Automated 3-step cadence to close proposals and quotes faster.');
        setCategory('proposal');
        setTriggerType('tag');
        setTriggerValue('Proposal');
        setTargetChannel('auto');
        setIsActive(true);
        setSteps(
          DEFAULT_STEP_TEMPLATES.map((st, idx) => ({
            ...st,
            id: `step-${Date.now()}-${idx}`,
          }))
        );
      }
      setExpandedStepIndex(0);
    }
  }, [isOpen, sequenceToEdit]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    const newStepNumber = steps.length + 1;
    const newStep: SequenceStep = {
      id: `step-${Date.now()}-${newStepNumber}`,
      stepNumber: newStepNumber,
      delayDays: 3,
      title: `Follow-Up Step ${newStepNumber}`,
      channel: 'email',
      tone: 'friendly',
      templateSubject: 'Quick check-in regarding {{company}}',
      templateBody: `Hi {{name}},\n\nJust following up on my previous message. Let me know if you have any questions!\n\nBest,`,
    };
    setSteps([...steps, newStep]);
    setExpandedStepIndex(steps.length);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      toastError('A sequence must have at least one step.');
      return;
    }
    const filtered = steps.filter((_, idx) => idx !== index);
    const renumbered = filtered.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setSteps(renumbered);
    if (expandedStepIndex >= renumbered.length) {
      setExpandedStepIndex(Math.max(0, renumbered.length - 1));
    }
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;

    // re-number
    const renumbered = newSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setSteps(renumbered);
    setExpandedStepIndex(targetIndex);
  };

  const handleUpdateStep = (index: number, field: keyof SequenceStep, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  // AI: Generate Step Template
  const handleAiGenerateStep = async (index: number) => {
    const step = steps[index];
    setAiGeneratingStepIndex(index);
    try {
      const res = await generateSequenceStepTemplate({
        sequenceName: name || 'Client Follow-Up',
        sequenceCategory: category,
        stepNumber: step.stepNumber,
        totalSteps: steps.length,
        delayDays: step.delayDays,
        stepTitle: step.title,
        tone: step.tone,
        channel: step.channel,
        aiPromptGuidance: step.aiPromptGuidance,
      });

      if (res.success && res.templateBody) {
        handleUpdateStep(index, 'templateBody', res.templateBody);
        if (res.subject && step.channel === 'email') {
          handleUpdateStep(index, 'templateSubject', res.subject);
        }
        success(`AI generated template for Step ${step.stepNumber}!`);
      }
    } catch (err: any) {
      toastError(err.message || 'AI generation failed. Using default template.');
    } finally {
      setAiGeneratingStepIndex(null);
    }
  };

  // AI: Generate 3 variations (Friendly, Firm, Urgent/Casual)
  const handleAiGenerateVariations = async (index: number) => {
    const step = steps[index];
    setVariationsGeneratingStepIndex(index);
    try {
      const res = await generateSequenceVariations({
        sequenceName: name,
        stepTitle: step.title,
        baseMessage: step.templateBody,
        channel: step.channel,
      });

      if (res.success && res.variations?.length) {
        handleUpdateStep(index, 'variations', res.variations);
        success(`Generated 3 AI tone variations for Step ${step.stepNumber}!`);
      }
    } catch (err: any) {
      toastError(err.message || 'Failed to generate variations.');
    } finally {
      setVariationsGeneratingStepIndex(null);
    }
  };

  const handleApplyVariation = (stepIndex: number, variation: SequenceVariation) => {
    const updated = [...steps];
    updated[stepIndex].templateBody = variation.content;
    updated[stepIndex].tone = variation.tone;
    if (variation.subject && updated[stepIndex].channel === 'email') {
      updated[stepIndex].templateSubject = variation.subject;
    }
    setSteps(updated);
    success(`Applied ${variation.label} tone variation!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toastError('Please provide a sequence name.');
      return;
    }
    if (steps.length === 0) {
      toastError('Please add at least one step.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        category,
        triggerType,
        triggerValue: triggerType !== 'manual' ? triggerValue.trim() : undefined,
        targetChannel,
        isActive,
        steps,
        enrolledCount: sequenceToEdit?.enrolledCount || 0,
        completedCount: sequenceToEdit?.completedCount || 0,
      });
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Failed to save sequence.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {sequenceToEdit ? 'Edit Follow-up Sequence' : 'Create Follow-up Sequence'}
              </h2>
              <p className="text-xs text-slate-500">
                Define automated message steps, delays, and smart AI variations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sequence Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 3-Step Proposal Follow-Up"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category / Intent
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-hidden bg-white"
              >
                <option value="proposal">Proposals & Quotes</option>
                <option value="lead">New Leads & Prospects</option>
                <option value="invoice">Unpaid Invoices</option>
                <option value="appointment">Appointments & Consultations</option>
                <option value="customer">Existing Customers</option>
                <option value="nurture">Long-term Nurture</option>
                <option value="recovery">Dormant Account Recovery</option>
                <option value="general">General Follow-Up</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sequence Trigger
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTriggerType('tag')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border text-center transition-all ${
                    triggerType === 'tag'
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Contact Tag
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('lead_stage')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border text-center transition-all ${
                    triggerType === 'lead_stage'
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Lead Stage
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('manual')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold border text-center transition-all ${
                    triggerType === 'manual'
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Manual Only
                </button>
              </div>
            </div>

            {triggerType !== 'manual' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {triggerType === 'tag' ? 'Trigger on Contact Tag' : 'Trigger on Lead Stage'}
                </label>
                <input
                  type="text"
                  value={triggerValue}
                  onChange={(e) => setTriggerValue(e.target.value)}
                  placeholder={triggerType === 'tag' ? 'e.g. Proposal, VIP, Lead' : 'e.g. Qualified, Proposal Sent'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Contacts with this {triggerType === 'tag' ? 'tag' : 'stage'} will be automatically suggested for enrollment.
                </p>
              </div>
            )}
          </div>

          {/* Sequence Steps Builder */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Sequence Timeline ({steps.length} Steps)
                </h3>
                <p className="text-xs text-slate-500">
                  Configure delays, communication channels, and AI-assisted message drafts.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddStep}
                className="py-1.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Step
              </button>
            </div>

            {/* Steps Timeline Accordion */}
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isExpanded = expandedStepIndex === index;
                const isGenerating = aiGeneratingStepIndex === index;
                const isGeneratingVars = variationsGeneratingStepIndex === index;

                return (
                  <div
                    key={step.id || index}
                    className={`rounded-2xl border transition-all ${
                      isExpanded
                        ? 'border-blue-300 bg-white shadow-sm ring-1 ring-blue-100'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    {/* Step Header Row */}
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => setExpandedStepIndex(isExpanded ? -1 : index)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                          {step.stepNumber}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-2">
                            <span>{step.title || `Step ${step.stepNumber}`}</span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">
                              {step.delayDays === 0 ? 'Immediately' : `+${step.delayDays} days delay`}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                              {step.channel}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move step up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStep(index, 'down')}
                          disabled={index === steps.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move step down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(index)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                          title="Delete step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedStepIndex(isExpanded ? -1 : index)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 ml-1"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Step Body (Expanded) */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Step Title
                            </label>
                            <input
                              type="text"
                              value={step.title}
                              onChange={(e) => handleUpdateStep(index, 'title', e.target.value)}
                              placeholder="e.g. Value Add Check-In"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Wait Delay (Days)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={90}
                                value={step.delayDays}
                                onChange={(e) =>
                                  handleUpdateStep(index, 'delayDays', parseInt(e.target.value, 10) || 0)
                                }
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                              />
                              <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                {step.delayDays === 0 ? 'Send Day 1' : 'Days after prev'}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Channel & Tone
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <select
                                value={step.channel}
                                onChange={(e) => handleUpdateStep(index, 'channel', e.target.value as FollowUpChannel)}
                                className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-medium outline-hidden bg-white"
                              >
                                <option value="email">Email</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="sms">SMS</option>
                                <option value="phone">Phone Call</option>
                              </select>
                              <select
                                value={step.tone}
                                onChange={(e) => handleUpdateStep(index, 'tone', e.target.value as MessageTone)}
                                className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-medium outline-hidden bg-white"
                              >
                                <option value="friendly">Friendly</option>
                                <option value="professional">Professional</option>
                                <option value="casual">Casual</option>
                                <option value="firm">Firm</option>
                                <option value="urgent">Urgent</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Subject Line for Email */}
                        {step.channel === 'email' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                              Subject Line
                            </label>
                            <input
                              type="text"
                              value={step.templateSubject || ''}
                              onChange={(e) => handleUpdateStep(index, 'templateSubject', e.target.value)}
                              placeholder="e.g. Quick question regarding {{company}}"
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                            />
                          </div>
                        )}

                        {/* Message Template & AI Actions */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase">
                              Message Template Body
                            </label>
                            <div className="flex items-center gap-2">
                              {/* AI Step Generation Button */}
                              <button
                                type="button"
                                onClick={() => handleAiGenerateStep(index)}
                                disabled={isGenerating}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                <Sparkles className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                                {isGenerating ? 'Generating...' : 'AI Auto-Draft'}
                              </button>

                              <span className="text-slate-300">|</span>

                              {/* AI 3 Variations Button */}
                              <button
                                type="button"
                                onClick={() => handleAiGenerateVariations(index)}
                                disabled={isGeneratingVars}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors disabled:opacity-50"
                              >
                                <Wand2 className={`w-3 h-3 ${isGeneratingVars ? 'animate-spin' : ''}`} />
                                {isGeneratingVars ? 'Generating...' : 'AI 3 Tone Variations'}
                              </button>
                            </div>
                          </div>

                          <textarea
                            rows={4}
                            value={step.templateBody}
                            onChange={(e) => handleUpdateStep(index, 'templateBody', e.target.value)}
                            placeholder="Write message template or click AI Auto-Draft..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden leading-relaxed"
                          />

                          {/* Dynamic Tag Helpers */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold">Available placeholders:</span>
                            {['{{name}}', '{{company}}', '{{amount}}', '{{day}}'].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  handleUpdateStep(index, 'templateBody', step.templateBody + ' ' + tag);
                                }}
                                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-mono transition-colors"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* AI Variations Preview (If Generated) */}
                        {step.variations && step.variations.length > 0 && (
                          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50/70 to-blue-50/70 border border-indigo-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                AI Generated Tone Variations:
                              </span>
                              <span className="text-[10px] text-indigo-600">Click to apply to step</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {step.variations.map((v, vIdx) => (
                                <div
                                  key={v.id || vIdx}
                                  onClick={() => handleApplyVariation(index, v)}
                                  className="p-2.5 rounded-lg bg-white border border-indigo-200/80 hover:border-indigo-500 cursor-pointer transition-all shadow-2xs hover:shadow-xs group"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider">
                                      {v.label}
                                    </span>
                                    <span className="text-[9px] text-slate-400 group-hover:text-indigo-600 font-bold flex items-center gap-0.5">
                                      Use <Check className="w-3 h-3" />
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-700 line-clamp-3 leading-snug">
                                    {v.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-2 text-xs font-bold text-slate-700">
                {isActive ? 'Sequence Active' : 'Sequence Inactive'}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? 'Saving Sequence...' : sequenceToEdit ? 'Save Changes' : 'Create Sequence'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
