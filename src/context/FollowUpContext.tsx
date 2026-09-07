import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeToContacts,
  subscribeToFollowUps,
  createContact,
  updateContact,
  deleteContact,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  snoozeFollowUp,
  deleteFollowUp,
  subscribeLeads,
  createLead,
  updateLead,
  deleteLead,
  subscribeAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  formatAppointmentTimestamp,
  parseAppointmentTimestamp,
  seedDemoData,
  clearAllUserData,
  getTodayString,
  getDaysDiffFromToday,
  getSequences,
  saveSequence,
  deleteSequence as deleteSequenceFromDb,
  getSequenceEnrollments,
  createSequenceEnrollment,
  advanceSequenceEnrollment,
  updateSequenceEnrollmentStatus,
  deleteSequenceEnrollment,
  logTimelineEvent,
} from '../services/db';
import { trackEvent } from '../services/analytics';
import {
  PLAN_LIMITS,
  type Contact,
  type FollowUp,
  type Sequence,
  type SequenceEnrollment,
  type SequenceEnrollmentStepHistory,
  type SequenceEnrollmentStatus,
  type FollowUpChannel,
  type Lead,
  type Appointment,
  type LeadSource,
  type LeadStatus,
} from '../types';

interface FollowUpContextType {
  contacts: Contact[];
  followUps: FollowUp[];
  leads: Lead[];
  appointments: Appointment[];
  sequences: Sequence[];
  sequenceEnrollments: SequenceEnrollment[];
  activeEnrollments: SequenceEnrollment[];
  dueSequenceEnrollments: SequenceEnrollment[];
  loading: boolean;
  error: string | null;

  // Dashboard Analytics & Categorization
  stats: {
    todayCount: number;
    overdueCount: number;
    activeLeadsCount: number;
    moneyAtRisk: number; // Active proposals & opportunities
    outstandingInvoices: number; // Overdue & unpaid invoices
    totalFollowUpValue: number; // Combined total follow-up value
    moneyWaiting: number; // Combined total for backwards compatibility
    dueSequencesCount: number;
    pendingInvoicesCount: number;
    pendingInvoicesTotal: number;
    upcomingAppointmentsCount: number;
  };
  todayFollowUps: FollowUp[];
  overdueFollowUps: FollowUp[];
  highValueFollowUps: FollowUp[];
  upcomingFollowUps: FollowUp[];
  completedFollowUps: FollowUp[];
  activeFollowUps: FollowUp[];

