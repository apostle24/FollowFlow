import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  User,
  Building2,
  Mail,
  Phone,
  MessageSquare,
  Check,
  X,
  ChevronDown,
  AlertCircle,
  Tag,
  Save,
  Clock,
} from 'lucide-react';
import type { Contact } from '../../types';

export interface TemporaryContact extends Contact {
  isTemporary?: boolean;
  project?: string;
  service?: string;
  amount?: number;
  currency?: string;
}

export interface ExtraContactDetails {
  project?: string;
  service?: string;
  amount?: number;
  currency?: string;
}

interface ContactSelectorProps {
  contacts: Contact[];
  selectedContact: Contact | TemporaryContact | null;
  onSelectContact: (contact: Contact | TemporaryContact) => void;
  onSaveNewContact: (
    contactData: Omit<Contact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    extraDetails?: ExtraContactDetails
  ) => Promise<void>;
  onUseTemporaryContact: (
    tempContact: TemporaryContact,
    extraDetails?: ExtraContactDetails
  ) => void;
  onSaveTemporaryAsPermanent?: (contact: TemporaryContact) => Promise<void>;
}

export const ContactSelector: React.FC<ContactSelectorProps> = ({
  contacts,
  selectedContact,
  onSelectContact,
  onSaveNewContact,
  onUseTemporaryContact,
  onSaveTemporaryAsPermanent,
}) => {
  const [isSearching, setIsSearching] = useState<boolean>(!selectedContact);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formCompany, setFormCompany] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formProject, setFormProject] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formCurrency, setFormCurrency] = useState<string>('$');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when switching to search mode
  useEffect(() => {
    if (isSearching && !showAddForm && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearching, showAddForm]);

  // Sync state if selectedContact becomes null
  useEffect(() => {
    if (!selectedContact && !showAddForm) {
      setIsSearching(true);
    }
  }, [selectedContact, showAddForm]);

  // Fast filtered contacts
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;

    return contacts.filter((c) => {
      const matchName = c.name?.toLowerCase().includes(q);
      const matchCompany = c.company?.toLowerCase().includes(q);
      const matchEmail = c.email?.toLowerCase().includes(q);
      const matchPhone =
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.whatsapp && c.whatsapp.toLowerCase().includes(q));
      const matchTags = c.tags?.some((t) => t.toLowerCase().includes(q));

      return matchName || matchCompany || matchEmail || matchPhone || matchTags;
    });
  }, [contacts, searchQuery]);

  const resetForm = () => {
    setFormName('');
    setFormCompany('');
    setFormEmail('');
    setFormPhone('');
    setFormProject('');
    setFormAmount('');
    setFormCurrency('$');
    setFormNotes('');
    setFormError('');
    setShowAddForm(false);
  };

  const handleOpenAddForm = (initialName?: string) => {
    resetForm();
    if (initialName) {
      setFormName(initialName);
    }
    setShowAddForm(true);
    setIsSearching(false);
  };

  const handleSaveContact = async () => {
    if (!formName.trim()) {
      setFormError('Customer Name is required');
      return;
    }

    setFormError('');
    setIsSaving(true);
    try {
      const extraDetails: ExtraContactDetails = {
        project: formProject.trim() || undefined,
        service: formProject.trim() || undefined,
        amount: formAmount ? parseFloat(formAmount) : undefined,
        currency: formCurrency || '$',
      };

      await onSaveNewContact(
        {
          name: formName.trim(),
          company: formCompany.trim() || undefined,
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          whatsapp: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
          tags: ['Client'],
        },
        extraDetails
      );

      resetForm();
      setIsSearching(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseWithoutSaving = () => {
    if (!formName.trim()) {
      setFormError('Customer Name is required');
      return;
    }

    setFormError('');
    const extraDetails: ExtraContactDetails = {
      project: formProject.trim() || undefined,
      service: formProject.trim() || undefined,
      amount: formAmount ? parseFloat(formAmount) : undefined,
      currency: formCurrency || '$',
    };

    const tempContact: TemporaryContact = {
      id: `temp-${Date.now()}`,
      userId: 'temporary',
      name: formName.trim(),
      company: formCompany.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      whatsapp: formPhone.trim() || undefined,
      notes: formNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTemporary: true,
      project: formProject.trim() || undefined,
      service: formProject.trim() || undefined,
      amount: formAmount ? parseFloat(formAmount) : undefined,
      currency: formCurrency || '$',
    };

    onUseTemporaryContact(tempContact, extraDetails);
    resetForm();
    setIsSearching(false);
  };

  const isTemp = (selectedContact as TemporaryContact)?.isTemporary;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Target Contact *
        </label>
        {isTemp && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            Temporary Contact
          </span>
        )}
      </div>

      {/* 1. SELECTED CONTACT CARD (when not searching and not adding) */}
      {!isSearching && !showAddForm && selectedContact && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                isTemp
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}
            >
              {selectedContact.name ? selectedContact.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {selectedContact.name}
                </p>
                {isTemp && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                    In-Memory
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium truncate">
                {selectedContact.company && (
                  <span className="text-slate-700 font-semibold truncate flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {selectedContact.company}
                  </span>
                )}
                {selectedContact.email && (
                  <span className="text-slate-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {selectedContact.email}
                  </span>
                )}
                {(selectedContact.whatsapp || selectedContact.phone) && (
                  <span className="text-slate-500 truncate flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {selectedContact.whatsapp || selectedContact.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isTemp && onSaveTemporaryAsPermanent && (
              <button
                type="button"
                onClick={() => onSaveTemporaryAsPermanent(selectedContact as TemporaryContact)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Save this temporary contact to permanent CRM"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Contact</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSearching(true);
                setSearchQuery('');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* 2. SEARCH SELECTOR DROPDOWN VIEW */}
      {isSearching && !showAddForm && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-2.5 space-y-2 animate-in fade-in duration-150">
          {/* Search Input Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, company, email..."
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5 divide-y divide-slate-100">
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => {
                const isCurrent = selectedContact?.id === contact.id;
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      onSelectContact(contact);
                      setIsSearching(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-blue-50/80 text-blue-950 font-semibold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {contact.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {contact.company ? `${contact.company} · ` : ''}
                          {contact.email || contact.whatsapp || contact.phone || 'No direct info'}
                        </p>
                      </div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-slate-500">
                <p>No contacts found matching &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>

          {/* Bottom Action: Add New Contact */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddForm(searchQuery)}
              className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-blue-200/60"
            >
              <Plus className="w-3.5 h-3.5" />
              + ADD NEW CONTACT
            </button>
            {selectedContact && (
              <button
                type="button"
                onClick={() => setIsSearching(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. ADD NEW CONTACT INLINE FORM */}
      {showAddForm && (
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3.5 animate-in fade-in zoom-in-98 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Add New Contact
                </h4>
                <p className="text-[11px] text-slate-500">
                  Save to your CRM or use temporarily for this follow-up
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Customer Name * */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* Company / Brand */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Company / Brand
              </label>
              <input
                type="text"
                value={formCompany}
                onChange={(e) => setFormCompany(e.target.value)}
                placeholder="e.g. Apex Design Studio"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="sarah@example.com"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* WhatsApp / Phone */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                WhatsApp / Phone
              </label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+1 555 019 2834"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* Project / Service */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Project / Service
              </label>
              <input
                type="text"
                value={formProject}
                onChange={(e) => setFormProject(e.target.value)}
                placeholder="e.g. Website redesign"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
              />
            </div>

            {/* Amount & Currency */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount & Currency
              </label>
              <div className="flex gap-1.5">
                <select
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-16 px-2 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="₦">₦ (NGN)</option>
                  <option value="CAD$">CAD$</option>
                  <option value="A$">A$</option>
                  <option value="R">R (ZAR)</option>
                  <option value="KSh">KSh</option>
                </select>
                <input
                  type="number"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
                />
              </div>
            </div>

            {/* Notes (full width) */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Context or instructions for this contact..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-xs"
              />
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 border-t border-blue-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseWithoutSaving}
                className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Use temporary contact in memory without saving to CRM"
              >
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Use Without Saving
              </button>

              <button
                type="button"
                onClick={handleSaveContact}
                disabled={isSaving}
                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
