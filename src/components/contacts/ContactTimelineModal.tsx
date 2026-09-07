import React from 'react';
import { X, Building, Mail, Phone, MessageSquare, Clock } from 'lucide-react';
import { ContactTimeline } from './ContactTimeline';
import type { Contact } from '../../types';

interface ContactTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
}

export const ContactTimelineModal: React.FC<ContactTimelineModalProps> = ({
  isOpen,
  onClose,
  contact,
}) => {
  if (!isOpen || !contact) return null;

  return (
    <div
      id="contact-timeline-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-xl w-full p-6 text-stone-900 dark:text-stone-100 relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{contact.name}</h3>
              {contact.tags?.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] font-medium"
                >
                  #{t}
                </span>
              ))}
            </div>
            {contact.company && (
              <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5">
                <Building className="w-3.5 h-3.5" />
                {contact.company}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto py-4">
          <ContactTimeline contact={contact} />
        </div>
      </div>
    </div>
  );
};
