import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type {
  Contact,
  FollowUp,
  FollowUpPriority,
  FollowUpChannel,
  GeneratedMessage,
  UserProfile,
  Sequence,
  SequenceEnrollment,
  SequenceEnrollmentStepHistory,
  SequenceEnrollmentStatus,
  EmailTemplate,
  Lead,
  Appointment,
} from '../types';

// Helper to get formatted today string (YYYY-MM-DD)
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Consistent ISO 8601 UTC timestamp formatter for Firebase appointment scheduling
export function formatAppointmentTimestamp(dateString: string, timeString: string = '09:00'): string {
  if (!dateString) return new Date().toISOString();
  try {
    // If dateString is already a full ISO string
    if (dateString.includes('T') && dateString.endsWith('Z')) {
      return dateString;
    }
    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = (timeString || '09:00').split(':').map(Number);
    const localDate = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
    return localDate.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

// Parse appointment timestamp into clean display pieces
export function parseAppointmentTimestamp(timestamp: string): {
  date: string;
  time: string;
  timeDisplay: string;
  fullDisplay: string;
  isUpcoming: boolean;
  isToday: boolean;
} {
  if (!timestamp) {
    const today = getTodayString();
    return {
      date: today,
      time: '09:00',
      timeDisplay: '9:00 AM',
      fullDisplay: 'Not scheduled',
      isUpcoming: false,
      isToday: false,
    };
  }

  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      return {
        date: getTodayString(),
        time: '09:00',
        timeDisplay: '9:00 AM',
        fullDisplay: timestamp,
        isUpcoming: false,
        isToday: false,
      };
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const timeDisplay = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const fullDisplay = d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const now = new Date();
    const isUpcoming = d.getTime() >= now.getTime();
    const isToday = dateStr === getTodayString();

    return {
      date: dateStr,
      time: timeStr,
      timeDisplay,
      fullDisplay,
      isUpcoming,
      isToday,
    };
  } catch (e) {
    return {
      date: getTodayString(),
      time: '09:00',
      timeDisplay: '9:00 AM',
      fullDisplay: timestamp,
      isUpcoming: false,
      isToday: false,
    };
  }
}

// Calculate Days Difference (dateString - today)
export function getDaysDiffFromToday(dateString: string): number {
  if (!dateString) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Automatically suggest follow-up priority
export function calculateAutoPriority(data: {
  dueDate: string;
  amount?: number;
  type: string;
  lastContactedAt?: string;
}): FollowUpPriority {
  const daysDiff = getDaysDiffFromToday(data.dueDate);
  const amount = Number(data.amount || 0);

  // Overdue checks
  if (daysDiff < -5) {
    return 'urgent';
  }
  if (daysDiff < 0) {
    if (data.type === 'invoice' || amount >= 1000) {
      return 'urgent';
    }
    return 'high';
  }

  // High monetary value check
  if (amount >= 2500) {
    return daysDiff <= 3 ? 'urgent' : 'high';
  }
  if (amount >= 1000) {
    return daysDiff <= 2 ? 'high' : 'medium';
  }

  // Due today
  if (daysDiff === 0) {
    if (data.type === 'invoice' || data.type === 'proposal') {
      return 'high';
    }
    return 'medium';
  }

  // Upcoming within 2 days
  if (daysDiff <= 2) {
    return 'medium';
  }

  return 'low';
}

// --- USER PROFILE ---
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const docRef = doc(db, 'users', userId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return snapshot.data() as UserProfile;
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  const docRef = doc(db, 'users', profile.uid);
  await setDoc(docRef, {
    ...profile,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

// --- CONTACTS ---
export function subscribeToContacts(
  userId: string,
  onData: (contacts: Contact[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const contactsRef = collection(db, `users/${userId}/contacts`);
  const q = query(contactsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const contacts: Contact[] = [];
      snapshot.forEach((d) => {
        contacts.push({ id: d.id, ...d.data() } as Contact);
      });
      onData(contacts);
    },
    (err) => {
      console.error('Contacts subscription error:', err);
      onError(err);
    }
  );
}

export async function createContact(userId: string, contactData: Omit<Contact, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const contactsRef = collection(db, `users/${userId}/contacts`);
  const newDoc = doc(contactsRef);
  const now = new Date().toISOString();

  const newContact: Contact = {
    id: newDoc.id,
    userId,
    ...contactData,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(newDoc, newContact);
  return newDoc.id;
}

export async function updateContact(userId: string, contactId: string, data: Partial<Contact>): Promise<void> {
  const docRef = doc(db, `users/${userId}/contacts`, contactId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteContact(userId: string, contactId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/contacts`, contactId);
  await deleteDoc(docRef);
}

// --- FOLLOW-UPS ---
export function subscribeToFollowUps(
  userId: string,
  onData: (followUps: FollowUp[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const followUpsRef = collection(db, `users/${userId}/followUps`);
  const q = query(followUpsRef, orderBy('dueDate', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const followUps: FollowUp[] = [];
      snapshot.forEach((d) => {
        followUps.push({ id: d.id, ...d.data() } as FollowUp);
      });
      onData(followUps);
    },
    (err) => {
      console.error('FollowUps subscription error:', err);
      onError(err);
    }
  );
}

export async function createFollowUp(
  userId: string,
  data: Omit<FollowUp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const followUpsRef = collection(db, `users/${userId}/followUps`);
  const newDoc = doc(followUpsRef);
  const now = new Date().toISOString();

  const newFollowUp: FollowUp = {
    id: newDoc.id,
    userId,
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(newDoc, newFollowUp);
  return newDoc.id;
}

export async function updateFollowUp(userId: string, followUpId: string, data: Partial<FollowUp>): Promise<void> {
  const docRef = doc(db, `users/${userId}/followUps`, followUpId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function completeFollowUp(userId: string, followUpId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/followUps`, followUpId);
  await updateDoc(docRef, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function snoozeFollowUp(
  userId: string,
  followUpId: string,
  snoozeOption: number | string // e.g. 1 (tomorrow), 3, 7, or 'YYYY-MM-DD'
): Promise<string> {
  const docRef = doc(db, `users/${userId}/followUps`, followUpId);
  let dueDateStr = '';

  if (typeof snoozeOption === 'string' && snoozeOption.includes('-')) {
    dueDateStr = snoozeOption;
  } else {
    const days = typeof snoozeOption === 'number' ? snoozeOption : parseInt(snoozeOption, 10) || 1;
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + days);
    const year = newDueDate.getFullYear();
    const month = String(newDueDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDueDate.getDate()).padStart(2, '0');
    dueDateStr = `${year}-${month}-${day}`;
  }

  await updateDoc(docRef, {
    status: 'snoozed',
    dueDate: dueDateStr,
    snoozedUntil: dueDateStr,
    updatedAt: new Date().toISOString(),
  });

  return dueDateStr;
}

export async function deleteFollowUp(userId: string, followUpId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/followUps`, followUpId);
  await deleteDoc(docRef);
}

// --- MESSAGES LOG ---
export async function logGeneratedMessage(
  userId: string,
  data: Omit<GeneratedMessage, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const messagesRef = collection(db, `users/${userId}/messages`);
  const newDoc = doc(messagesRef);
  const now = new Date().toISOString();

  const newMsg: GeneratedMessage = {
    id: newDoc.id,
    userId,
    ...data,
    createdAt: now,
  };

  await setDoc(newDoc, newMsg);
  return newDoc.id;
}

// --- DEMO DATA POLICY: DISABLED IN PRODUCTION ---
export async function seedDemoData(_userId: string): Promise<void> {
  // Production application policy: Never inject fake or mock customer/financial records.
  console.info('[DataPolicy] Automatic fake/demo data seeding is permanently disabled in production.');
}

// Clear all user workspace data (contacts, followups, sequences enrollments, leads, appointments, timeline, messages)
export async function clearAllUserData(userId: string): Promise<void> {
  const contactsRef = collection(db, `users/${userId}/contacts`);
  const followUpsRef = collection(db, `users/${userId}/followUps`);
  const sequencesRef = collection(db, `users/${userId}/sequences`);
  const enrollmentsRef = collection(db, `users/${userId}/sequenceEnrollments`);
  const leadsRef = collection(db, `users/${userId}/leads`);
  const apptsRef = collection(db, `users/${userId}/appointments`);
  const timelineRef = collection(db, `users/${userId}/timeline`);
  const messagesRef = collection(db, `users/${userId}/messages`);

  const [
    contactsSnap,
    followUpsSnap,
    seqSnap,
    enrollSnap,
    leadsSnap,
    apptsSnap,
    timelineSnap,
    messagesSnap,
  ] = await Promise.all([
    getDocs(contactsRef),
    getDocs(followUpsRef),
    getDocs(sequencesRef),
    getDocs(enrollmentsRef),
    getDocs(leadsRef),
    getDocs(apptsRef),
    getDocs(timelineRef),
    getDocs(messagesRef),
  ]);

  const deletePromises = [
    ...contactsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...followUpsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...seqSnap.docs.map((d) => deleteDoc(d.ref)),
    ...enrollSnap.docs.map((d) => deleteDoc(d.ref)),
    ...leadsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...apptsSnap.docs.map((d) => deleteDoc(d.ref)),
    ...timelineSnap.docs.map((d) => deleteDoc(d.ref)),
    ...messagesSnap.docs.map((d) => deleteDoc(d.ref)),
  ];

  await Promise.all(deletePromises);
}

// ==========================================
// SEQUENCES OPERATIONS
// ==========================================

export interface CanonicalSequenceDefinition extends Omit<Sequence, 'userId' | 'createdAt' | 'updatedAt'> {
  canonicalKey: string;
}

export const DEFAULT_PREBUILT_SEQUENCES: CanonicalSequenceDefinition[] = [
  {
    id: 'seq-high-value-proposal-closer',
    canonicalKey: 'proposal_closer',
    name: 'High-Value Proposal Closer',
    description: 'Day 1, 3, 7, 14 touchpoint cadence to systematically address stakeholder questions and close proposals.',
    category: 'proposal',
    triggerType: 'lead_stage',
    triggerValue: 'proposal',
    targetChannel: 'auto',
    isActive: true,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        delayDays: 1,
        title: 'Day 1: Confirm Receipt & Initial Review',
        channel: 'whatsapp',
        tone: 'friendly',
        templateSubject: 'Following up on {title} proposal',
        templateBody: 'Hi {contact_name}! Just wanted to make sure you received the {title} proposal I sent over ({amount}). Did you or the team have any quick questions on the scope or timeline?',
        variations: [
          {
            id: 'v1',
            tone: 'friendly',
            label: 'Friendly WhatsApp',
            content: 'Hi {contact_name}! Just wanted to make sure you received the {title} proposal I sent over ({amount}). Did you or the team have any quick questions on the scope or timeline?',
          },
          {
            id: 'v2',
            tone: 'professional',
            label: 'Professional Email',
            subject: 'Reviewing proposal: {title}',
            content: 'Hi {contact_name},\n\nI hope you are having a productive week. Following up to confirm receipt of the proposal for {title} ({amount}). Please let me know if you would like to arrange a brief call to address any questions.\n\nBest regards,\n[Your Name]',
          },
        ],
      },
      {
        id: 'step-2',
        stepNumber: 2,
        delayDays: 2,
        title: 'Day 3: Offer Walkthrough & Answer Team Questions',
        channel: 'email',
        tone: 'professional',
        templateSubject: 'Quick walkthrough on {title} proposal',
        templateBody: 'Hi {contact_name},\n\nI know schedules get hectic! Just circling back on the {title} proposal ({amount}).\n\nWould it be helpful to jump on a 10-minute sync this week to walk through the deliverables together and discuss start dates?\n\nBest regards,\n[Your Name]',
        variations: [
          {
            id: 'v1',
            tone: 'professional',
            label: 'Consultative Email',
            subject: 'Quick question regarding {title} proposal',
            content: 'Hi {contact_name},\n\nI know schedules get hectic! Just circling back on the {title} proposal ({amount}).\n\nWould it be helpful to jump on a 10-minute sync this week to walk through the deliverables together and discuss start dates?\n\nBest regards,\n[Your Name]',
          },
        ],
      },
      {
        id: 'step-3',
        stepNumber: 3,
        delayDays: 4,
        title: 'Day 7: Value Reassurance & Case Study',
        channel: 'email',
        tone: 'warm',
        templateSubject: 'Relevant results for {company} regarding {title}',
        templateBody: 'Hi {contact_name},\n\nThinking about your project goals for {title}! Here is a quick breakdown of how we recently helped a client in your industry achieve similar objectives.\n\nHappy to share any additional details or references if helpful.\n\nBest,\n[Your Name]',
      },
      {
        id: 'step-4',
        stepNumber: 4,
        delayDays: 7,
        title: 'Day 14: Project Window Reservation / Final Check',
        channel: 'email',
        tone: 'urgent',
        templateSubject: 'Reserving your project schedule for {title}',
        templateBody: 'Hi {contact_name},\n\nI am currently locking in our project calendar for the upcoming month. I want to make sure I reserve your preferred start window for {title}.\n\nPlease let me know by {due_date} if we are good to proceed with the agreement so I can hold your team resources.\n\nBest,\n[Your Name]',
      },
    ],
  },
  {
    id: 'seq-unpaid-invoice-recovery',
    canonicalKey: 'invoice_recovery',
    name: 'Unpaid Invoice Recovery Sequence',
    description: 'Day 1, 3, 7, 14 firm but professional escalation cadence to collect late payments without damaging client goodwill.',
    category: 'invoice',
    triggerType: 'lead_stage',
    triggerValue: 'invoice',
    targetChannel: 'email',
    isActive: true,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        delayDays: 1,
        title: 'Day 1: Courteous Due Date Notice',
        channel: 'email',
        tone: 'friendly',
        templateSubject: 'Friendly reminder: Invoice {title} ({amount})',
        templateBody: "Hi {contact_name},\n\nHope you're having a great week! This is a quick note to let you know that invoice {title} for {amount} was due on {due_date}.\n\nPlease let me know if you need another copy of the invoice or our banking details.\n\nThank you!\n[Your Name]",
      },
      {
        id: 'step-2',
        stepNumber: 2,
        delayDays: 2,
        title: 'Day 3: Accounts Department Check-In',
        channel: 'whatsapp',
        tone: 'firm',
        templateSubject: 'Status update: Invoice {title}',
        templateBody: 'Hi {contact_name}, checking in on invoice {title} for {amount}. Has this been approved by your accounts team for processing? Let me know if you need any additional PO info.',
      },
      {
        id: 'step-3',
        stepNumber: 3,
        delayDays: 4,
        title: 'Day 7: Urgent Outstanding Balance Notice',
        channel: 'email',
        tone: 'urgent',
        templateSubject: 'URGENT: Outstanding payment for Invoice {title}',
        templateBody: 'Hi {contact_name},\n\nWe have not yet received payment for invoice {title} ({amount}), which is now past due. Please process this invoice today or provide an estimated payment date so we can keep your account in good standing.\n\nBest regards,\n[Your Name]',
      },
      {
        id: 'step-4',
        stepNumber: 4,
        delayDays: 7,
        title: 'Day 14: Service Pause Warning / Final Notice',
        channel: 'email',
        tone: 'firm',
        templateSubject: 'FINAL NOTICE: Account status for {company}',
        templateBody: 'Hi {contact_name},\n\nDespite previous reminders, invoice {title} for {amount} remains unpaid. Per our payment terms, active deliverables and support will be temporarily paused until the outstanding balance is settled.\n\nPlease reply with wire/payment confirmation.\n\nSincerely,\n[Your Name]',
      },
    ],
  },
  {
    id: 'seq-new-inbound-lead-nurture',
    canonicalKey: 'lead_nurture',
    name: 'New Inbound Lead Nurture',
    description: 'Day 1, 3, 7, 14 re-engagement and qualification cadence for new inbound inquiries.',
    category: 'lead',
    triggerType: 'lead_stage',
    triggerValue: 'lead',
    targetChannel: 'whatsapp',
    isActive: true,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        delayDays: 1,
        title: 'Day 1: Friendly Check-in & Priority Review',
        channel: 'whatsapp',
        tone: 'warm',
        templateSubject: 'Checking in regarding {title}',
        templateBody: 'Hi {contact_name}! Hope things are going well at {company}. Just circling back on {title}—is this still on your radar for this quarter?',
      },
      {
        id: 'step-2',
        stepNumber: 2,
        delayDays: 2,
        title: 'Day 3: Relevant Resource / Industry Insight',
        channel: 'email',
        tone: 'friendly',
        templateSubject: 'Idea for {company} regarding {title}',
        templateBody: 'Hi {contact_name},\n\nSaw this recent development in your space and thought of our earlier discussion about {title}. Would love to share how teams like yours are handling this now.\n\nBest,\n[Your Name]',
      },
      {
        id: 'step-3',
        stepNumber: 3,
        delayDays: 4,
        title: 'Day 7: Low-Friction 15-Minute Sync Offer',
        channel: 'whatsapp',
        tone: 'casual',
        templateSubject: 'Quick 15-min sync?',
        templateBody: 'Hi {contact_name}, if timing is better now, would you be up for a quick 15-minute catchup this week to see if it makes sense to partner on {title}?',
      },
      {
        id: 'step-4',
        stepNumber: 4,
        delayDays: 7,
        title: 'Day 14: Permission to Close File / Final Soft Outreach',
        channel: 'email',
        tone: 'casual',
        templateSubject: 'Closing file on {title} for now?',
        templateBody: "Hi {contact_name},\n\nSince I haven't heard back, I'll assume priorities have shifted and will pause following up for now. If you ever want to revisit {title}, feel free to reach out anytime!\n\nAll the best,\n[Your Name]",
      },
    ],
  },
  {
    id: 'seq-post-meeting-follow-through',
    canonicalKey: 'post_meeting',
    name: 'Post-Meeting Follow-Through',
    description: 'Ensures decisions made in meetings convert into signed contracts and deliverables without stall.',
    category: 'appointment',
    triggerType: 'tag',
    triggerValue: 'Appointment',
    targetChannel: 'email',
    isActive: true,
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        delayDays: 1,
        title: 'Meeting Recap & Action Item Summary',
        channel: 'email',
        tone: 'professional',
        templateSubject: 'Recap & Next Steps: Our meeting regarding {title}',
        templateBody: 'Hi {contact_name},\n\nGreat speaking with you yesterday! As discussed, here is a quick summary of our agreed action items and deliverables for {title}.\n\nPlease let me know if everything aligns with your expectations.\n\nBest regards,\n[Your Name]',
      },
      {
        id: 'step-2',
        stepNumber: 2,
        delayDays: 3,
        title: 'Check on Internal Approvals',
        channel: 'whatsapp',
        tone: 'friendly',
        templateSubject: 'Quick check on {title}',
        templateBody: 'Hi {contact_name}, just wanted to check if you had a chance to review the action items from our meeting? Happy to hop on a quick call if needed!',
      },
    ],
  },
];

// Deduplicate sequences in Firestore and ensure each canonical template exists only once
export async function syncAndDeduplicateSequences(userId: string): Promise<Sequence[]> {
  if (!userId || userId === 'guest' || userId === 'demo-user') {
    const now = new Date().toISOString();
    return DEFAULT_PREBUILT_SEQUENCES.map((s) => ({
      ...s,
      userId: 'demo-user',
      enrolledCount: 0,
      completedCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
  }

  const colRef = collection(db, `users/${userId}/sequences`);
  const snapshot = await getDocs(colRef);
  const now = new Date().toISOString();

  // If collection is completely empty, seed all 4 canonical sequences with deterministic IDs
  if (snapshot.empty) {
    const seededList: Sequence[] = [];
    for (const defSeq of DEFAULT_PREBUILT_SEQUENCES) {
      const docRef = doc(db, `users/${userId}/sequences/${defSeq.id}`);
      const newSeq: Sequence = {
        id: defSeq.id,
        userId,
        name: defSeq.name,
        description: defSeq.description,
        category: defSeq.category,
        triggerType: defSeq.triggerType,
        triggerValue: defSeq.triggerValue,
        targetChannel: defSeq.targetChannel,
        isActive: defSeq.isActive,
        steps: defSeq.steps,
        enrolledCount: 0,
        completedCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newSeq);
      seededList.push(newSeq);
    }
    return seededList;
  }

  const existingDocs = snapshot.docs.map((d) => ({
    id: d.id,
    ref: d.ref,
    data: d.data() as Sequence,
  }));

  const keptSequences: Sequence[] = [];
  const deleteDocRefs: any[] = [];
  const idMigrationMap: Record<string, string> = {};

  const matchCanonicalKey = (id: string, name: string, cat?: string): string | null => {
    if (id === 'seq-unpaid-invoice-recovery' || id === 'seq-invoice-recovery') return 'seq-unpaid-invoice-recovery';
    if (id === 'seq-post-meeting-follow-through' || id === 'seq-post-meeting') return 'seq-post-meeting-follow-through';
    if (id === 'seq-new-inbound-lead-nurture' || id === 'seq-cold-lead-revival' || id === 'seq-lead-nurture') return 'seq-new-inbound-lead-nurture';
    if (id === 'seq-high-value-proposal-closer' || id === 'seq-proposal-closer') return 'seq-high-value-proposal-closer';

    const n = (name || '').toLowerCase().trim();
    if (n.includes('unpaid') || n.includes('invoice') || cat === 'invoice') return 'seq-unpaid-invoice-recovery';
    if (n.includes('post-meeting') || n.includes('post meeting') || (n.includes('meeting') && cat === 'appointment')) return 'seq-post-meeting-follow-through';
    if (n.includes('inbound') || n.includes('lead nurture') || n.includes('cold lead') || (n.includes('lead') && cat === 'lead')) return 'seq-new-inbound-lead-nurture';
    if (n.includes('proposal') || n.includes('closer') || cat === 'proposal') return 'seq-high-value-proposal-closer';

    return null;
  };

  const canonicalGroups: Record<string, { id: string; ref: any; data: Sequence }[]> = {
    'seq-high-value-proposal-closer': [],
    'seq-unpaid-invoice-recovery': [],
    'seq-new-inbound-lead-nurture': [],
    'seq-post-meeting-follow-through': [],
  };
  const customGroups: Record<string, { id: string; ref: any; data: Sequence }[]> = {};

  for (const item of existingDocs) {
    const matchedKey = matchCanonicalKey(item.id, item.data.name, item.data.category);
    if (matchedKey && canonicalGroups[matchedKey]) {
      canonicalGroups[matchedKey].push(item);
    } else {
      const customKey = item.data.name?.toLowerCase().trim() || item.id;
      if (!customGroups[customKey]) customGroups[customKey] = [];
      customGroups[customKey].push(item);
    }
  }

  // Deduplicate and synchronize the 4 canonical sequences
  for (const defSeq of DEFAULT_PREBUILT_SEQUENCES) {
    const group = canonicalGroups[defSeq.id] || [];

    if (group.length === 0) {
      // Missing canonical sequence -> seed with stable deterministic ID
      const targetRef = doc(db, `users/${userId}/sequences/${defSeq.id}`);
      const newSeq: Sequence = {
        id: defSeq.id,
        userId,
        name: defSeq.name,
        description: defSeq.description,
        category: defSeq.category,
        triggerType: defSeq.triggerType,
        triggerValue: defSeq.triggerValue,
        targetChannel: defSeq.targetChannel,
        isActive: defSeq.isActive,
        steps: defSeq.steps,
        enrolledCount: 0,
        completedCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(targetRef, newSeq);
      keptSequences.push(newSeq);
    } else {
      // Pick the single keeper: prefer document with deterministic ID, or one with enrollments, or first
      let keeper =
        group.find((g) => g.id === defSeq.id) ||
        group.find((g) => (g.data.enrolledCount || 0) > 0) ||
        group[0];

      // Update keeper's official title and category if it had legacy naming
      const keeperData: Sequence = {
        ...keeper.data,
        id: keeper.id,
        name: defSeq.name, // Ensure exact official naming
        category: defSeq.category,
      };

      // If keeper is not using the deterministic id and no deterministic doc existed, update in memory
      keptSequences.push(keeperData);

      // Delete all duplicates from Firestore database
      for (const item of group) {
        if (item.id !== keeper.id) {
          deleteDocRefs.push(item.ref);
          idMigrationMap[item.id] = keeper.id;
        }
      }
    }
  }

  // Deduplicate custom sequences if any were accidentally duplicated
  for (const [_, group] of Object.entries(customGroups)) {
    if (group.length === 1) {
      keptSequences.push({ id: group[0].id, ...group[0].data });
    } else {
      const keeper = group.find((g) => (g.data.enrolledCount || 0) > 0) || group[0];
      keptSequences.push({ id: keeper.id, ...keeper.data });
      for (const item of group) {
        if (item.id !== keeper.id) {
          deleteDocRefs.push(item.ref);
          idMigrationMap[item.id] = keeper.id;
        }
      }
    }
  }

  // Delete all duplicate documents from Firestore
  if (deleteDocRefs.length > 0) {
    console.log(`[DeduplicateSequences] Deleting ${deleteDocRefs.length} duplicate sequence documents from Firestore...`);
    await Promise.all(deleteDocRefs.map((r) => deleteDoc(r)));

    // Re-link enrollments from deleted sequence IDs to keeper IDs
    try {
      const enrollCol = collection(db, `users/${userId}/sequenceEnrollments`);
      const enrollSnap = await getDocs(enrollCol);
      const updates: Promise<any>[] = [];
      for (const enrollDoc of enrollSnap.docs) {
        const enrollData = enrollDoc.data() as SequenceEnrollment;
        if (enrollData.sequenceId && idMigrationMap[enrollData.sequenceId]) {
          const targetId = idMigrationMap[enrollData.sequenceId];
          const matched = keptSequences.find((s) => s.id === targetId);
          updates.push(
            updateDoc(enrollDoc.ref, {
              sequenceId: targetId,
              sequenceName: matched?.name || enrollData.sequenceName,
              updatedAt: now,
            })
          );
        }
      }
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (migErr) {
      console.warn('[DeduplicateSequences] Enrollment ID migration error:', migErr);
    }
  }

  return keptSequences;
}

export async function getSequences(userId: string): Promise<Sequence[]> {
  return await syncAndDeduplicateSequences(userId);
}

export async function saveSequence(
  userId: string,
  sequenceData: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  id?: string
): Promise<string> {
  const now = new Date().toISOString();
  if (id) {
    const docRef = doc(db, `users/${userId}/sequences/${id}`);
    await updateDoc(docRef, {
      ...sequenceData,
      updatedAt: now,
    });
    return id;
  } else {
    const colRef = collection(db, `users/${userId}/sequences`);
    const newDoc = await addDoc(colRef, {
      ...sequenceData,
      userId,
      enrolledCount: 0,
      completedCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return newDoc.id;
  }
}

export async function deleteSequence(userId: string, sequenceId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/sequences/${sequenceId}`);
  await deleteDoc(docRef);
}

export async function seedDefaultSequences(userId: string): Promise<void> {
  await syncAndDeduplicateSequences(userId);
}

// ==========================================
// SEQUENCE ENROLLMENTS OPERATIONS
// ==========================================

export async function getSequenceEnrollments(userId: string): Promise<SequenceEnrollment[]> {
  const colRef = collection(db, `users/${userId}/sequenceEnrollments`);
  const q = query(colRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SequenceEnrollment));
}

export async function createSequenceEnrollment(
  userId: string,
  enrollment: Omit<SequenceEnrollment, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'history'>
): Promise<string> {
  const now = new Date().toISOString();
  const colRef = collection(db, `users/${userId}/sequenceEnrollments`);
  const newDoc = await addDoc(colRef, {
    ...enrollment,
    userId,
    history: [],
    createdAt: now,
    updatedAt: now,
  });

  // Increment enrolledCount on sequence
  try {
    const seqRef = doc(db, `users/${userId}/sequences/${enrollment.sequenceId}`);
    const seqSnap = await getDoc(seqRef);
    if (seqSnap.exists()) {
      const currentCount = seqSnap.data()?.enrolledCount || 0;
      await updateDoc(seqRef, { enrolledCount: currentCount + 1 });
    }
  } catch (err) {
    console.error('Failed to update sequence count:', err);
  }

  return newDoc.id;
}

export async function advanceSequenceEnrollment(
  userId: string,
  enrollmentId: string,
  stepHistory: SequenceEnrollmentStepHistory,
  nextStepDays?: number,
  nextStepChannel?: FollowUpChannel,
  nextStepTitle?: string
): Promise<void> {
  const now = new Date().toISOString();
  const docRef = doc(db, `users/${userId}/sequenceEnrollments/${enrollmentId}`);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return;
  const data = snap.data() as SequenceEnrollment;

  const updatedHistory = [...(data.history || []), stepHistory];
  const nextStepNum = data.currentStepNumber + 1;
  const isCompleted = nextStepNum > data.totalSteps;

  const nextDueDate = new Date();
  if (nextStepDays && nextStepDays > 0) {
    nextDueDate.setDate(nextDueDate.getDate() + nextStepDays);
  }
  const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

  await updateDoc(docRef, {
    currentStepNumber: nextStepNum,
    status: isCompleted ? 'completed' : 'active',
    nextStepDueAt: isCompleted ? '' : nextDueDateStr,
    nextStepChannel: nextStepChannel || data.nextStepChannel,
    nextStepTitle: nextStepTitle || data.nextStepTitle,
    history: updatedHistory,
    updatedAt: now,
  });

  if (isCompleted) {
    // Increment completed count on sequence
    try {
      const seqRef = doc(db, `users/${userId}/sequences/${data.sequenceId}`);
      const seqSnap = await getDoc(seqRef);
      if (seqSnap.exists()) {
        const currentCompleted = seqSnap.data()?.completedCount || 0;
        await updateDoc(seqRef, { completedCount: currentCompleted + 1 });
      }
    } catch (err) {
      console.error('Failed to update completed count:', err);
    }
  }
}

export async function updateSequenceEnrollmentStatus(
  userId: string,
  enrollmentId: string,
  status: SequenceEnrollmentStatus
): Promise<void> {
  const now = new Date().toISOString();
  const docRef = doc(db, `users/${userId}/sequenceEnrollments/${enrollmentId}`);
  await updateDoc(docRef, {
    status,
    updatedAt: now,
  });
}

export async function deleteSequenceEnrollment(userId: string, enrollmentId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/sequenceEnrollments/${enrollmentId}`);
  await deleteDoc(docRef);
}

// --- SUBSCRIPTIONS (PAYSTACK) ---
export function subscribeToUserSubscription(
  userId: string,
  onData: (subscription: any | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const docRef = doc(db, `users/${userId}/subscription/current`);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data());
      } else {
        onData(null);
      }
    },
    (err) => {
      console.warn('Subscription listener warning:', err);
      onError(err);
    }
  );
}

export async function fetchBillingConfig(): Promise<{
  currency: string;
  proPrice: number;
  isConfigured: boolean;
  paystackPublicKey?: string;
  proPlanCode?: string;
}> {
  try {
    const res = await fetch('/api/paystack/config');
    if (res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.warn('Non-JSON response from /api/paystack/config:', parseErr);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch billing config, using defaults:', err);
  }
  return {
    currency: 'USD',
    proPrice: 9,
    isConfigured: false,
    paystackPublicKey: '',
  };
}

export async function initializePaystackCheckout(params: {
  userId: string;
  email: string;
  callbackUrl?: string;
}): Promise<{
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}> {
  const res = await fetch('/api/paystack/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Server returned an unexpected response format. Please try again.');
  }

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to initialize Paystack checkout.');
  }

  return {
    authorizationUrl: data.authorizationUrl,
    accessCode: data.accessCode,
    reference: data.reference,
  };
}

export async function verifyPaystackPayment(params: {
  userId: string;
  reference: string;
}): Promise<{
  success: boolean;
  status: string;
  subscription: any;
}> {
  const res = await fetch('/api/paystack/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Server returned an unexpected response format. Please try again.');
  }

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Payment verification failed.');
  }

  return data;
}

// --- TIMELINE EVENTS ---
export async function logTimelineEvent(
  userId: string,
  event: {
    contactId: string;
    followUpId?: string;
    type: 'created' | 'outreach_sent' | 'ai_generated' | 'completed' | 'snoozed' | 'sequence_step' | 'note_added';
    title: string;
    description?: string;
    channel?: FollowUpChannel;
    amount?: number;
    currency?: string;
  }
): Promise<string> {
  try {
    const timelineRef = collection(db, `users/${userId}/timeline`);
    const newDoc = doc(timelineRef);
    const now = new Date().toISOString();
    await setDoc(newDoc, {
      id: newDoc.id,
      ...event,
      timestamp: now,
      createdAt: now,
    });
    return newDoc.id;
  } catch (err) {
    console.warn('Could not log timeline event:', err);
    return '';
  }
}

export function subscribeToContactTimeline(
  userId: string,
  contactId: string,
  onData: (events: any[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const timelineRef = collection(db, `users/${userId}/timeline`);
  const q = query(timelineRef, orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const allEvents: any[] = [];
      snap.forEach((d) => {
        const ev = d.data();
        if (ev.contactId === contactId) {
          allEvents.push({ id: d.id, ...ev });
        }
      });
      onData(allEvents);
    },
    (err) => {
      console.warn('Timeline subscription warning:', err);
      onError(err);
    }
  );
}

// --- TEMPLATES LIBRARY ---

export interface CanonicalTemplateDefinition extends Omit<EmailTemplate, 'userId' | 'createdAt' | 'updatedAt'> {
  id: string;
}

export const DEFAULT_SALES_TEMPLATES: CanonicalTemplateDefinition[] = [
  {
    id: 'tpl-post-meeting-proposal',
    title: 'Post-Meeting Proposal Follow-Up',
    description: 'Sent 24-48 hours after pitching to recap key points and request next steps.',
    stage: 'proposal_sent',
    category: 'Proposals',
    channel: 'email',
    subject: 'Proposal & Next Steps for {{company}}',
    body: `Hi {{contact_name}},

It was great speaking with you earlier! As discussed, I've put together our proposal outlining how we will help {{company}} achieve your goals for {{project_name}}.

Key highlights:
• Scope & Deliverables: Customized to your timeline
• Proposed Investment: {{amount}}
• Target Kickoff Date: Within 5 business days of confirmation

You can review the full details in the attached document. Do you have 10 minutes this Thursday or Friday to review any questions and lock in next steps?

Best regards,
{{my_name}}`,
    variables: ['{{contact_name}}', '{{company}}', '{{project_name}}', '{{amount}}', '{{my_name}}'],
    isDefault: true,
    timesUsed: 14,
  },
  {
    id: 'tpl-friendly-overdue-invoice',
    title: 'Friendly Overdue Invoice Reminder',
    description: 'Gentle, professional reminder sent when payment is 3-7 days overdue.',
    stage: 'invoice_overdue',
    category: 'Invoicing',
    channel: 'email',
    subject: 'Friendly Reminder: Invoice #{{invoice_number}} for {{amount}}',
    body: `Hi {{contact_name}},

I hope your week is off to a great start!

This is a quick friendly reminder regarding invoice #{{invoice_number}} for {{amount}}, which was due on {{due_date}}.

Could you please check with your accounts payable team to confirm if payment has been scheduled? If you need me to re-send the invoice PDF or bank details, just let me know.

Thank you so much!
{{my_name}}`,
    variables: ['{{contact_name}}', '{{invoice_number}}', '{{amount}}', '{{due_date}}', '{{my_name}}'],
    isDefault: true,
    timesUsed: 28,
  },
  {
    id: 'tpl-nine-word-reengagement',
    title: '9-Word Re-engagement Script',
    description: 'Ultra-high response rate script for deals or leads that went silent.',
    stage: 're_engagement',
    category: 'Sales',
    channel: 'email',
    subject: '{{project_name}} for {{company}}',
    body: `Hi {{contact_name}},

Are you still looking to move forward with {{service}} this quarter?

Best,
{{my_name}}`,
    variables: ['{{contact_name}}', '{{project_name}}', '{{company}}', '{{service}}', '{{my_name}}'],
    isDefault: true,
    timesUsed: 42,
  },
  {
    id: 'tpl-discovery-call-value-add',
    title: 'Discovery Call Value-Add Follow-Up',
    description: 'Establish authority and momentum immediately after lead qualification.',
    stage: 'lead_qualification',
    category: 'Leads',
    channel: 'email',
    subject: 'Quick thoughts following our chat + 2 resources for {{company}}',
    body: `Hi {{contact_name}},

Thanks for sharing your current challenges around {{pain_point}} during our intro chat today.

I was thinking about your goal of increasing revenue this quarter, and wanted to pass along two quick frameworks that similar clients used to unlock quick wins before our main project begins.

Let me know if you'd like me to build out the preliminary roadmap for our follow-up call on {{due_date}}!

Cheers,
{{my_name}}`,
    variables: ['{{contact_name}}', '{{company}}', '{{pain_point}}', '{{due_date}}', '{{my_name}}'],
    isDefault: true,
    timesUsed: 19,
  },
  {
    id: 'tpl-contract-signing-onboarding',
    title: 'Contract Signing & Onboarding Check-In',
    description: 'Remove friction when agreement is awaiting signature to secure the deal.',
    stage: 'contract_signing',
    category: 'Closing',
    channel: 'email',
    subject: 'Agreement for {{company}} - Ready for kickoff',
    body: `Hi {{contact_name}},

We have your onboarding team penciled in and are excited to begin work on {{project_name}}!

I noticed the agreement sent on {{due_date}} is still awaiting your signature. Are there any final clauses or internal approvals your team needs clarity on before we finalize?

Once signed, we can schedule our official kickoff call right away.

Best regards,
{{my_name}}`,
    variables: ['{{contact_name}}', '{{company}}', '{{project_name}}', '{{due_date}}', '{{my_name}}'],
    isDefault: true,
    timesUsed: 11,
  },
  {
    id: 'tpl-delighted-client-referral',
    title: 'Delighted Client Referral & Testimonial Request',
    description: 'Turn happy customers into predictable referral pipeline after successful delivery.',
    stage: 'referral',
    category: 'Growth',
    channel: 'email',
    subject: 'Quick favor & congrats on {{project_name}}!',
    body: `Hi {{contact_name}},

Huge congratulations on the successful rollout of {{project_name}}! It was an absolute pleasure working together on this.

Quick question: do you know 1 or 2 other founders or leaders in your network who might be struggling with {{service}} and could benefit from similar results?

If someone comes to mind, I'd be so grateful for an intro! Either way, thank you for being a fantastic partner.

Warm regards,
{{my_name}}`,
    variables: ['{{contact_name}}', '{{project_name}}', '{{service}}', '{{my_name}}'],
    isDefault: true,
    timesUsed: 8,
  },
];

export function subscribeToTemplates(
  userId: string,
  onData: (templates: EmailTemplate[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const templatesRef = collection(db, `users/${userId}/templates`);
  const q = query(templatesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    async (snapshot) => {
      if (snapshot.empty) {
        await seedDefaultTemplates(userId);
        return;
      }
      const templates: EmailTemplate[] = [];
      snapshot.forEach((d) => {
        templates.push({ id: d.id, ...d.data() } as EmailTemplate);
      });
      onData(templates);
    },
    (err) => {
      console.error('Templates subscription error:', err);
      onError(err);
    }
  );
}

export async function createTemplate(
  userId: string,
  templateData: Omit<EmailTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const templatesRef = collection(db, `users/${userId}/templates`);
  const newDoc = doc(templatesRef);
  const now = new Date().toISOString();

  const newTemplate: EmailTemplate = {
    id: newDoc.id,
    userId,
    ...templateData,
    timesUsed: templateData.timesUsed || 0,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(newDoc, newTemplate);
  return newDoc.id;
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  updates: Partial<EmailTemplate>
): Promise<void> {
  const docRef = doc(db, `users/${userId}/templates`, templateId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/templates`, templateId);
  await deleteDoc(docRef);
}

export async function incrementTemplateUsage(userId: string, templateId: string): Promise<void> {
  try {
    const docRef = doc(db, `users/${userId}/templates`, templateId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const cur = (snap.data() as any).timesUsed || 0;
      await updateDoc(docRef, { timesUsed: cur + 1 });
    }
  } catch (e) {
    console.warn('Could not increment template usage:', e);
  }
}

// Service layer function that runs on user login to verify if default templates exist
// in the user's Firestore workspace, cleans any existing duplicate templates in the database,
// and seeds only missing ones using deterministic IDs to guarantee idempotency.
export async function verifyAndSeedDefaultTemplates(userId: string): Promise<void> {
  if (!userId || userId === 'guest' || userId === 'demo-user') return;

  try {
    const templatesRef = collection(db, `users/${userId}/templates`);
    const snapshot = await getDocs(templatesRef);
    const existing = snapshot.docs.map((d) => ({
      id: d.id,
      ref: d.ref,
      ...(d.data() as EmailTemplate),
    }));
    const now = new Date().toISOString();

    for (const defTemplate of DEFAULT_SALES_TEMPLATES) {
      const matches = existing.filter(
        (t) =>
          t.id === defTemplate.id ||
          (t.title && t.title.toLowerCase().trim() === defTemplate.title.toLowerCase().trim())
      );

      if (matches.length === 0) {
        // Seed missing default template using deterministic ID
        const docRef = doc(db, `users/${userId}/templates/${defTemplate.id}`);
        await setDoc(docRef, {
          ...defTemplate,
          id: defTemplate.id,
          userId,
          createdAt: now,
          updatedAt: now,
        });
      } else if (matches.length > 1) {
        // Redundant duplicate templates exist in Firestore! Keep ONE, purge duplicate docs from database
        const keeper = matches.find((m) => m.id === defTemplate.id) || matches[0];
        const duplicates = matches.filter((m) => m.id !== keeper.id);
        for (const dup of duplicates) {
          console.log(`[DeduplicateTemplates] Deleting duplicate template ${dup.id} (${dup.title}) from Firestore...`);
          await deleteDoc(dup.ref);
        }
      }
    }

    // Also run sequence deduplication and sync in Firestore
    await syncAndDeduplicateSequences(userId);
  } catch (err) {
    console.error('Error verifying and seeding default templates/sequences:', err);
  }
}

export async function seedDefaultTemplates(userId: string): Promise<void> {
  await verifyAndSeedDefaultTemplates(userId);
}

// ==========================================
// --- LEADS DIRECT FIRESTORE OPERATIONS ---
// ==========================================

export async function createLead(
  userId: string,
  data: Omit<Lead, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<{ leadId: string; contactId?: string; appointmentId?: string }> {
  const leadsRef = collection(db, `users/${userId}/leads`);
  const newLeadDoc = doc(leadsRef);
  const now = new Date().toISOString();

  const newLead: Lead = {
    id: newLeadDoc.id,
    userId,
    name: data.name.trim(),
    company: data.company?.trim(),
    email: data.email?.trim(),
    phone: data.phone?.trim(),
    whatsapp: data.whatsapp?.trim() || data.phone?.trim(),
    leadSource: data.leadSource || 'website',
    expectedDealValue: Number(data.expectedDealValue) || 0,
    currency: data.currency || '$',
    status: data.status || 'new',
    notes: data.notes?.trim(),
    appointmentTimestamp: data.appointmentTimestamp,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Direct Firestore write to leads collection
  await setDoc(newLeadDoc, newLead);

  // 2. Automatically sync / create Contact record so CRM contacts stay unified
  let contactId: string | undefined;
  try {
    const contactsRef = collection(db, `users/${userId}/contacts`);
    const newContactDoc = doc(contactsRef);
    contactId = newContactDoc.id;

    const newContact: Contact = {
      id: newContactDoc.id,
      userId,
      name: newLead.name,
      company: newLead.company,
      email: newLead.email,
      phone: newLead.phone,
      whatsapp: newLead.whatsapp,
      preferredChannel: newLead.whatsapp ? 'whatsapp' : newLead.email ? 'email' : 'phone',
      notes: `Lead Source: ${newLead.leadSource}. Expected Deal: ${newLead.currency}${newLead.expectedDealValue.toLocaleString()}${newLead.notes ? ` - ${newLead.notes}` : ''}`,
      tags: ['Lead', 'Prospect'],
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(newContactDoc, newContact);
  } catch (contactErr) {
    console.warn('Auto contact creation warning:', contactErr);
  }

  // 3. If an appointment was scheduled with the date-time picker, create the appointment & follow-up
  let appointmentId: string | undefined;
  if (data.appointmentTimestamp) {
    try {
      const parsed = parseAppointmentTimestamp(data.appointmentTimestamp);
      const apptRef = collection(db, `users/${userId}/appointments`);
      const newApptDoc = doc(apptRef);
      appointmentId = newApptDoc.id;

      const newAppt: Appointment = {
        id: newApptDoc.id,
        userId,
        contactId,
        contactName: newLead.name,
        contactCompany: newLead.company,
        contactEmail: newLead.email,
        contactPhone: newLead.phone,
        contactWhatsapp: newLead.whatsapp,
        title: `Intro Call: ${newLead.name}`,
        description: `Lead intro via ${newLead.leadSource}. Expected value: ${newLead.currency}${newLead.expectedDealValue.toLocaleString()}`,
        scheduledAt: data.appointmentTimestamp,
        durationMinutes: 30,
        channel: newLead.whatsapp ? 'whatsapp' : 'phone',
        status: 'scheduled',
        expectedDealValue: newLead.expectedDealValue,
        currency: newLead.currency,
        notes: newLead.notes,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(newApptDoc, newAppt);

      // Add to follow-ups queue as well
      await createFollowUp(userId, {
        contactId: contactId || '',
        contactName: newLead.name,
        contactCompany: newLead.company,
        contactEmail: newLead.email,
        contactPhone: newLead.phone,
        contactWhatsapp: newLead.whatsapp,
        title: `Intro Call: ${newLead.name}`,
        description: `Lead from ${newLead.leadSource}. Expected value: ${newLead.currency}${newLead.expectedDealValue.toLocaleString()}`,
        type: 'appointment',
        amount: newLead.expectedDealValue,
        currency: newLead.currency,
        dueDate: parsed.date,
        appointmentTimestamp: data.appointmentTimestamp,
        appointmentDurationMinutes: 30,
        priority: 'high',
        priorityAutoCalculated: true,
        channel: newLead.whatsapp ? 'whatsapp' : 'phone',
        status: 'pending',
      });
    } catch (apptErr) {
      console.warn('Auto appointment creation warning:', apptErr);
    }
  } else {
    // Create an initial follow-up reminder to reach out to the new lead
    try {
      await createFollowUp(userId, {
        contactId: contactId || '',
        contactName: newLead.name,
        contactCompany: newLead.company,
        contactEmail: newLead.email,
        contactPhone: newLead.phone,
        contactWhatsapp: newLead.whatsapp,
        title: `Qualify & Follow up with new lead: ${newLead.name}`,
        description: `Lead Source: ${newLead.leadSource}. Deal value: ${newLead.currency}${newLead.expectedDealValue.toLocaleString()}`,
        type: 'lead',
        amount: newLead.expectedDealValue,
        currency: newLead.currency,
        dueDate: getTodayString(),
        priority: newLead.expectedDealValue >= 1000 ? 'high' : 'medium',
        priorityAutoCalculated: true,
        channel: newLead.whatsapp ? 'whatsapp' : 'email',
        status: 'pending',
      });
    } catch (fuErr) {
      console.warn('Auto lead follow-up warning:', fuErr);
    }
  }

  return { leadId: newLeadDoc.id, contactId, appointmentId };
}

export async function getLeads(userId: string): Promise<Lead[]> {
  try {
    const leadsRef = collection(db, `users/${userId}/leads`);
    const q = query(leadsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const leads: Lead[] = [];
    snapshot.forEach((docSnap) => {
      leads.push({ id: docSnap.id, ...(docSnap.data() as any) });
    });
    return leads;
  } catch (err) {
    console.error('getLeads error:', err);
    return [];
  }
}

export function subscribeLeads(userId: string, callback: (leads: Lead[]) => void): Unsubscribe {
  const leadsRef = collection(db, `users/${userId}/leads`);
  const q = query(leadsRef, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const leads: Lead[] = [];
      snapshot.forEach((docSnap) => {
        leads.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      callback(leads);
    },
    (err) => {
      console.warn('subscribeLeads snapshot warning:', err);
      callback([]);
    }
  );
}

export async function updateLead(userId: string, leadId: string, data: Partial<Lead>): Promise<void> {
  const docRef = doc(db, `users/${userId}/leads`, leadId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteLead(userId: string, leadId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/leads`, leadId);
  await deleteDoc(docRef);
}

// ===============================================
// --- APPOINTMENTS DIRECT FIRESTORE OPERATIONS ---
// ===============================================

export async function createAppointment(
  userId: string,
  data: Omit<Appointment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const apptsRef = collection(db, `users/${userId}/appointments`);
  const newApptDoc = doc(apptsRef);
  const now = new Date().toISOString();

  // Parse and ensure consistent ISO 8601 formatting
  const formattedScheduledAt = formatAppointmentTimestamp(
    data.scheduledAt.includes('T') ? data.scheduledAt.split('T')[0] : data.scheduledAt,
    data.scheduledAt.includes('T') ? data.scheduledAt.split('T')[1]?.substring(0, 5) : '09:00'
  );

  const parsed = parseAppointmentTimestamp(formattedScheduledAt);

  const newAppointment: Appointment = {
    id: newApptDoc.id,
    userId,
    contactId: data.contactId,
    contactName: data.contactName.trim(),
    contactCompany: data.contactCompany?.trim(),
    contactEmail: data.contactEmail?.trim(),
    contactPhone: data.contactPhone?.trim(),
    contactWhatsapp: data.contactWhatsapp?.trim() || data.contactPhone?.trim(),
    title: data.title.trim(),
    description: data.description?.trim(),
    scheduledAt: formattedScheduledAt,
    durationMinutes: Number(data.durationMinutes) || 30,
    channel: data.channel || 'whatsapp',
    locationOrLink: data.locationOrLink?.trim(),
    status: data.status || 'scheduled',
    expectedDealValue: Number(data.expectedDealValue) || undefined,
    currency: data.currency || '$',
    notes: data.notes?.trim(),
    createdAt: now,
    updatedAt: now,
  };

  // 1. Direct Firestore write
  await setDoc(newApptDoc, newAppointment);

  // 2. Also record in follow-ups queue so it appears in daily dashboard reminders
  try {
    await createFollowUp(userId, {
      contactId: data.contactId || '',
      contactName: newAppointment.contactName,
      contactCompany: newAppointment.contactCompany,
      contactEmail: newAppointment.contactEmail,
      contactPhone: newAppointment.contactPhone,
      contactWhatsapp: newAppointment.contactWhatsapp,
      title: newAppointment.title,
      description: newAppointment.description || `Appointment scheduled for ${parsed.timeDisplay}`,
      type: 'appointment',
      amount: newAppointment.expectedDealValue,
      currency: newAppointment.currency || '$',
      dueDate: parsed.date,
      appointmentTimestamp: formattedScheduledAt,
      appointmentDurationMinutes: newAppointment.durationMinutes,
      priority: parsed.isToday ? 'urgent' : 'high',
      priorityAutoCalculated: true,
      channel: newAppointment.channel,
      status: 'pending',
    });
  } catch (err) {
    console.warn('Sync appointment to followUps warning:', err);
  }

  return newApptDoc.id;
}

export async function getAppointments(userId: string): Promise<Appointment[]> {
  try {
    const apptsRef = collection(db, `users/${userId}/appointments`);
    const q = query(apptsRef, orderBy('scheduledAt', 'asc'));
    const snapshot = await getDocs(q);
    const appts: Appointment[] = [];
    snapshot.forEach((docSnap) => {
      appts.push({ id: docSnap.id, ...(docSnap.data() as any) });
    });
    return appts;
  } catch (err) {
    console.error('getAppointments error:', err);
    return [];
  }
}

export function subscribeAppointments(
  userId: string,
  callback: (appointments: Appointment[]) => void
): Unsubscribe {
  const apptsRef = collection(db, `users/${userId}/appointments`);
  const q = query(apptsRef, orderBy('scheduledAt', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const appts: Appointment[] = [];
      snapshot.forEach((docSnap) => {
        appts.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });
      callback(appts);
    },
    (err) => {
      console.warn('subscribeAppointments snapshot warning:', err);
      callback([]);
    }
  );
}

export async function updateAppointment(
  userId: string,
  appointmentId: string,
  data: Partial<Appointment>
): Promise<void> {
  const docRef = doc(db, `users/${userId}/appointments`, appointmentId);
  const updatePayload: any = { ...data, updatedAt: new Date().toISOString() };
  if (data.scheduledAt) {
    updatePayload.scheduledAt = formatAppointmentTimestamp(data.scheduledAt);
  }
  await updateDoc(docRef, updatePayload);
}

export async function deleteAppointment(userId: string, appointmentId: string): Promise<void> {
  const docRef = doc(db, `users/${userId}/appointments`, appointmentId);
  await deleteDoc(docRef);
}

