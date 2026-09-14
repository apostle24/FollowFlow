import React, { useEffect, useState } from 'react';
import {
  Clock,
  Plus,
  Send,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  User,
  MessageSquare,
  DollarSign,
  Mail,
  Phone,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToContactTimeline, logTimelineEvent } from '../../services/db';
import type { ContactTimelineEvent, Contact } from '../../types';

interface ContactTimelineProps {
  contact: Contact;
}

export const ContactTimeline: React.FC<ContactTimelineProps> = ({ contact }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<ContactTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (!user || !contact.id) return;
    setLoading(true);

    const unsubscribe = subscribeToContactTimeline(
      user.uid,
      contact.id,
      (data) => {
        setEvents(data);
        setLoading(false);
      },
      (err) => {
        console.warn('Timeline error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, contact.id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !noteText.trim() || submittingNote) return;

    setSubmittingNote(true);
    try {
      await logTimelineEvent(user.uid, {
        contactId: contact.id,
        type: 'note_added',
        title: 'Note added',
        description: noteText.trim(),
      });
      setNoteText('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const getEventIcon = (type: ContactTimelineEvent['type']) => {
    switch (type) {
      case 'email_delivered':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'email_sent':
        return <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'email_scheduled':
        return <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'email_failed':
      case 'email_bounced':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
      case 'whatsapp_opened':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'call_initiated':
        return <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'manual_copied':
        return <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />;
      case 'created':
        return <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'outreach_sent':
        return <Send className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'ai_generated':
        return <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'completed':
      case 'followup_completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'snoozed':
        return <Calendar className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />;
      case 'sequence_step':
        return <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'note_added':
      default:
        return <FileText className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />;
    }
  };

  const getEventBadge = (ev: ContactTimelineEvent) => {
    if (ev.type === 'email_delivered') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Delivered ✓</span>;
    }
    if (ev.type === 'email_sent') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Sent Email</span>;
    }
    if (ev.type === 'email_scheduled') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Scheduled</span>;
    }
    if (ev.type === 'email_failed' || ev.type === 'email_bounced') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Failed</span>;
    }
    if (ev.type === 'whatsapp_opened') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">WhatsApp</span>;
    }
    if (ev.type === 'call_initiated') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Phone Call</span>;
    }
    if (ev.type === 'manual_copied') {
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Copied</span>;
    }
    return null;
  };

  const formatEventDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Relationship & Outreach Timeline
        </h4>
        <span className="text-[11px] text-stone-400">
          {events.length} {events.length === 1 ? 'event' : 'events'} recorded
        </span>
      </div>

      {/* Quick Add Note Form */}
      <form onSubmit={handleAddNote} className="flex gap-2">
        <input
          type="text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Log a quick meeting note, phone call, or email update..."
          className="flex-1 text-xs px-3 py-2 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={!noteText.trim() || submittingNote}
          className="px-3 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Log
        </button>
      </form>

      {/* Timeline Stream */}
      {loading ? (
        <div className="py-6 text-center text-xs text-stone-400">Loading relationship history...</div>
      ) : events.length === 0 ? (
        <div className="py-6 text-center text-xs text-stone-400 bg-stone-50/50 dark:bg-stone-800/30 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
          No outreach activity recorded for this contact yet.
        </div>
      ) : (
        <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 dark:before:bg-stone-800">
          {events.map((ev) => (
            <div key={ev.id} className="relative group">
              {/* Node dot */}
              <div className="absolute -left-5 top-1 w-4 h-4 rounded-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 flex items-center justify-center shadow-xs">
                {getEventIcon(ev.type)}
              </div>

              <div className="bg-stone-50/70 dark:bg-stone-800/40 hover:bg-stone-50 dark:hover:bg-stone-800/70 rounded-xl p-3 border border-stone-200/60 dark:border-stone-800 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                      {ev.title}
                    </span>
                    {getEventBadge(ev)}
                  </div>
                  <span className="text-[10px] text-stone-400 whitespace-nowrap">
                    {formatEventDate(ev.timestamp)}
                  </span>
                </div>

                {ev.description && (
                  <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 whitespace-pre-wrap">
                    {ev.description}
                  </p>
                )}

                {ev.providerMessageId && (
                  <div className="mt-1.5 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <span>Provider ID: {ev.providerMessageId}</span>
                  </div>
                )}

                {ev.amount && (
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    <DollarSign className="w-3 h-3" />
                    <span>{ev.currency || '$'}{ev.amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
