import React, { useState } from 'react';
import { useFollowUp } from '../../context/FollowUpContext';
import { parseAppointmentTimestamp } from '../../services/db';
import {
  DollarSign,
  Calendar,
  UserPlus,
  ArrowUpRight,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Mail,
  Plus,
  Sparkles,
  Building,
} from 'lucide-react';
import type { Lead, Appointment, FollowUp } from '../../types';

interface ExecutiveStatsBarProps {
  onOpenNewLead: () => void;
  onOpenNewAppointment: (initialLead?: Partial<Lead>) => void;
  onFilterInvoices?: () => void;
  className?: string;
}

export const ExecutiveStatsBar: React.FC<ExecutiveStatsBarProps> = ({
  onOpenNewLead,
  onOpenNewAppointment,
  onFilterInvoices,
  className = '',
}) => {
  const {
    followUps,
    leads,
    appointments,
    openAiModal,
    contacts,
  } = useFollowUp();

  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // 1. Calculate Total Pending Invoices & Total Amount
  const pendingInvoices = followUps.filter(
    (f) => f.type === 'invoice' && f.status === 'pending'
  );
  const pendingInvoicesCount = pendingInvoices.length;
  const pendingInvoicesTotal = pendingInvoices.reduce(
    (acc, item) => acc + (item.amount && !isNaN(item.amount) ? Number(item.amount) : 0),
    0
  );
  const overdueInvoicesCount = pendingInvoices.filter((inv) => {
    if (!inv.dueDate) return false;
    const due = new Date(inv.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }).length;

  // 2. Calculate Upcoming Appointments
  // From dedicated appointments collection + any appointment follow-ups
  const now = new Date();
  const upcomingApptsList: {
    id: string;
    title: string;
    contactName: string;
    company?: string;
    scheduledAt: string;
    timeDisplay: string;
    fullDisplay: string;
    channel?: string;
  }[] = [];

  // Add from appointments
  appointments.forEach((appt) => {
    const parsed = parseAppointmentTimestamp(appt.scheduledAt);
    if (parsed.isUpcoming || parsed.isToday) {
      upcomingApptsList.push({
        id: appt.id,
        title: appt.title,
        contactName: appt.contactName,
        company: appt.contactCompany,
        scheduledAt: appt.scheduledAt,
        timeDisplay: parsed.timeDisplay,
        fullDisplay: parsed.fullDisplay,
        channel: appt.channel,
      });
    }
  });

  // Also include any active appointment followUps that aren't duplicate
  followUps.forEach((f) => {
    if (f.type === 'appointment' && f.status !== 'completed' && f.status !== 'cancelled') {
      const ts = f.appointmentTimestamp || `${f.dueDate}T10:00:00.000Z`;
      const parsed = parseAppointmentTimestamp(ts);
      if (parsed.isUpcoming || parsed.isToday) {
        if (!upcomingApptsList.some((a) => a.title === f.title && a.contactName === f.contactName)) {
          upcomingApptsList.push({
            id: f.id,
            title: f.title,
            contactName: f.contactName,
            company: f.contactCompany,
            scheduledAt: ts,
            timeDisplay: parsed.timeDisplay,
            fullDisplay: parsed.fullDisplay,
            channel: f.channel,
          });
        }
      }
    }
  });

  // Sort upcoming chronologically
  upcomingApptsList.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const upcomingAppointmentsCount = upcomingApptsList.length;
  const nextAppointment = upcomingApptsList[0];

  // 3. List of Recent Leads (Direct Firestore records)
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs mb-6 overflow-hidden transition-all ${className}`}
    >
      {/* Top Bar / Header with high-level KPI cards */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-linear-to-r from-slate-50/70 via-white to-slate-50/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Section Title & Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                HQ
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  Executive Operations Overview
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    Live Firestore
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Real-time pending invoices, scheduled appointments, and incoming lead pipeline.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* 1. Pending Invoices Card */}
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                  Pending Invoices
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-bold text-slate-900">
                    ${pendingInvoicesTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-amber-700">
                    ({pendingInvoicesCount} unpaid)
                  </span>
                </div>
                {overdueInvoicesCount > 0 && (
                  <span className="text-[10px] font-medium text-rose-600 flex items-center gap-1 mt-0.5">
                    <AlertCircle className="w-3 h-3" />
                    {overdueInvoicesCount} overdue invoice{overdueInvoicesCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {onFilterInvoices && (
                <button
                  type="button"
                  onClick={onFilterInvoices}
                  title="View Invoices"
                  className="p-2 rounded-lg bg-white/80 hover:bg-white text-amber-800 shadow-xs border border-amber-200 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <span>Invoices</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* 2. Upcoming Appointments Card */}
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/70 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  Upcoming Appointments
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-bold text-slate-900">
                    {upcomingAppointmentsCount}
                  </span>
                  <span className="text-xs font-medium text-blue-700">
                    {upcomingAppointmentsCount === 1 ? 'session scheduled' : 'sessions scheduled'}
                  </span>
                </div>
                {nextAppointment ? (
                  <span className="text-[10px] text-blue-800 font-medium truncate block max-w-[170px] mt-0.5">
                    Next: {nextAppointment.contactName} ({nextAppointment.timeDisplay})
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    No bookings today
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenNewAppointment()}
                title="Schedule Appointment"
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs font-semibold transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Book</span>
              </button>
            </div>

            {/* 3. New Leads Pipeline Card */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex items-center justify-between sm:col-span-2 md:col-span-1">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Active Leads Pipeline
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-bold text-slate-900">
                    {leads.length}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    ${leads.reduce((acc, l) => acc + (l.expectedDealValue || 0), 0).toLocaleString()} value
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  Saved directly to Firestore
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenNewLead}
                title="Add New Lead"
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-semibold transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>New Lead</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Section: Recent Leads and Upcoming Appointments List */}
      {isExpanded && (
        <div className="p-4 sm:p-5 bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* List of Recent Leads (8 columns) */}
            <div className="lg:col-span-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Recent Client Leads
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({leads.length} total)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenNewLead}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lead</span>
                </button>
              </div>

              {recentLeads.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">
                    No client leads saved yet.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenNewLead}
                    className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline"
                  >
                    Enter your first lead now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentLeads.map((lead) => {
                    const leadContact = contacts.find((c) => c.name.toLowerCase() === lead.name.toLowerCase());
                    return (
                      <div
                        key={lead.id}
                        className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-colors flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                {lead.name}
                              </h4>
                              {lead.company && (
                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Building className="w-3 h-3 text-slate-400" />
                                  <span>{lead.company}</span>
                                </p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                              {lead.currency}
                              {lead.expectedDealValue.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 capitalize">
                              Source: {lead.leadSource.replace('_', ' ')}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 capitalize">
                              {lead.status.replace('_', ' ')}
                            </span>
                          </div>

                          {lead.notes && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1.5 italic">
                              "{lead.notes}"
                            </p>
                          )}
                        </div>

                        {/* Quick action bar */}
                        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => onOpenNewAppointment(lead)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>Schedule Call</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {lead.whatsapp && (
                              <a
                                href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50"
                                title="Open WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {lead.email && (
                              <a
                                href={`mailto:${lead.email}`}
                                className="p-1 rounded-md text-blue-600 hover:bg-blue-50"
                                title="Send Email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (leadContact) {
                                  openAiModal(undefined, leadContact);
                                }
                              }}
                              className="p-1 rounded-md text-purple-600 hover:bg-purple-50"
                              title="Draft AI Pitch"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Appointments Preview (4 columns) */}
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Upcoming Appointments
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenNewAppointment()}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book</span>
                </button>
              </div>

              {upcomingApptsList.length === 0 ? (
                <div className="p-5 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                  <Clock className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-500 font-medium">
                    No upcoming appointments.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenNewAppointment()}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                  >
                    Schedule a client session
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingApptsList.slice(0, 3).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-2.5 rounded-xl bg-blue-50/40 border border-blue-100 flex items-start justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {appt.title}
                        </h4>
                        <p className="text-[11px] text-slate-600 truncate mt-0.5">
                          With: <strong className="font-semibold">{appt.contactName}</strong>
                          {appt.company ? ` (${appt.company})` : ''}
                        </p>
                        <span className="text-[10px] text-blue-700 font-medium block mt-1">
                          🗓️ {appt.fullDisplay}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold bg-blue-100 text-blue-800 shrink-0">
                        {appt.channel || 'call'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
