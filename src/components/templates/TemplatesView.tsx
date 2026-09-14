import React, { useState, useMemo, useEffect } from 'react';
import {
  FileCode2,
  Plus,
  Search,
  Copy,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  Send,
  Eye,
  Tag,
  Clock,
  Layers,
  CheckCircle2,
  ArrowRight,
  Filter,
  Flame,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  HelpCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import {
  subscribeToTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  incrementTemplateUsage,
  DEFAULT_SALES_TEMPLATES,
} from '../../services/db';
import type { EmailTemplate, TemplateStage, Contact, FollowUpChannel } from '../../types';

const STAGE_LABELS: Record<TemplateStage, { label: string; badgeColor: string }> = {
  lead_qualification: { label: 'Lead Qualification', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  proposal_sent: { label: 'Proposal Sent', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  post_meeting: { label: 'Post-Meeting', badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  negotiation: { label: 'Negotiation', badgeColor: 'bg-violet-50 text-violet-700 border-violet-200' },
  contract_signing: { label: 'Contract Signing', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  invoice_overdue: { label: 'Overdue Invoice', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
  re_engagement: { label: 'Re-engagement (Cold)', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  referral: { label: 'Referrals & Reviews', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  general: { label: 'General Follow-Up', badgeColor: 'bg-slate-50 text-slate-700 border-slate-200' },
};

const AVAILABLE_VARIABLES = [
  { tag: '{{contact_name}}', desc: 'Contact Full Name' },
  { tag: '{{company}}', desc: 'Company or Organization' },
  { tag: '{{project_name}}', desc: 'Project or Deal Scope' },
  { tag: '{{amount}}', desc: 'Deal / Invoice Value' },
  { tag: '{{due_date}}', desc: 'Target / Due Date' },
  { tag: '{{service}}', desc: 'Service Offering' },
  { tag: '{{invoice_number}}', desc: 'Invoice #' },
  { tag: '{{my_name}}', desc: 'Your Name' },
];

export const TemplatesView: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { contacts, openAiModal } = useFollowUp();
  const { success, error: toastError } = useToast();

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Preview & Test Modal
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [selectedTestContactId, setSelectedTestContactId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit / Create Modal
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      // Fallback default templates if not signed in
      setTemplates(
        DEFAULT_SALES_TEMPLATES.map((t, idx) => ({
          ...t,
          id: `default-${idx}`,
          userId: 'guest',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      );
      setLoading(false);
      return;
    }

    const unsub = subscribeToTemplates(
      user.uid,
      (data) => {
        setTemplates(data);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load templates:', err);
        // Fallback to local default sales templates
        setTemplates(
          DEFAULT_SALES_TEMPLATES.map((t, idx) => ({
            ...t,
            id: `default-${idx}`,
            userId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))
        );
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Deep-linking: Support opening specific templates directly from URL parameters or new windows
  useEffect(() => {
    if (templates.length === 0) return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      let targetId = searchParams.get('templateId') || searchParams.get('template');
      if (!targetId && window.location.hash.includes('templateId=')) {
        const hashQuery = window.location.hash.split('?')[1];
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          targetId = hashParams.get('templateId');
        }
      }
      if (targetId) {
        const targetTmpl = templates.find((t) => t.id === targetId);
        if (targetTmpl) {
          setPreviewTemplate(targetTmpl);
        }
      }
    } catch (err) {
      console.warn('[TemplatesView] URL deep linking check notice:', err);
    }
  }, [templates]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [templates]);

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        searchQuery === '' ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStage = selectedStage === 'all' || t.stage === selectedStage;
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;

      return matchesSearch && matchesStage && matchesCategory;
    });
  }, [templates, searchQuery, selectedStage, selectedCategory]);

  const handleCopyScript = (template: EmailTemplate, populatedText?: string) => {
    const textToCopy = populatedText || `${template.subject ? `Subject: ${template.subject}\n\n` : ''}${template.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(template.id);
    setTimeout(() => setCopiedId(null), 2000);
    success('Script copied to clipboard!');
    if (user) {
      incrementTemplateUsage(user.uid, template.id);
    }
  };

  const handleOpenCreateModal = () => {
    setIsNewTemplate(true);
    setEditingTemplate({
      title: '',
      description: '',
      stage: 'lead_qualification',
      category: 'Sales',
      channel: 'email',
      subject: '',
      body: '',
      variables: ['{{contact_name}}', '{{company}}', '{{my_name}}'],
    });
  };

  const handleOpenEditModal = (template: EmailTemplate) => {
    setIsNewTemplate(false);
    setEditingTemplate({ ...template });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate?.title || !editingTemplate?.body) {
      toastError('Please provide a title and script body.');
      return;
    }

    setSaving(true);
    try {
      if (isNewTemplate) {
        if (user) {
          await createTemplate(user.uid, {
            title: editingTemplate.title,
            description: editingTemplate.description || '',
            stage: (editingTemplate.stage as TemplateStage) || 'general',
            category: editingTemplate.category || 'Custom',
            channel: (editingTemplate.channel as FollowUpChannel) || 'email',
            subject: editingTemplate.subject || '',
            body: editingTemplate.body,
            variables: editingTemplate.variables || [],
            isDefault: false,
            timesUsed: 0,
          });
        } else {
          // Local state update
          const newT: EmailTemplate = {
            id: `custom-${Date.now()}`,
            userId: 'guest',
            title: editingTemplate.title,
            description: editingTemplate.description || '',
            stage: (editingTemplate.stage as TemplateStage) || 'general',
            category: editingTemplate.category || 'Custom',
            channel: (editingTemplate.channel as FollowUpChannel) || 'email',
            subject: editingTemplate.subject || '',
            body: editingTemplate.body,
            variables: editingTemplate.variables || [],
            isDefault: false,
            timesUsed: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setTemplates((prev) => [newT, ...prev]);
        }
        success('Template created successfully!');
      } else if (editingTemplate.id) {
        if (user) {
          await updateTemplate(user.uid, editingTemplate.id, {
            title: editingTemplate.title,
            description: editingTemplate.description,
            stage: editingTemplate.stage as TemplateStage,
            category: editingTemplate.category,
            channel: editingTemplate.channel as FollowUpChannel,
            subject: editingTemplate.subject,
            body: editingTemplate.body,
          });
        } else {
          setTemplates((prev) =>
            prev.map((t) => (t.id === editingTemplate.id ? ({ ...t, ...editingTemplate } as EmailTemplate) : t))
          );
        }
        success('Template updated successfully!');
      }
      setEditingTemplate(null);
    } catch (err) {
      console.error('Save template error:', err);
      toastError('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this script template?')) return;
    try {
      if (user) {
        await deleteTemplate(user.uid, templateId);
      }
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      success('Template deleted.');
    } catch (err) {
      toastError('Failed to delete template.');
    }
  };

  const handleUseTemplate = (tmpl: EmailTemplate, targetContact?: Contact) => {
    const contact =
      targetContact ||
      contacts.find((c) => c.id === selectedTestContactId) ||
      (contacts.length > 0 ? contacts[0] : undefined);

    openAiModal(undefined, contact, {
      subject: tmpl.subject,
      message: tmpl.body,
      channel: tmpl.channel || 'email',
      tone: 'professional',
      category: tmpl.category,
    });
    if (user && tmpl.id) {
      incrementTemplateUsage(user.uid, tmpl.id).catch(() => {});
    }
  };

  // Helper to replace variables in preview defensively
  const getRenderedContent = (template: EmailTemplate | null | undefined) => {
    if (!template) {
      return { renderedSubject: '', renderedBody: '', contact: null };
    }
    const contact = contacts.find((c) => c.id === selectedTestContactId);
    let renderedSubject = template.subject || '';
    let renderedBody = template.body || '';

    const myName = userProfile?.displayName || user?.displayName || '{{my_name}}';
    const contactName = contact?.name || '{{contact_name}}';
    const company = contact?.company || '{{company}}';
    const amount = '{{amount}}';
    const dueDate = '{{due_date}}';
    const service = '{{service}}';
    const projectName = '{{project_name}}';
    const invoiceNumber = '{{invoice_number}}';
    const painPoint = '{{pain_point}}';

    const replacements: Record<string, string> = {
      '{{contact_name}}': contactName,
      '{{company}}': company,
      '{{amount}}': amount,
      '{{due_date}}': dueDate,
      '{{my_name}}': myName,
      '{{service}}': service,
      '{{project_name}}': projectName,
      '{{invoice_number}}': invoiceNumber,
      '{{pain_point}}': painPoint,
      '{{name}}': contactName,
    };

    try {
      Object.entries(replacements).forEach(([k, val]) => {
        if (typeof renderedSubject === 'string' && renderedSubject.includes(k)) {
          renderedSubject = renderedSubject.split(k).join(val || '');
        }
        if (typeof renderedBody === 'string' && renderedBody.includes(k)) {
          renderedBody = renderedBody.split(k).join(val || '');
        }
      });
    } catch (err) {
      console.warn('[TemplatesView] Variable substitution notice:', err);
    }

    return { renderedSubject, renderedBody, contact };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCode2 className="w-6 h-6 text-blue-600" />
            Follow-Up Templates Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Proven, stage-categorized sales scripts and automated variable insertion for higher reply rates
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          id="create-template-btn"
          className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          Create Template
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates by title, subject, or keyword..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Stage Dropdown */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="all">All Sales Stages</option>
                <option value="lead_qualification">Lead Qualification</option>
                <option value="proposal_sent">Proposal Sent</option>
                <option value="contract_signing">Contract Signing</option>
                <option value="invoice_overdue">Overdue Invoices</option>
                <option value="re_engagement">Re-engagement</option>
                <option value="referral">Referrals & Testimonials</option>
                <option value="general">General Follow-Up</option>
              </select>
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stage Filter Chips */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
          <button
            onClick={() => setSelectedStage('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              selectedStage === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Stages ({templates.length})
          </button>
          {Object.entries(STAGE_LABELS).map(([stageKey, meta]) => {
            const count = templates.filter((t) => t.stage === stageKey).length;
            if (count === 0 && selectedStage !== stageKey) return null;
            return (
              <button
                key={stageKey}
                onClick={() => setSelectedStage(stageKey)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  selectedStage === stageKey
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {meta.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Templates */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-medium">Loading sales templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-slate-200 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">No templates found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Try adjusting your search query or create a new custom sales script for your stage.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs hover:bg-blue-700"
          >
            Create New Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tmpl) => {
            const stageMeta = (tmpl?.stage && STAGE_LABELS[tmpl.stage]) || STAGE_LABELS?.general || {
              label: 'General Follow-Up',
              badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
            };
            return (
              <div
                key={tmpl.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Metadata Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${stageMeta.badgeColor}`}
                    >
                      {stageMeta.label}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>{tmpl.timesUsed} used</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                    {tmpl.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                    {tmpl.description || 'Pre-crafted sales script for high conversion.'}
                  </p>

                  {/* Subject preview */}
                  {tmpl.subject && (
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 mb-3 truncate">
                      <span className="font-bold text-slate-400 mr-1.5">Subject:</span>
                      {tmpl.subject}
                    </div>
                  )}

                  {/* Body Snippet */}
                  <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs text-slate-600 font-mono line-clamp-4 leading-relaxed whitespace-pre-line mb-3">
                    {tmpl.body}
                  </div>

                  {/* Variable Pills */}
                  {tmpl.variables && tmpl.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tmpl.variables.slice(0, 3).map((v) => (
                        <span
                          key={v}
                          className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-mono font-medium"
                        >
                          {v}
                        </span>
                      ))}
                      {tmpl.variables.length > 3 && (
                        <span className="text-[10px] text-slate-400 font-bold self-center">
                          +{tmpl.variables.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewTemplate(tmpl)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title="Preview with real contact data"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}${window.location.pathname}#templates?templateId=${tmpl.id}`;
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(url);
                          success('Direct link copied to clipboard!');
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="Copy direct link for this template"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    {!tmpl.isDefault && (
                      <>
                        <button
                          onClick={() => handleOpenEditModal(tmpl)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Edit template"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyScript(tmpl)}
                      className="p-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors"
                      title="Copy script"
                    >
                      {copiedId === tmpl.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleUseTemplate(tmpl)}
                      className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Use Template</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Preview & Variable Substitution Simulator */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setPreviewTemplate(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{previewTemplate.title}</h3>
                <p className="text-xs text-slate-500">Live Preview & Variable Simulator</p>
              </div>
            </div>

            {/* Test Contact Selector */}
            <div className="mb-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700">Preview with Contact:</label>
              <select
                value={selectedTestContactId}
                onChange={(e) => setSelectedTestContactId(e.target.value)}
                className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none"
              >
                {contacts.length === 0 ? (
                  <option value="">No contacts selected (showing placeholder tags)</option>
                ) : (
                  contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Live Populated Script Output */}
            {(() => {
              const { renderedSubject, renderedBody } = getRenderedContent(previewTemplate);
              return (
                <div className="space-y-3">
                  {renderedSubject && (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                      <span className="font-bold text-slate-500 mr-2">Subject:</span>
                      <span className="font-semibold text-slate-900">{renderedSubject}</span>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs text-slate-800 whitespace-pre-line font-sans leading-relaxed">
                    {renderedBody}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setPreviewTemplate(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        handleCopyScript(previewTemplate, `${renderedSubject ? `Subject: ${renderedSubject}\n\n` : ''}${renderedBody}`);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy Script
                    </button>
                    <button
                      onClick={() => {
                        const tmpl = previewTemplate;
                        setPreviewTemplate(null);
                        handleUseTemplate(tmpl);
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <Send className="w-4 h-4" />
                      Use in Composer
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Template */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setEditingTemplate(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-slate-900 mb-1">
              {isNewTemplate ? 'Create Custom Sales Script' : 'Edit Script Template'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Customize wording and use dynamic variables to auto-fill contact & deal data.
            </p>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Template Title
                </label>
                <input
                  type="text"
                  required
                  value={editingTemplate.title || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  placeholder="e.g., Post-Demo Next Steps & Pricing"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sales Stage
                  </label>
                  <select
                    value={editingTemplate.stage || 'general'}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, stage: e.target.value as TemplateStage })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lead_qualification">Lead Qualification</option>
                    <option value="proposal_sent">Proposal Sent</option>
                    <option value="contract_signing">Contract Signing</option>
                    <option value="invoice_overdue">Invoice Overdue</option>
                    <option value="re_engagement">Re-engagement</option>
                    <option value="referral">Referral & Review</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category Tag
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.category || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                    placeholder="e.g., Closing, Leads, Invoices"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={editingTemplate.subject || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="e.g., Quick follow-up regarding {{project_name}} for {{company}}"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Script Body
                  </label>
                  <span className="text-[10px] text-slate-400">Click a variable below to insert</span>
                </div>
                <textarea
                  required
                  rows={7}
                  value={editingTemplate.body || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  placeholder="Hi {{contact_name}},&#10;&#10;Following up on our discussion regarding {{project_name}}..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                />

                {/* Variable inserter pills */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => {
                        setEditingTemplate((prev) => ({
                          ...prev,
                          body: (prev?.body || '') + ' ' + v.tag,
                        }));
                      }}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-[11px] font-mono transition-colors"
                      title={v.desc}
                    >
                      + {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Internal Description (Optional)
                </label>
                <input
                  type="text"
                  value={editingTemplate.description || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder="When and how your team should use this script."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : isNewTemplate ? 'Create Template' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
