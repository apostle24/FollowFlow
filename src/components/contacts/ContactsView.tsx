import React, { useState, useMemo } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
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
} from 'lucide-react';
import { EnrollContactModal } from '../sequences/EnrollContactModal';
import { ContactTimelineModal } from './ContactTimelineModal';
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
  const { contacts, followUps, loading } = useFollowUp();

  const [search, setSearch] = useState<string>(initialSearchQuery);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [enrollModalContact, setEnrollModalContact] = useState<Contact | null>(null);
  const [timelineModalContact, setTimelineModalContact] = useState<Contact | null>(null);

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
    window.open(`mailto:${contact.email}`, '_blank');
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

        <button
          onClick={onOpenNewContact}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm shadow-blue-200 flex items-center gap-2 transition-all shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          New Contact
        </button>
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
      </div>

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
            return (
              <div
                key={contact.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
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
    </div>
  );
};