  // Action Methods
  addContact: (data: Omit<Contact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editContact: (contactId: string, data: Partial<Contact>) => Promise<void>;
  removeContact: (contactId: string) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  addFollowUp: (data: Omit<FollowUp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editFollowUp: (followUpId: string, data: Partial<FollowUp>) => Promise<void>;
  markCompleted: (followUpId: string) => Promise<void>;
  snooze: (followUpId: string, snoozeOption: number | string) => Promise<string>;
  removeFollowUp: (followUpId: string) => Promise<void>;
  deleteFollowUp: (followUpId: string) => Promise<void>;

  // Leads & Appointments Methods
  addLead: (
    data: Omit<Lead, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<{ leadId: string; contactId?: string; appointmentId?: string }>;
  editLead: (leadId: string, data: Partial<Lead>) => Promise<void>;
  removeLead: (leadId: string) => Promise<void>;
  addAppointment: (
    data: Omit<Appointment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  editAppointment: (appointmentId: string, data: Partial<Appointment>) => Promise<void>;
  removeAppointment: (appointmentId: string) => Promise<void>;

  // Sequence Operations
  refreshSequences: () => Promise<void>;
  addSequence: (data: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  editSequence: (
    sequenceId: string,
    data: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  removeSequence: (sequenceId: string) => Promise<void>;
  enrollContact: (
    data: Omit<SequenceEnrollment, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'history'>
  ) => Promise<string>;
  executeStep: (
    enrollmentId: string,
    history: SequenceEnrollmentStepHistory,
    nextDelayDays?: number,
    nextChannel?: FollowUpChannel,
    nextTitle?: string
  ) => Promise<void>;
  changeEnrollmentStatus: (enrollmentId: string, status: SequenceEnrollmentStatus) => Promise<void>;
  removeEnrollment: (enrollmentId: string) => Promise<void>;

  // Demo & Reset
  loadDemoData: () => Promise<void>;
  clearData: () => Promise<void>;

  // Modals & UI States
  upgradeModalOpen: boolean;
  upgradeReason: string;
  openUpgradeModal: (reason?: string) => void;
  closeUpgradeModal: () => void;
  aiModalOpen: boolean;
  aiTargetFollowUp: FollowUp | null;
  aiTargetContact: Contact | null;
  openAiModal: (followUp?: FollowUp, contact?: Contact) => void;
  closeAiModal: () => void;

  // Sequence Execution Modal State
  executeModalOpen: boolean;
  activeEnrollmentToExecute: SequenceEnrollment | null;
  activeSequenceForExecution: Sequence | null;
  openExecuteModal: (enrollment: SequenceEnrollment) => void;
  closeExecuteModal: () => void;

  // Lead & Appointment Modals State
  leadModalOpen: boolean;
  initialLeadForModal: Partial<Lead> | null;
  openLeadModal: (initialLead?: Partial<Lead>) => void;
  closeLeadModal: () => void;
  appointmentModalOpen: boolean;
  initialAppointmentForModal: Partial<Appointment> | null;
  initialContactForAppointment: Contact | null;
  openAppointmentModal: (
    initialAppointment?: Partial<Appointment>,
    contact?: Contact
  ) => void;
  closeAppointmentModal: () => void;

  // Flow AI Chatbot State
  flowChatOpen: boolean;
  openFlowChat: () => void;
  closeFlowChat: () => void;
  toggleFlowChat: () => void;

  // Daily Follow-Up Rapid Session Mode
  followUpSessionOpen: boolean;
  startFollowUpSession: () => void;
  closeFollowUpSession: () => void;
  sessionIndex: number;
  sessionQueue: FollowUp[];
  completeSessionItem: (followUpId: string) => Promise<void>;
  snoozeSessionItem: (followUpId: string, days: number | string) => Promise<void>;
  nextSessionItem: () => void;
  prevSessionItem: () => void;
}

const FollowUpContext = createContext<FollowUpContextType | undefined>(undefined);

export const FollowUpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, isPro } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [sequenceEnrollments, setSequenceEnrollments] = useState<SequenceEnrollment[]>([]);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(true);
  const [loadingFollowUps, setLoadingFollowUps] = useState<boolean>(true);
  const [loadingSequences, setLoadingSequences] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Leads & Appointments Modals State
  const [leadModalOpen, setLeadModalOpen] = useState<boolean>(false);
  const [initialLeadForModal, setInitialLeadForModal] = useState<Partial<Lead> | null>(null);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState<boolean>(false);
  const [initialAppointmentForModal, setInitialAppointmentForModal] =
    useState<Partial<Appointment> | null>(null);
  const [initialContactForAppointment, setInitialContactForAppointment] =
    useState<Contact | null>(null);

  const openLeadModal = (initialLead?: Partial<Lead>) => {
    setInitialLeadForModal(initialLead || null);
    setLeadModalOpen(true);
  };

  const closeLeadModal = () => {
    setLeadModalOpen(false);
    setInitialLeadForModal(null);
  };

  const openAppointmentModal = (
    initialAppointment?: Partial<Appointment>,
    contact?: Contact
  ) => {
    setInitialAppointmentForModal(initialAppointment || null);
    setInitialContactForAppointment(contact || null);
    setAppointmentModalOpen(true);
  };

  const closeAppointmentModal = () => {
    setAppointmentModalOpen(false);
    setInitialAppointmentForModal(null);
    setInitialContactForAppointment(null);
  };

  // Upgrade Modal State
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [upgradeReason, setUpgradeReason] = useState<string>('');

  // AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiTargetFollowUp, setAiTargetFollowUp] = useState<FollowUp | null>(null);
  const [aiTargetContact, setAiTargetContact] = useState<Contact | null>(null);

  // Execute Step Modal State
  const [executeModalOpen, setExecuteModalOpen] = useState<boolean>(false);
  const [activeEnrollmentToExecute, setActiveEnrollmentToExecute] =
    useState<SequenceEnrollment | null>(null);

  // Flow AI Assistant Drawer / Floating Chat State
  const [flowChatOpen, setFlowChatOpen] = useState<boolean>(false);

  // Rapid Follow-Up Session State
  const [followUpSessionOpen, setFollowUpSessionOpen] = useState<boolean>(false);
  const [sessionIndex, setSessionIndex] = useState<number>(0);

  const openFlowChat = () => setFlowChatOpen(true);
  const closeFlowChat = () => setFlowChatOpen(false);
  const toggleFlowChat = () => setFlowChatOpen((prev) => !prev);

  const openUpgradeModal = (
    reason: string = 'Upgrade to Pro for unlimited contacts, follow-ups, and AI message generations.'
  ) => {
    setUpgradeReason(reason);
    setUpgradeModalOpen(true);
    if (user) {
      trackEvent('upgrade_clicked', user.uid, { reason });
    }
  };

  const closeUpgradeModal = () => {
    setUpgradeModalOpen(false);
    setUpgradeReason('');
  };

  const openAiModal = (followUp?: FollowUp, contact?: Contact) => {
    setAiTargetFollowUp(followUp || null);
    if (contact) {
      setAiTargetContact(contact);
    } else if (followUp?.contactId) {
      const found = contacts.find((c) => c.id === followUp.contactId);
      setAiTargetContact(found || null);
    } else {
      setAiTargetContact(null);
    }
    setAiModalOpen(true);
  };

  const closeAiModal = () => {
    setAiModalOpen(false);
    setAiTargetFollowUp(null);
    setAiTargetContact(null);
  };

  const openExecuteModal = (enrollment: SequenceEnrollment) => {
    setActiveEnrollmentToExecute(enrollment);
    setExecuteModalOpen(true);
  };

  const closeExecuteModal = () => {
    setExecuteModalOpen(false);
    setActiveEnrollmentToExecute(null);
  };

  // Fetch Sequences & Enrollments
  const loadSequencesAndEnrollments = async () => {
    if (!user) {
      setSequences([]);
      setSequenceEnrollments([]);
      setLoadingSequences(false);
      return;
    }
    try {
      setLoadingSequences(true);
      const [seqs, enrolls] = await Promise.all([
        getSequences(user.uid),
        getSequenceEnrollments(user.uid),
      ]);
      setSequences(seqs);
      setSequenceEnrollments(enrolls);
    } catch (err: any) {
      console.error('Failed to load sequences:', err);
    } finally {
      setLoadingSequences(false);
    }
  };

  useEffect(() => {
    loadSequencesAndEnrollments();
  }, [user]);

  // Subscriptions to Firestore
  useEffect(() => {
    if (!user) {
      setContacts([]);
      setFollowUps([]);
      setLeads([]);
      setAppointments([]);
      setLoadingContacts(false);
      setLoadingFollowUps(false);
      return;
    }

    setLoadingContacts(true);
    setLoadingFollowUps(true);
    setError(null);

    const unsubContacts = subscribeToContacts(
      user.uid,
      (data) => {
        setContacts(data);
        setLoadingContacts(false);
      },
      (err) => {
        setError(err.message);
        setLoadingContacts(false);
      }
    );

    const unsubFollowUps = subscribeToFollowUps(
      user.uid,
      (data) => {
        setFollowUps(data);
        setLoadingFollowUps(false);
      },
      (err) => {
        setError(err.message);
        setLoadingFollowUps(false);
      }
    );

    const unsubLeads = subscribeLeads(user.uid, (data) => {
      setLeads(data);
    });

    const unsubAppointments = subscribeAppointments(user.uid, (data) => {
      setAppointments(data);
    });

    return () => {
      unsubContacts();
      unsubFollowUps();
      unsubLeads();
      unsubAppointments();
    };
  }, [user]);

  // Derived Categorizations
  const {
    todayFollowUps,
    overdueFollowUps,
    highValueFollowUps,
    upcomingFollowUps,
    completedFollowUps,
    activeFollowUps,
  } = useMemo(() => {
    const todayStr = getTodayString();
    const todayList: FollowUp[] = [];
    const overdueList: FollowUp[] = [];
    const highValueList: FollowUp[] = [];
    const upcomingList: FollowUp[] = [];
    const completedList: FollowUp[] = [];
    const activeList: FollowUp[] = [];

    followUps.forEach((item) => {
      if (item.status === 'completed') {
        completedList.push(item);
        return;
      }
      if (item.status === 'cancelled') {
        return;
      }

      // It's active
      activeList.push(item);

      const daysDiff = getDaysDiffFromToday(item.dueDate);

      if (daysDiff < 0) {
        overdueList.push(item);
      } else if (daysDiff === 0 || item.dueDate === todayStr) {
        todayList.push(item);
      } else if (daysDiff > 0) {
        upcomingList.push(item);
      }

      // High value criteria: amount >= $1000 or marked urgent/high
      if ((item.amount && item.amount >= 1000) || item.priority === 'urgent') {
        highValueList.push(item);
      }
    });

    return {
      todayFollowUps: todayList,
      overdueFollowUps: overdueList,
      highValueFollowUps: highValueList,
      upcomingFollowUps: upcomingList,
      completedFollowUps: completedList,
      activeFollowUps: activeList,
    };
  }, [followUps]);

  // Priority Session Queue: Overdue first (descending days), then Today (highest amount first)
  const sessionQueue = useMemo(() => {
    const overdueSorted = [...overdueFollowUps].sort((a, b) => {
      const diffA = getDaysDiffFromToday(a.dueDate);
      const diffB = getDaysDiffFromToday(b.dueDate);
      return diffA - diffB; // Most overdue first
    });

    const todaySorted = [...todayFollowUps].sort((a, b) => {
      const amtA = a.amount || 0;
      const amtB = b.amount || 0;
      return amtB - amtA; // Higher amount first
    });

    return [...overdueSorted, ...todaySorted];
  }, [overdueFollowUps, todayFollowUps]);

  const startFollowUpSession = () => {
    setSessionIndex(0);
    setFollowUpSessionOpen(true);
    if (user) {
      trackEvent('session_started', user.uid, { count: sessionQueue.length });
    }
  };

  const closeFollowUpSession = () => {
    setFollowUpSessionOpen(false);
    setSessionIndex(0);
  };

  const nextSessionItem = () => {
    setSessionIndex((prev) => Math.min(prev + 1, Math.max(0, sessionQueue.length - 1)));
  };

  const prevSessionItem = () => {
    setSessionIndex((prev) => Math.max(prev - 1, 0));
  };

  // Sequence Enrollments calculations
  const activeEnrollments = useMemo(() => {
    return sequenceEnrollments.filter((e) => e.status === 'active');
  }, [sequenceEnrollments]);

  const dueSequenceEnrollments = useMemo(() => {
    const todayStr = getTodayString();
    return activeEnrollments.filter((e) => !e.nextStepDueAt || e.nextStepDueAt <= todayStr);
  }, [activeEnrollments]);

  const activeSequenceForExecution = useMemo(() => {
    if (!activeEnrollmentToExecute) return null;
    return sequences.find((s) => s.id === activeEnrollmentToExecute.sequenceId) || null;
  }, [activeEnrollmentToExecute, sequences]);

  // Calculated Stats (strictly derived from real records)
  const stats = useMemo(() => {
    const moneyAtRisk = activeFollowUps.reduce((sum, item) => {
      if (item.type !== 'invoice' && item.amount && !isNaN(item.amount)) {
        return sum + Number(item.amount);
      }
      return sum;
    }, 0);

    const outstandingInvoices = activeFollowUps.reduce((sum, item) => {
      if (item.type === 'invoice' && item.amount && !isNaN(item.amount)) {
        return sum + Number(item.amount);
      }
      return sum;
    }, 0);

    const totalFollowUpValue = moneyAtRisk + outstandingInvoices;

    const pendingInvoices = activeFollowUps.filter((f) => f.type === 'invoice');
    const pendingInvoicesCount = pendingInvoices.length;
    const pendingInvoicesTotal = outstandingInvoices;

    const upcomingAppointmentsCount =
      appointments.filter((a) => {
        const p = parseAppointmentTimestamp(a.scheduledAt);
        return p.isUpcoming || p.isToday;
      }).length + activeFollowUps.filter((f) => f.type === 'appointment').length;

    const leadContactIds = new Set(
      contacts
        .filter((c) => c.tags?.includes('Lead') || c.tags?.includes('Prospect'))
        .map((c) => c.id)
    );
    activeFollowUps.forEach((f) => {
      if (f.type === 'lead') {
        leadContactIds.add(f.contactId);
      }
    });

    return {
      todayCount: todayFollowUps.length,
      overdueCount: overdueFollowUps.length,
      activeLeadsCount: leadContactIds.size,
      moneyAtRisk,
      outstandingInvoices,
      totalFollowUpValue,
      moneyWaiting: totalFollowUpValue,
      dueSequencesCount: dueSequenceEnrollments.length,
      pendingInvoicesCount,
      pendingInvoicesTotal,
      upcomingAppointmentsCount,
    };
  }, [
    todayFollowUps,
    overdueFollowUps,
    activeFollowUps,
    contacts,
    dueSequenceEnrollments,
    appointments,
  ]);

  // Action: Add Contact with Free Tier check
  const handleAddContact = async (
    data: Omit<Contact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');

    const plan = isPro ? 'pro' : userProfile?.plan || 'free';
    const limit = PLAN_LIMITS[plan].maxContacts;
    if (contacts.length >= limit) {
      openUpgradeModal(`You've reached your limit of ${limit} contacts on the Free plan.`);
      throw new Error(`Contact limit reached (${limit} contacts). Please upgrade to Pro.`);
    }

    const contactId = await createContact(user.uid, data);
    await logTimelineEvent(user.uid, {
      contactId,
      type: 'created',
      title: `Added contact ${data.name}`,
      description: data.company ? `Company: ${data.company}` : undefined,
    });
    await trackEvent('contact_created', user.uid, { contactId, company: data.company });
    return contactId;
  };

  const handleEditContact = async (contactId: string, data: Partial<Contact>) => {
    if (!user) throw new Error('User must be logged in.');
    await updateContact(user.uid, contactId, data);
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!user) throw new Error('User must be logged in.');
    await deleteContact(user.uid, contactId);
  };

  // Action: Add Follow-up with Free Tier check
  const handleAddFollowUp = async (
    data: Omit<FollowUp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');

    const plan = isPro ? 'pro' : userProfile?.plan || 'free';
    const limit = PLAN_LIMITS[plan].maxActiveFollowUps;
    if (activeFollowUps.length >= limit) {
      openUpgradeModal(
        `You've reached your limit of ${limit} active follow-ups on the Free plan.`
      );
      throw new Error(
        `Active follow-up limit reached (${limit} follow-ups). Please upgrade to Pro.`
      );
    }

    const followUpId = await createFollowUp(user.uid, data);
    await logTimelineEvent(user.uid, {
      contactId: data.contactId,
      followUpId,
      type: 'created',
      title: `Created follow-up: "${data.title}"`,
      amount: data.amount,
      currency: data.currency,
      channel: data.channel,
    });
    await trackEvent('followup_created', user.uid, {
      followUpId,
      type: data.type,
      priority: data.priority,
      amount: data.amount,
    });
    return followUpId;
  };

  const handleEditFollowUp = async (followUpId: string, data: Partial<FollowUp>) => {
    if (!user) throw new Error('User must be logged in.');
    await updateFollowUp(user.uid, followUpId, data);
  };

  const handleMarkCompleted = async (followUpId: string) => {
    if (!user) throw new Error('User must be logged in.');
    const found = followUps.find((f) => f.id === followUpId);
    await completeFollowUp(user.uid, followUpId);
    if (found?.contactId) {
      await logTimelineEvent(user.uid, {
        contactId: found.contactId,
        followUpId,
        type: 'completed',
        title: `Completed follow-up: "${found.title}"`,
        amount: found.amount,
        currency: found.currency,
      });
    }
    await trackEvent('followup_completed', user.uid, { followUpId });
  };

  const handleSnooze = async (followUpId: string, snoozeOption: number | string) => {
    if (!user) throw new Error('User must be logged in.');
    const found = followUps.find((f) => f.id === followUpId);
    const newDueDate = await snoozeFollowUp(user.uid, followUpId, snoozeOption);
    if (found?.contactId) {
      await logTimelineEvent(user.uid, {
        contactId: found.contactId,
        followUpId,
        type: 'snoozed',
        title: `Snoozed follow-up until ${newDueDate}`,
      });
    }
    return newDueDate;
  };

  const handleRemoveFollowUp = async (followUpId: string) => {
    if (!user) throw new Error('User must be logged in.');
    await deleteFollowUp(user.uid, followUpId);
  };

  // Lead Actions
  const handleAddLead = async (
    data: Omit<Lead, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    const result = await createLead(user.uid, data);
    await trackEvent('lead_created', user.uid, {
      leadSource: data.leadSource,
      expectedDealValue: data.expectedDealValue,
    });
    return result;
  };

  const handleEditLead = async (leadId: string, data: Partial<Lead>) => {
    if (!user) throw new Error('User must be logged in.');
    await updateLead(user.uid, leadId, data);
  };

  const handleRemoveLead = async (leadId: string) => {
    if (!user) throw new Error('User must be logged in.');
    await deleteLead(user.uid, leadId);
  };

  // Appointment Actions
  const handleAddAppointment = async (
    data: Omit<Appointment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    const apptId = await createAppointment(user.uid, data);
    await trackEvent('appointment_created', user.uid, {
      channel: data.channel,
      durationMinutes: data.durationMinutes,
    });
    return apptId;
  };

  const handleEditAppointment = async (appointmentId: string, data: Partial<Appointment>) => {
    if (!user) throw new Error('User must be logged in.');
    await updateAppointment(user.uid, appointmentId, data);
  };

  const handleRemoveAppointment = async (appointmentId: string) => {
    if (!user) throw new Error('User must be logged in.');
    await deleteAppointment(user.uid, appointmentId);
  };

  const completeSessionItem = async (followUpId: string) => {
    await handleMarkCompleted(followUpId);
  };

  const snoozeSessionItem = async (followUpId: string, days: number | string) => {
    await handleSnooze(followUpId, days);
  };

  // Sequence Actions
  const handleAddSequence = async (
    data: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    const id = await saveSequence(user.uid, data);
    await loadSequencesAndEnrollments();
    await trackEvent('sequence_created', user.uid, { name: data.name });
    return id;
  };

  const handleEditSequence = async (
    sequenceId: string,
    data: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    await saveSequence(user.uid, data, sequenceId);
    await loadSequencesAndEnrollments();
  };

  const handleRemoveSequence = async (sequenceId: string) => {
    if (!user) throw new Error('User must be logged in.');
    await deleteSequenceFromDb(user.uid, sequenceId);
    await loadSequencesAndEnrollments();
  };

  const handleEnrollContact = async (
    data: Omit<SequenceEnrollment, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'history'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    const id = await createSequenceEnrollment(user.uid, data);
    await loadSequencesAndEnrollments();

    // Trigger initial follow-up for Step 1 (preventing duplicates)
    try {
      const step1AlreadyExists = followUps.some(
        (f) =>
          f.contactId === data.contactId &&
          f.title.includes(`[${data.sequenceName}]`) &&
          f.title.includes('Step 1') &&
          f.status !== 'completed'
      );
      if (!step1AlreadyExists) {
        await handleAddFollowUp({
          contactId: data.contactId,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          title: `[${data.sequenceName}] Step 1: ${data.nextStepTitle || 'Step 1'}`,
          description: `Automated sequence cadence (Step 1 of ${data.totalSteps}) for ${data.contactName}`,
          type: 'general',
          dueDate: data.nextStepDueAt,
          priority: 'high',
          channel: data.nextStepChannel || 'email',
          status: 'pending',
          currency: 'USD',
        });
      }
    } catch (followUpErr) {
      console.warn('Could not auto-create follow-up for sequence enrollment:', followUpErr);
    }

    await logTimelineEvent(user.uid, {
      contactId: data.contactId,
      type: 'sequence_step',
      title: `Enrolled in sequence: ${data.sequenceName}`,
    });
    await trackEvent('sequence_enrolled', user.uid, {
      sequenceId: data.sequenceId,
      contactId: data.contactId,
    });
    return id;
  };

  const handleExecuteStep = async (
    enrollmentId: string,
    history: SequenceEnrollmentStepHistory,
    nextDelayDays?: number,
    nextChannel?: FollowUpChannel,
    nextTitle?: string
  ) => {
    if (!user) throw new Error('User must be logged in.');
    const enrollment = sequenceEnrollments.find((e) => e.id === enrollmentId);

    await advanceSequenceEnrollment(
      user.uid,
      enrollmentId,
      history,
      nextDelayDays,
      nextChannel,
      nextTitle
    );
    await loadSequencesAndEnrollments();

    // Complete previous follow-up for this step if present
    try {
      const activeSeqFollowUp = followUps.find(
        (f) =>
          f.contactId === enrollment?.contactId &&
          f.status !== 'completed' &&
          f.title.includes(`[${enrollment?.sequenceName}]`) &&
          f.title.includes(`Step ${history.stepNumber}`)
      );
      if (activeSeqFollowUp) {
        await handleMarkCompleted(activeSeqFollowUp.id);
      }
    } catch (fErr) {
      console.warn('Error completing sequence follow-up:', fErr);
    }

    // Trigger next follow-up if sequence has more steps (preventing duplicates)
    if (enrollment && enrollment.currentStepNumber < enrollment.totalSteps && nextTitle) {
      try {
        const nextStepNum = enrollment.currentStepNumber + 1;
        const nextStepAlreadyExists = followUps.some(
          (f) =>
            f.contactId === enrollment.contactId &&
            f.title.includes(`[${enrollment.sequenceName}]`) &&
            f.title.includes(`Step ${nextStepNum}`) &&
            f.status !== 'completed'
        );

        if (!nextStepAlreadyExists) {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + (nextDelayDays || 3));
          const nextDueStr = nextDate.toISOString().split('T')[0];

          await handleAddFollowUp({
            contactId: enrollment.contactId,
            contactName: enrollment.contactName,
            contactEmail: enrollment.contactEmail,
            contactPhone: enrollment.contactPhone,
            title: `[${enrollment.sequenceName}] Step ${nextStepNum}: ${nextTitle}`,
            description: `Automated sequence cadence (Step ${nextStepNum} of ${enrollment.totalSteps}) for ${enrollment.contactName}`,
            type: 'general',
            dueDate: nextDueStr,
            priority: 'high',
            channel: nextChannel || 'email',
            status: 'pending',
            currency: 'USD',
          });
        }
      } catch (nextFErr) {
        console.warn('Error scheduling next sequence follow-up:', nextFErr);
      }
    }

    if (enrollment?.contactId) {
      await logTimelineEvent(user.uid, {
        contactId: enrollment.contactId,
        type: 'sequence_step',
        title: `Executed Step ${history.stepNumber}: "${history.stepTitle}"`,
        channel: history.channel,
      });
    }

    await trackEvent('sequence_step_executed', user.uid, {
      enrollmentId,
      stepNumber: history.stepNumber,
      channel: history.channel,
    });
  };

  const handleChangeEnrollmentStatus = async (
    enrollmentId: string,
    status: SequenceEnrollmentStatus
  ) => {
    if (!user) throw new Error('User must be logged in.');
    await updateSequenceEnrollmentStatus(user.uid, enrollmentId, status);
    await loadSequencesAndEnrollments();
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!user) throw new Error('User must be logged in.');
    await deleteSequenceEnrollment(user.uid, enrollmentId);
    await loadSequencesAndEnrollments();
  };

  const handleLoadDemoData = async () => {
    if (!user) return;
    await seedDemoData(user.uid);
    await loadSequencesAndEnrollments();
  };

  const handleClearData = async () => {
    if (!user) return;
    await clearAllUserData(user.uid);
    await loadSequencesAndEnrollments();
  };

  return (
    <FollowUpContext.Provider
      value={{
        contacts,
        followUps,
        leads,
        appointments,
        sequences,
        sequenceEnrollments,
        activeEnrollments,
        dueSequenceEnrollments,
        loading: loadingContacts || loadingFollowUps || loadingSequences,
        error,
        stats,
        todayFollowUps,
        overdueFollowUps,
        highValueFollowUps,
        upcomingFollowUps,
        completedFollowUps,
        activeFollowUps,
        addContact: handleAddContact,
        editContact: handleEditContact,
        removeContact: handleRemoveContact,
        deleteContact: handleRemoveContact,
        addFollowUp: handleAddFollowUp,
        editFollowUp: handleEditFollowUp,
        markCompleted: handleMarkCompleted,
        snooze: handleSnooze,
        removeFollowUp: handleRemoveFollowUp,
        deleteFollowUp: handleRemoveFollowUp,
        addLead: handleAddLead,
        editLead: handleEditLead,
        removeLead: handleRemoveLead,
        addAppointment: handleAddAppointment,
        editAppointment: handleEditAppointment,
        removeAppointment: handleRemoveAppointment,
        refreshSequences: loadSequencesAndEnrollments,
        addSequence: handleAddSequence,
        editSequence: handleEditSequence,
        removeSequence: handleRemoveSequence,
        enrollContact: handleEnrollContact,
        executeStep: handleExecuteStep,
        changeEnrollmentStatus: handleChangeEnrollmentStatus,
        removeEnrollment: handleRemoveEnrollment,
        loadDemoData: handleLoadDemoData,
        clearData: handleClearData,
        upgradeModalOpen,
        upgradeReason,
        openUpgradeModal,
        closeUpgradeModal,
        aiModalOpen,
        aiTargetFollowUp,
        aiTargetContact,
        openAiModal,
        closeAiModal,
        executeModalOpen,
        activeEnrollmentToExecute,
        activeSequenceForExecution,
        openExecuteModal,
        closeExecuteModal,
        leadModalOpen,
        initialLeadForModal,
        openLeadModal,
        closeLeadModal,
        appointmentModalOpen,
        initialAppointmentForModal,
        initialContactForAppointment,
        openAppointmentModal,
        closeAppointmentModal,
        flowChatOpen,
        openFlowChat,
        closeFlowChat,
        toggleFlowChat,
        followUpSessionOpen,
        startFollowUpSession,
        closeFollowUpSession,
        sessionIndex,
        sessionQueue,
        completeSessionItem,
        snoozeSessionItem,
        nextSessionItem,
        prevSessionItem,
      }}
    >
      {children}
    </FollowUpContext.Provider>
  );
};

export const useFollowUp = (): FollowUpContextType => {
  const context = useContext(FollowUpContext);
  if (!context) {
    throw new Error('useFollowUp must be used within a FollowUpProvider');
  }
  return context;
};
