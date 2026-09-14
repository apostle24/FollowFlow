import React, { useState, useMemo, useRef } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { useToast } from '../common/Toast';
import {
  Plus,
  Search,
  User,
  Building,
  Mail,
  Phone,
  MessageSquare,
  Tag,
  Edit2,
  Trash2,
  CalendarPlus,
  Users,
  Layers,
  Clock,
  Download,
  Upload,
  Check,
  X,
} from 'lucide-react';
import { EnrollContactModal } from '../sequences/EnrollContactModal';
import { ContactTimelineModal } from './ContactTimelineModal';
import { BulkEmailModal } from '../followups/BulkEmailModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { Contact } from '../../types';

interface ContactsViewProps {
  onOpenNewContact: () => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contact: Contact) => void;
  onAddFollowUpForContact: (contact: Contact) => void;
  initialSearchQuery?: string;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  onOpenNewContact,
  onEditContact,
  onDeleteContact,
  onAddFollowUpForContact,
  initialSearchQuery = '',
}) => {
  const { contacts, followUps, addContact, loading, bulkDeleteContacts, openAiModal } = useFollowUp();
  const { success, error: toastError } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [search, setSearch] = useState<string>(initialSearchQuery);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [enrollModalContact, setEnrollModalContact] = useState<Contact | null>(null);
  const [timelineModalContact, setTimelineModalContact] = useState<Contact | null>(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState<boolean>(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);

  // CSV Export
  const handleExportCSV = () => {
    if (contacts.length === 0) {
      toastError('No contacts to export.');
      return;
    }

    const headers = [
      'Name',
      'Company',
      'Email',
      'Phone',
      'WhatsApp',
      'Project',
      'Service',
      'Amount',
      'Currency',
      'PreferredChannel',
      'Timezone',
      'Tags',
      'Notes',
    ];

    const rows = contacts.map((c) => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.company || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.whatsapp || '').replace(/"/g, '""')}"`,
      `"${(c.project || '').replace(/"/g, '""')}"`,
      `"${(c.service || '').replace(/"/g, '""')}"`,
      c.amount !== undefined ? c.amount : '',
      `"${(c.currency || 'USD').replace(/"/g, '""')}"`,
      `"${(c.preferredChannel || 'email').replace(/"/g, '""')}"`,
      `"${(c.timezone || '').replace(/"/g, '""')}"`,
      `"${(c.tags || []).join(';')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `followflow_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Contacts exported', `Downloaded ${contacts.length} contacts to CSV.`);
  };

  // CSV Import
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('File is empty.');

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) {
          toastError('CSV file has no data rows.');
          setIsImporting(false);
          return;
        }

        // Parse header row
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const nameIdx = headers.findIndex((h) => h.includes('name'));
        const companyIdx = headers.findIndex((h) => h.includes('company') || h.includes('org'));
        const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'));
        const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('tel') || h.includes('mobile'));
        const whatsappIdx = headers.findIndex((h) => h.includes('whatsapp') || h.includes('wa'));
        const projectIdx = headers.findIndex((h) => h.includes('project') || h.includes('deal'));
        const serviceIdx = headers.findIndex((h) => h.includes('service') || h.includes('offering'));
        const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('value'));
        const currencyIdx = headers.findIndex((h) => h.includes('currency'));
        const channelIdx = headers.findIndex((h) => h.includes('channel') || h.includes('preferred'));
        const timezoneIdx = headers.findIndex((h) => h.includes('timezone') || h.includes('tz'));
        const tagsIdx = headers.findIndex((h) => h.includes('tag'));
        const notesIdx = headers.findIndex((h) => h.includes('note') || h.includes('desc'));

        let importedCount = 0;
        for (let i = 1; i < lines.length; i++) {
          // Parse CSV line considering quoted values
          const rawCells = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
          const cells = rawCells.map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

          const name = (nameIdx >= 0 ? cells[nameIdx] : cells[0])?.trim();
          if (!name) continue;

          const company = (companyIdx >= 0 ? cells[companyIdx] : cells[1])?.trim();
          const email = (emailIdx >= 0 ? cells[emailIdx] : cells[2])?.trim();
          const phone = (phoneIdx >= 0 ? cells[phoneIdx] : cells[3])?.trim();
          const whatsapp = (whatsappIdx >= 0 ? cells[whatsappIdx] : phone)?.trim();
          const project = (projectIdx >= 0 ? cells[projectIdx] : undefined)?.trim();
          const service = (serviceIdx >= 0 ? cells[serviceIdx] : undefined)?.trim();
          const rawAmount = amountIdx >= 0 ? cells[amountIdx] : undefined;
          const parsedAmount = rawAmount && !isNaN(parseFloat(rawAmount)) ? parseFloat(rawAmount) : undefined;
          const currency = (currencyIdx >= 0 ? cells[currencyIdx] : 'USD')?.trim() || 'USD';
          const preferredChannel = (channelIdx >= 0 ? cells[channelIdx] : 'email')?.trim() as any;
          const timezone = (timezoneIdx >= 0 ? cells[timezoneIdx] : Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')?.trim();
          const tagsStr = tagsIdx >= 0 ? cells[tagsIdx] : '';
          const tags = tagsStr ? tagsStr.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [];
          const notes = (notesIdx >= 0 ? cells[notesIdx] : '')?.trim();

          await addContact({
            name,
            company: company || undefined,
            email: email || undefined,
            phone: phone || undefined,
            whatsapp: whatsapp || phone || undefined,
            project: project || undefined,
            service: service || undefined,
            amount: parsedAmount,
            currency,
            preferredChannel: ['email', 'whatsapp', 'phone', 'sms', 'manual'].includes(preferredChannel) ? preferredChannel : 'email',
            timezone,
            communicationConsent: true,
            tags,
            notes: notes || undefined,
          });
          importedCount++;
        }

        success('Import complete', `Successfully imported ${importedCount} contacts.`);
      } catch (err: any) {
        toastError(err.message || 'Failed to import CSV.');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    contacts.forEach((c) => (c.tags || []).forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [contacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesTag = selectedTag === 'all' || (c.tags && c.tags.includes(selectedTag));
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.whatsapp?.includes(q) ||
        c.notes?.toLowerCase().includes(q);

      return matchesTag && matchesSearch;
    });
  }, [contacts, selectedTag, search]);

  const getContactFollowUpsCount = (contactId: string) => {
    return followUps.filter(
      (f) => f.contactId === contactId && f.status !== 'completed' && f.status !== 'cancelled'
    ).length;
  };

  const handleWhatsApp = (contact: Contact) => {
    const phone = contact.whatsapp || contact.phone;
    if (!phone) return;
    const sanitized = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hi ${contact.name}, hope you are doing well!`);
    window.open(`https://wa.me/${sanitized}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = (contact: Contact) => {
    if (!contact.email) return;
    openAiModal(undefined, contact, {
      channel: 'email',
      subject: `Following up with ${contact.name}`,
      message: `Hi ${contact.name},\n\nI wanted to reach out and check in with you. Let me know when you have a moment to connect.\n\nBest regards,`,
    });
  };

  // Bulk Selection Helpers
  const handleToggleSelect = (contactId: string) => {
    setSelectedIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const isAllFilteredSelected =
    filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.includes(c.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredContacts.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const currentSet = new Set(selectedIds);
      filteredContacts.forEach((c) => currentSet.add(c.id));
      setSelectedIds(Array.from(currentSet));
    }
  };

  const selectedContactObjects = useMemo(() => {
    const set = new Set(selectedIds);
    return contacts.filter((c) => set.has(c.id));
  }, [selectedIds, contacts]);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    try {
      await bulkDeleteContacts(selectedIds);
      success(
        'Contacts Deleted',
        `Successfully deleted ${selectedIds.length} contact${selectedIds.length > 1 ? 's' : ''}.`
      );
      setSelectedIds([]);
    } catch (err: any) {
      toastError('Failed to delete selected contacts');
    } finally {
      setBulkLoading(false);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Enroll Contact in Sequence Modal */}
      <EnrollContactModal
        isOpen={!!enrollModalContact}
        onClose={() => setEnrollModalContact(null)}
        initialContact={enrollModalContact}
      />

      {/* Contact Timeline History Modal */}
      <ContactTimelineModal
        isOpen={!!timelineModalContact}
        onClose={() => setTimelineModalContact(null)}
        contact={timelineModalContact}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Directory</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Contacts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            People and accounts you maintain follow-up relationships with.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            title="Import contacts from CSV"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            title="Export contacts to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>

          <button
            onClick={onOpenNewContact}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            New Contact
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name, company, email, phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedTag('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                  selectedTag === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Tags
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                    selectedTag === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Master Select All Toggle Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="flex items-center gap-2 font-semibold text-slate-700 hover:text-blue-600 transition-colors"
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                isAllFilteredSelected
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : selectedIds.length > 0
                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {isAllFilteredSelected ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : selectedIds.length > 0 ? (
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-xs" />
              ) : null}
            </div>
            <span>
              {isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredContacts.length})`}
            </span>
          </button>

          <span>Showing {filteredContacts.length} contacts</span>
        </div>
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 bg-slate-900 text-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-xs shadow-xs">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-tight">
                {selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-slate-400 hover:text-white underline font-medium"
                >
                  Clear selection
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBulkEmailModalOpen(true)}
              disabled={bulkLoading}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              title="Send personalized follow-up emails to selected contacts"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Follow-Up Email</span>
            </button>

            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={bulkLoading}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              title="Delete selected contacts"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Dismiss selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs">Loading contacts...</p>
          </div>
        ) : filteredContacts.length > 0 ? (
          filteredContacts.map((contact) => {
            const activeFollowUpCount = getContactFollowUpsCount(contact.id);
            const isSelected = selectedIds.includes(contact.id);
            return (
              <div
                key={contact.id}
                className={`p-5 rounded-2xl bg-white border transition-all flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/25 shadow-md bg-blue-50/15'
                    : 'border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(contact.id);
                        }}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'border-slate-300 bg-white hover:border-slate-400'
                        }`}
                        title={isSelected ? 'Deselect contact' : 'Select contact'}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{contact.name}</h4>
                        {contact.company && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3 text-slate-400" />
                            {contact.company}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditContact(contact)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Edit contact"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteContact(contact)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Methods */}
                  <div className="space-y-1.5 text-xs text-slate-600 my-3">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-slate-600 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {(contact.whatsapp || contact.phone) && (
                      <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{contact.whatsapp || contact.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes snippet */}
                  {contact.notes && (
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 mb-3">
                      {contact.notes}
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {contact.whatsapp || contact.phone ? (
                      <button
                        onClick={() => handleWhatsApp(contact)}
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors"
                        title="Message on WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    ) : null}

                    {contact.email && (
                      <button
                        onClick={() => handleEmail(contact)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                        title="Send Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <span className="text-[11px] text-slate-500 font-medium ml-1">
                      {activeFollowUpCount > 0 ? (
                        <strong className="text-blue-600">{activeFollowUpCount} active</strong>
                      ) : (
                        'No follow-ups'
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTimelineModalContact(contact)}
                      className="py-1.5 px-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="View Relationship Timeline"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      History
                    </button>
                    <button
                      onClick={() => setEnrollModalContact(contact)}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Enroll in Sequence"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Sequence
                    </button>
                    <button
                      onClick={() => onAddFollowUpForContact(contact)}
                      className="py-1.5 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      + Follow-up
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-14 text-center rounded-2xl bg-white border border-slate-200 p-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No contacts found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {contacts.length === 0
                ? 'Add contacts you regularly pitch, invoice, or follow up with.'
                : 'No contacts match the current search filter.'}
            </p>
            {contacts.length === 0 && (
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={onOpenNewContact}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add First Contact
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Email Modal */}
      <BulkEmailModal
        isOpen={bulkEmailModalOpen}
        onClose={() => setBulkEmailModalOpen(false)}
        selectedContacts={selectedContactObjects}
        onDispatched={() => {
          setSelectedIds([]);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Selected Contacts?"
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected contact${
          selectedIds.length > 1 ? 's' : ''
        }? This action cannot be undone.`}
        confirmText={`Delete ${selectedIds.length} Contact${selectedIds.length > 1 ? 's' : ''}`}
        isDestructive={true}
        onConfirm={handleBulkDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};
