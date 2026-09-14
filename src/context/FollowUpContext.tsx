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
  logGeneratedMessage,
} from '../services/db';
import { generateFollowUpMessage } from '../services/ai';
import { trackEvent } from '../services/analytics';
import { emitBusinessEvent } from '../services/eventBus';
import {
  PLAN_LIMITS,
  type Contact,
  type FollowUp,
  type FollowUpStatus,
  type Sequence,
  type SequenceEnrollment,
  type SequenceEnrollmentStepHistory,
  type SequenceEnrollmentStatus,
  type FollowUpChannel,
  type MessageTone,
  type Lead,
  type Appointment,
  type LeadSource,
  type LeadStatus,
} from '../types';

export interface AiDraftState {
  contactId: string;
  followUpId: string;
  subject: string;
  messageText: string;
  channel: FollowUpChannel;
  tone: MessageTone;
  contextInput: string;
  isGenerating: boolean;
  error: string | null;
  lastGeneratedAt?: string;
}

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

  // Bulk Operations
  bulkDeleteFollowUps: (ids: string[]) => Promise<void>;
  bulkMarkAsPaid: (ids: string[]) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: FollowUpStatus) => Promise<void>;
  bulkDeleteContacts: (ids: string[]) => Promise<void>;

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

  // Customer Response & Sequencer Handling
  handleCustomerResponded: (contactId: string, responseNotes?: string, followUpId?: string) => Promise<void>;

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
  aiInitialTemplate: { subject?: string; message?: string; channel?: FollowUpChannel; tone?: MessageTone; category?: string } | null;
  openAiModal: (
    followUp?: FollowUp,
    contact?: Contact,
    initialTemplate?: { subject?: string; message?: string; channel?: FollowUpChannel; tone?: MessageTone; category?: string }
  ) => void;
  closeAiModal: () => void;
  aiDraft: AiDraftState;
  updateAiDraft: (partial: Partial<AiDraftState>) => void;
  resetAiDraft: () => void;
  generateAiFollowUpMessage: (params?: {
    contact?: Contact;
    followUp?: FollowUp;
    channel?: FollowUpChannel;
    tone?: MessageTone;
    additionalContext?: string;
    project?: string;
    amount?: number;
    currency?: string;
  }) => Promise<{ subject: string; message: string }>;

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
  startFollowUpSession: (initialFollowUpId?: string) => void;
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
  const { user, userProfile, isPro, incrementAiUsage } = useAuth();

  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      if (typeof window !== 'undefined' && user?.uid) {
        const cached = localStorage.getItem(`followflow_contacts_${user.uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [followUps, setFollowUps] = useState<FollowUp[]>(() => {
    try {
      if (typeof window !== 'undefined' && user?.uid) {
        const cached = localStorage.getItem(`followflow_followups_${user.uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [sequenceEnrollments, setSequenceEnrollments] = useState<SequenceEnrollment[]>([]);
  const [loadingContacts, setLoadingContacts] = useState<boolean>(true);
  const [loadingFollowUps, setLoadingFollowUps] = useState<boolean>(true);
  const [loadingSequences, setLoadingSequences] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Persistent storage mirrors: ensure user-provided data remains available after API calls
  useEffect(() => {
    if (!user?.uid) return;
    try {
      if (contacts.length > 0) {
        localStorage.setItem(`followflow_contacts_${user.uid}`, JSON.stringify(contacts));
      }
    } catch {}
  }, [contacts, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    try {
      if (followUps.length > 0) {
        localStorage.setItem(`followflow_followups_${user.uid}`, JSON.stringify(followUps));
      }
    } catch {}
  }, [followUps, user?.uid]);

  // Centralized AI Draft State - Persisted across async operations and re-renders
  const [aiDraft, setAiDraft] = useState<AiDraftState>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('followflow_active_ai_draft');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
    } catch {}
    return {
      contactId: '',
      followUpId: '',
      subject: '',
      messageText: '',
      channel: 'email',
      tone: 'professional',
      contextInput: '',
      isGenerating: false,
      error: null,
    };
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('followflow_active_ai_draft', JSON.stringify(aiDraft));
      }
    } catch {}
  }, [aiDraft]);

  const updateAiDraft = (partial: Partial<AiDraftState>) => {
    setAiDraft((prev) => ({ ...prev, ...partial }));
  };

  const resetAiDraft = () => {
    setAiDraft({
      contactId: '',
      followUpId: '',
      subject: '',
      messageText: '',
      channel: 'email',
      tone: 'professional',
      contextInput: '',
      isGenerating: false,
      error: null,
    });
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('followflow_active_ai_draft');
      }
    } catch {}
  };

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
  const [aiInitialTemplate, setAiInitialTemplate] = useState<{
    subject?: string;
    message?: string;
    channel?: FollowUpChannel;
    tone?: MessageTone;
    category?: string;
  } | null>(null);

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

  const openAiModal = (
    followUp?: FollowUp,
    contact?: Contact,
    initialTemplate?: {
      subject?: string;
      message?: string;
      channel?: FollowUpChannel;
      tone?: MessageTone;
      category?: string;
    }
  ) => {
    setAiTargetFollowUp(followUp || null);
    if (contact) {
      setAiTargetContact(contact);
    } else if (followUp?.contactId) {
      const found = contacts.find((c) => c.id === followUp.contactId);
      setAiTargetContact(found || null);
    } else {
      setAiTargetContact(null);
    }
    setAiInitialTemplate(initialTemplate || null);

    if (initialTemplate) {
      setAiDraft((prev) => ({
        ...prev,
        contactId: contact?.id || followUp?.contactId || prev.contactId,
        followUpId: followUp?.id || prev.followUpId,
        subject: initialTemplate.subject || prev.subject,
        messageText: initialTemplate.message || prev.messageText,
        channel: initialTemplate.channel || prev.channel || 'email',
        tone: initialTemplate.tone || prev.tone || 'professional',
        error: null,
      }));
    } else if (followUp) {
      setAiDraft((prev) => ({
        ...prev,
        contactId: followUp.contactId || prev.contactId,
        followUpId: followUp.id,
        channel: followUp.channel || prev.channel || 'email',
        contextInput: followUp.description || prev.contextInput,
        error: null,
      }));
    }

    setAiModalOpen(true);
  };

  const closeAiModal = () => {
    setAiModalOpen(false);
    setAiTargetFollowUp(null);
    setAiTargetContact(null);
    setAiInitialTemplate(null);
  };

  const generateAiFollowUpMessage = async (params?: {
    contact?: Contact;
    followUp?: FollowUp;
    channel?: FollowUpChannel;
    tone?: MessageTone;
    additionalContext?: string;
    project?: string;
    amount?: number;
    currency?: string;
  }): Promise<{ subject: string; message: string }> => {
    setAiDraft((prev) => ({ ...prev, isGenerating: true, error: null }));

    try {
      const activeContact =
        params?.contact ||
        aiTargetContact ||
        (aiDraft.contactId ? contacts.find((c) => c.id === aiDraft.contactId) : null) ||
        (contacts.length > 0 ? contacts[0] : undefined);

      const activeFollowUp =
        params?.followUp ||
        aiTargetFollowUp ||
        (aiDraft.followUpId ? followUps.find((f) => f.id === aiDraft.followUpId) : null) ||
        undefined;

      const chosenChannel = params?.channel || aiDraft.channel || 'email';
      const chosenTone = params?.tone || aiDraft.tone || 'professional';
      const combinedContext = params?.additionalContext ?? aiDraft.contextInput ?? '';

      const fallbackContact: Contact = activeContact || {
        id: 'temp-contact',
        userId: user?.uid || 'guest',
        name: 'Client',
        email: '',
        tags: ['Client'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await generateFollowUpMessage({
        contact: fallbackContact,
        followUp: activeFollowUp || (params?.amount != null ? {
          id: 'temp-fu',
          userId: user?.uid || 'guest',
          contactId: fallbackContact.id,
          title: params?.project || 'Follow-up',
          type: 'general',
          channel: chosenChannel,
          amount: params?.amount,
          currency: params?.currency || '$',
          status: 'pending',
          dueDate: getTodayString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as FollowUp : undefined),
        tone: chosenTone,
        channel: chosenChannel,
        additionalContext: combinedContext,
        userId: user?.uid,
        isPro,
        currentCount: userProfile?.aiGenerationsCount || 0,
      });

      const fallbackSubject = activeFollowUp?.title
        ? `Following up on ${activeFollowUp.title}`
        : fallbackContact?.name && fallbackContact.name !== 'Client'
        ? `Following up with ${fallbackContact.name}`
        : 'Quick follow-up';

      const finalSubject = result.subject?.trim() || (chosenChannel === 'email' ? fallbackSubject : '');
      const finalMessage = result.message || '';

      // Update state in FollowUpContext so it's guaranteed to be preserved across re-renders
      setAiDraft((prev) => ({
        ...prev,
        subject: finalSubject,
        messageText: finalMessage,
        channel: chosenChannel,
        tone: chosenTone,
        isGenerating: false,
        error: null,
        lastGeneratedAt: new Date().toISOString(),
      }));

      // Increment AI usage in AuthContext
      await incrementAiUsage();

      if (user && activeContact && !activeContact.id.startsWith('temp-')) {
        await logGeneratedMessage(user.uid, {
          followUpId: activeFollowUp?.id,
          contactId: activeContact.id,
          contactName: activeContact.name,
          tone: chosenTone,
          channel: chosenChannel,
          context: combinedContext,
          subject: finalSubject,
          generatedContent: finalMessage,
          finalContent: finalMessage,
        }).catch(() => {});

        await trackEvent('ai_message_generated', user.uid, {
          tone: chosenTone,
          channel: chosenChannel,
          contactId: activeContact.id,
          followUpId: activeFollowUp?.id,
        }).catch(() => {});
      }

      return { subject: finalSubject, message: finalMessage };
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to generate message. Please try again.';
      console.error('[FollowUpContext] generateAiFollowUpMessage error:', err);
      setAiDraft((prev) => ({
        ...prev,
        isGenerating: false,
        error: errMsg,
      }));
      throw err;
    }
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
      console.warn('[Sequences] Sequences loading fallback:', err?.message || err);
    } finally {
      setLoadingSequences(false);
    }
  };

  useEffect(() => {
    loadSequencesAndEnrollments();
  }, [user?.uid]);

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
        console.warn('[Contacts] Subscription notice:', err?.message || err);
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
        console.warn('[FollowUps] Subscription notice:', err?.message || err);
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
  }, [user?.uid]);

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

  const [customQueue, setCustomQueue] = useState<FollowUp[] | null>(null);

  // Priority Session Queue: Overdue first (descending days), then Today (highest amount first)
  const sessionQueue = useMemo(() => {
    if (customQueue && customQueue.length > 0) return customQueue;

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

    const combined = [...overdueSorted, ...todaySorted];
    return combined.length > 0 ? combined : activeFollowUps.slice(0, 10);
  }, [overdueFollowUps, todayFollowUps, activeFollowUps, customQueue]);

  const startFollowUpSession = (initialFollowUpId?: string) => {
    if (initialFollowUpId) {
      const target = followUps.find((f) => f.id === initialFollowUpId);
      if (target) {
        const baseQueue = [...overdueFollowUps, ...todayFollowUps];
        const otherItems = baseQueue.filter((f) => f.id !== initialFollowUpId);
        setCustomQueue([target, ...otherItems]);
        setSessionIndex(0);
        setFollowUpSessionOpen(true);
        if (user) {
          trackEvent('session_started', user.uid, { initialFollowUpId, count: otherItems.length + 1 });
        }
        return;
      }
    }
    setCustomQueue(null);
    setSessionIndex(0);
    setFollowUpSessionOpen(true);
    if (user) {
      trackEvent('session_started', user.uid, { count: sessionQueue.length });
    }
  };

  const closeFollowUpSession = () => {
    setFollowUpSessionOpen(false);
    setSessionIndex(0);
    setCustomQueue(null);
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
    const now = new Date().toISOString();
    const newContact: Contact = {
      id: contactId,
      userId: user.uid,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    // Optimistically update contacts state immediately
    setContacts((prev) => [newContact, ...prev.filter((c) => c.id !== contactId)]);

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
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
    );
    await updateContact(user.uid, contactId, data);
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!user) throw new Error('User must be logged in.');
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
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
    const now = new Date().toISOString();
    const newFollowUp: FollowUp = {
      id: followUpId,
      userId: user.uid,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    // Optimistically update followUps state immediately
    setFollowUps((prev) => [newFollowUp, ...prev.filter((f) => f.id !== followUpId)]);

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
    setFollowUps((prev) =>
      prev.map((f) => (f.id === followUpId ? { ...f, ...data, updatedAt: new Date().toISOString() } : f))
    );
    await updateFollowUp(user.uid, followUpId, data);
  };

  const handleMarkCompleted = async (followUpId: string) => {
    if (!user) throw new Error('User must be logged in.');
    const found = followUps.find((f) => f.id === followUpId);

    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === followUpId
          ? { ...f, status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : f
      )
    );
    await completeFollowUp(user.uid, followUpId);

    if (found?.contactId) {
      if (found.type === 'invoice') {
        // Genuine timeline event for invoice paid
        await logTimelineEvent(user.uid, {
          contactId: found.contactId,
          followUpId,
          type: 'invoice_paid',
          title: `Invoice Paid: "${found.title}" (${found.currency || '$'}${found.amount ? found.amount.toLocaleString() : '0'})`,
          amount: found.amount,
          currency: found.currency,
        });

        // Response-Aware logic: Stop active invoice recovery sequences
        const activeInvoiceEnrollments = sequenceEnrollments.filter(
          (e) =>
            e.contactId === found.contactId &&
            e.status === 'active' &&
            (e.sequenceName.toLowerCase().includes('invoice') ||
              e.sequenceName.toLowerCase().includes('payment') ||
              e.sequenceName.toLowerCase().includes('recovery'))
        );

        for (const enr of activeInvoiceEnrollments) {
          await updateSequenceEnrollmentStatus(user.uid, enr.id, 'completed');
          setSequenceEnrollments((prev) =>
            prev.map((e) => (e.id === enr.id ? { ...e, status: 'completed' } : e))
          );
        }
      } else if (found.type === 'proposal') {
        await logTimelineEvent(user.uid, {
          contactId: found.contactId,
          followUpId,
          type: 'completed',
          title: `Proposal Accepted / Follow-Up Completed: "${found.title}"`,
          amount: found.amount,
          currency: found.currency,
        });

        // Response-Aware logic: Stop active proposal sequences
        const activeProposalEnrollments = sequenceEnrollments.filter(
          (e) =>
            e.contactId === found.contactId &&
            e.status === 'active' &&
            (e.sequenceName.toLowerCase().includes('proposal') ||
              e.sequenceName.toLowerCase().includes('pitch') ||
              e.sequenceName.toLowerCase().includes('sales'))
        );

        for (const enr of activeProposalEnrollments) {
          await updateSequenceEnrollmentStatus(user.uid, enr.id, 'completed');
          setSequenceEnrollments((prev) =>
            prev.map((e) => (e.id === enr.id ? { ...e, status: 'completed' } : e))
          );
        }
      } else {
        await logTimelineEvent(user.uid, {
          contactId: found.contactId,
          followUpId,
          type: 'completed',
          title: `Completed follow-up: "${found.title}"`,
          amount: found.amount,
          currency: found.currency,
        });
      }
    }
    await trackEvent('followup_completed', user.uid, { followUpId });
  };

  const handleCustomerResponded = async (contactId: string, responseNotes?: string, followUpId?: string) => {
    if (!user) throw new Error('User must be logged in.');

    // 1. Log real timeline event for response received
    await logTimelineEvent(user.uid, {
      contactId,
      followUpId,
      type: 'response_received',
      title: 'Customer Response Received',
      description: responseNotes || 'Customer replied to outreach. Active automated sequences paused.',
    });

    // 2. Response-Aware Logic: Automatically pause active sequence enrollments for this contact to avoid robotic follow-ups
    const activeContactEnrollments = sequenceEnrollments.filter(
      (e) => e.contactId === contactId && e.status === 'active'
    );

    for (const enr of activeContactEnrollments) {
      await updateSequenceEnrollmentStatus(user.uid, enr.id, 'paused');
      setSequenceEnrollments((prev) =>
        prev.map((e) => (e.id === enr.id ? { ...e, status: 'paused' } : e))
      );
    }

    // 3. Mark the follow-up as contacted with note
    if (followUpId) {
      setFollowUps((prev) =>
        prev.map((f) =>
          f.id === followUpId
            ? {
                ...f,
                status: 'contacted',
                lastContactedAt: new Date().toISOString(),
                notes: responseNotes ? `${f.notes ? f.notes + ' | ' : ''}Customer response: ${responseNotes}` : f.notes,
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      );
      await updateFollowUp(user.uid, followUpId, {
        status: 'contacted',
        lastContactedAt: new Date().toISOString(),
      });
    }

    await trackEvent('customer_responded', user.uid, { contactId, followUpId });
  };

  const handleSnooze = async (followUpId: string, snoozeOption: number | string) => {
    if (!user) throw new Error('User must be logged in.');
    const found = followUps.find((f) => f.id === followUpId);
    const newDueDate = await snoozeFollowUp(user.uid, followUpId, snoozeOption);
    setFollowUps((prev) =>
      prev.map((f) =>
        f.id === followUpId ? { ...f, dueDate: newDueDate, updatedAt: new Date().toISOString() } : f
      )
    );
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
    setFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
    await deleteFollowUp(user.uid, followUpId);
  };

  // Bulk Operations Handlers
  const handleBulkDeleteFollowUps = async (ids: string[]) => {
    if (!user) throw new Error('User must be logged in.');
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setFollowUps((prev) => prev.filter((f) => !idSet.has(f.id)));
    await Promise.allSettled(ids.map((id) => deleteFollowUp(user.uid, id)));
  };

  const handleBulkMarkAsPaid = async (ids: string[]) => {
    if (!user) throw new Error('User must be logged in.');
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    setFollowUps((prev) =>
      prev.map((f) =>
        idSet.has(f.id)
          ? { ...f, status: 'completed', completedAt: now, updatedAt: now }
          : f
      )
    );
    await Promise.allSettled(
      ids.map(async (id) => {
        await completeFollowUp(user.uid, id);
        const item = followUps.find((f) => f.id === id);
        if (item?.contactId) {
          await logTimelineEvent(user.uid, {
            contactId: item.contactId,
            followUpId: id,
            type: 'completed',
            title: `Marked as paid: "${item.title}"`,
            amount: item.amount,
            currency: item.currency,
          });
        }
        await trackEvent('followup_completed', user.uid, { followUpId: id, bulk: true });
      })
    );
  };

  const handleBulkUpdateStatus = async (ids: string[], status: FollowUpStatus) => {
    if (!user) throw new Error('User must be logged in.');
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const updatePayload: Partial<FollowUp> = {
      status,
      updatedAt: now,
      ...(status === 'contacted' ? { lastContactedAt: now } : {}),
      ...(status === 'completed' ? { completedAt: now } : {}),
    };
    setFollowUps((prev) =>
      prev.map((f) => (idSet.has(f.id) ? { ...f, ...updatePayload } : f))
    );
    await Promise.allSettled(
      ids.map((id) => updateFollowUp(user.uid, id, updatePayload))
    );
  };

  const handleBulkDeleteContacts = async (ids: string[]) => {
    if (!user) throw new Error('User must be logged in.');
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setContacts((prev) => prev.filter((c) => !idSet.has(c.id)));
    await Promise.allSettled(ids.map((id) => deleteContact(user.uid, id)));
  };

  // Lead Actions
  const handleAddLead = async (
    data: Omit<Lead, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');

    // Deduplicate contact: check if contact already exists with same email, phone or exact name
    const existingContact = contacts.find(
      (c) =>
        (data.email && c.email?.toLowerCase() === data.email.toLowerCase()) ||
        (data.phone && c.phone === data.phone) ||
        c.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );

    let contactId = existingContact?.id;
    if (!contactId) {
      // Create primary contact record without duplicates
      contactId = await handleAddContact({
        name: data.name,
        company: data.company,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp,
        tags: ['Lead'],
        notes: data.notes,
        preferredChannel: 'email',
        communicationConsent: true,
      });
    }

    const result = await createLead(user.uid, data);

    // Log genuine chronological timeline event
    await logTimelineEvent(user.uid, {
      contactId,
      type: 'lead_created',
      title: `Lead Created: "${data.name}"`,
      description: `Stage: ${data.status} | Source: ${data.leadSource} | Deal Value: ${data.currency || '$'}${data.expectedDealValue ? data.expectedDealValue.toLocaleString() : '0'}`,
      amount: data.expectedDealValue,
      currency: data.currency,
    });

    // Emit reactive business event across system
    emitBusinessEvent.leadCreated(user.uid, {
      id: result.leadId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      leadSource: data.leadSource,
      expectedDealValue: data.expectedDealValue,
    });

    // Connect lifecycle to follow-up: if in proposal or negotiation stage, schedule priority follow-up
    if (data.status === 'proposal' || data.status === 'proposal_sent' || data.status === 'negotiation') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      await handleAddFollowUp({
        contactId,
        contactName: data.name,
        contactCompany: data.company,
        contactEmail: data.email,
        contactPhone: data.phone,
        title: `${data.status === 'negotiation' ? 'Negotiation Check-In' : 'Proposal Review'}: ${data.name}`,
        type: data.status === 'negotiation' ? 'lead' : 'proposal',
        amount: data.expectedDealValue,
        currency: data.currency || '$',
        dueDate: tomorrow.toISOString().split('T')[0],
        priority: 'high',
        channel: 'email',
        status: 'pending',
        description: `Active deal at ${data.status} stage. Expected value ${data.currency || '$'}${data.expectedDealValue?.toLocaleString() || '0'}.`,
      });
    }

    await trackEvent('lead_created', user.uid, {
      leadSource: data.leadSource,
      expectedDealValue: data.expectedDealValue,
    });
    return result;
  };

  const handleEditLead = async (leadId: string, data: Partial<Lead>) => {
    if (!user) throw new Error('User must be logged in.');
    const existingLead = leads.find((l) => l.id === leadId);
    await updateLead(user.uid, leadId, data);

    const contact = contacts.find(
      (c) =>
        (existingLead?.email && c.email?.toLowerCase() === existingLead.email.toLowerCase()) ||
        (existingLead?.name && c.name.toLowerCase() === existingLead.name.toLowerCase())
    );

    // If lifecycle stage updated to 'won'
    if (data.status === 'won' && contact) {
      // 1. Mark open proposal/lead follow-ups as completed
      const openDealFollowUps = followUps.filter(
        (f) => f.contactId === contact.id && f.status !== 'completed' && (f.type === 'proposal' || f.type === 'lead')
      );
      for (const f of openDealFollowUps) {
        await handleMarkCompleted(f.id);
      }

      // 2. Stop active proposal sequences
      const activeSeq = sequenceEnrollments.filter(
        (e) => e.contactId === contact.id && e.status === 'active'
      );
      for (const enr of activeSeq) {
        await updateSequenceEnrollmentStatus(user.uid, enr.id, 'completed');
        setSequenceEnrollments((prev) =>
          prev.map((e) => (e.id === enr.id ? { ...e, status: 'completed' } : e))
        );
      }

      await logTimelineEvent(user.uid, {
        contactId: contact.id,
        type: 'completed',
        title: `Deal Won: ${existingLead?.name || 'Lead'}`,
        description: `Lead status updated to Won! Value: ${existingLead?.currency || '$'}${existingLead?.expectedDealValue?.toLocaleString() || '0'}.`,
        amount: existingLead?.expectedDealValue,
        currency: existingLead?.currency,
      });
    }

    // If lifecycle stage updated to 'lost'
    if (data.status === 'lost' && contact) {
      const openDealFollowUps = followUps.filter(
        (f) => f.contactId === contact.id && f.status !== 'completed'
      );
      for (const f of openDealFollowUps) {
        await handleEditFollowUp(f.id, { status: 'cancelled' });
      }

      const activeSeq = sequenceEnrollments.filter(
        (e) => e.contactId === contact.id && e.status === 'active'
      );
      for (const enr of activeSeq) {
        await updateSequenceEnrollmentStatus(user.uid, enr.id, 'cancelled');
        setSequenceEnrollments((prev) =>
          prev.map((e) => (e.id === enr.id ? { ...e, status: 'cancelled' } : e))
        );
      }
    }

    // If stage changed to 'proposal'
    if ((data.status === 'proposal' || data.status === 'proposal_sent') && contact) {
      await logTimelineEvent(user.uid, {
        contactId: contact.id,
        type: 'proposal_created',
        title: `Proposal Sent: "${existingLead?.name}"`,
        description: `Proposal presented for value: ${existingLead?.currency || '$'}${existingLead?.expectedDealValue?.toLocaleString() || '0'}`,
        amount: existingLead?.expectedDealValue,
        currency: existingLead?.currency,
      });
    }
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
    emitBusinessEvent.appointmentCreated(user.uid, {
      id: apptId,
      title: data.title,
      contactName: data.contactName,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      expectedDealValue: data.expectedDealValue,
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
    const now = new Date().toISOString();
    const newSeq: Sequence = {
      id,
      userId: user.uid,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    setSequences((prev) => [newSeq, ...prev.filter((s) => s.id !== id)]);
    await loadSequencesAndEnrollments();
    await trackEvent('sequence_created', user.uid, { name: data.name });
    return id;
  };

  const handleEditSequence = async (
    sequenceId: string,
    data: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    setSequences((prev) =>
      prev.map((s) => (s.id === sequenceId ? { ...s, ...data, updatedAt: new Date().toISOString() } : s))
    );
    await saveSequence(user.uid, data, sequenceId);
    await loadSequencesAndEnrollments();
  };

  const handleRemoveSequence = async (sequenceId: string) => {
    if (!user) throw new Error('User must be logged in.');
    setSequences((prev) => prev.filter((s) => s.id !== sequenceId));
    await deleteSequenceFromDb(user.uid, sequenceId);
    await loadSequencesAndEnrollments();
  };

  const handleEnrollContact = async (
    data: Omit<SequenceEnrollment, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'history'>
  ) => {
    if (!user) throw new Error('User must be logged in.');
    const id = await createSequenceEnrollment(user.uid, data);
    const now = new Date().toISOString();
    const newEnrollment: SequenceEnrollment = {
      id,
      userId: user.uid,
      ...data,
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    setSequenceEnrollments((prev) => [newEnrollment, ...prev.filter((e) => e.id !== id)]);
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

    // Optimistically advance enrollment in React state
    if (enrollment) {
      const nextStepNum = enrollment.currentStepNumber + 1;
      const isCompleted = nextStepNum > enrollment.totalSteps;
      const nextDueDate = new Date();
      if (nextDelayDays && nextDelayDays > 0) {
        nextDueDate.setDate(nextDueDate.getDate() + nextDelayDays);
      }
      setSequenceEnrollments((prev) =>
        prev.map((item) => {
          if (item.id === enrollmentId) {
            return {
              ...item,
              currentStepNumber: nextStepNum,
              status: isCompleted ? 'completed' : item.status,
              nextStepDueAt: isCompleted ? '' : nextDueDate.toISOString().split('T')[0],
              nextStepChannel: nextChannel || item.nextStepChannel,
              nextStepTitle: nextTitle || item.nextStepTitle,
              history: [...(item.history || []), history],
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );
    }

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
    setSequenceEnrollments((prev) =>
      prev.map((e) => (e.id === enrollmentId ? { ...e, status, updatedAt: new Date().toISOString() } : e))
    );
    await updateSequenceEnrollmentStatus(user.uid, enrollmentId, status);
    await loadSequencesAndEnrollments();
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!user) throw new Error('User must be logged in.');
    setSequenceEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
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
        bulkDeleteFollowUps: handleBulkDeleteFollowUps,
        bulkMarkAsPaid: handleBulkMarkAsPaid,
        bulkUpdateStatus: handleBulkUpdateStatus,
        bulkDeleteContacts: handleBulkDeleteContacts,
        handleCustomerResponded,
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
        aiInitialTemplate,
        openAiModal,
        closeAiModal,
        aiDraft,
        updateAiDraft,
        resetAiDraft,
        generateAiFollowUpMessage,
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
