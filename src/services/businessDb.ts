import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isLiveFirestoreUser } from './db';
import { emitBusinessEvent } from './eventBus';
import type {
  Opportunity,
  Pipeline,
  Invoice,
  Campaign,
  CustomerTimelineEvent,
  KnowledgeBaseDoc,
  CustomerReview,
  PaymentRecord,
} from '../types';

// Default Sales Pipeline definition
export const DEFAULT_PIPELINE_STAGES = [
  { id: 'stage-lead', pipelineId: 'default-pipeline', name: 'Lead In', order: 1, probabilityPercentage: 20, color: '#3b82f6' },
  { id: 'stage-qual', pipelineId: 'default-pipeline', name: 'Qualified / Demo', order: 2, probabilityPercentage: 40, color: '#8b5cf6' },
  { id: 'stage-prop', pipelineId: 'default-pipeline', name: 'Proposal Sent', order: 3, probabilityPercentage: 60, color: '#f59e0b' },
  { id: 'stage-neg', pipelineId: 'default-pipeline', name: 'Negotiation', order: 4, probabilityPercentage: 80, color: '#ec4899' },
  { id: 'stage-won', pipelineId: 'default-pipeline', name: 'Closed Won', order: 5, probabilityPercentage: 100, color: '#10b981' },
  { id: 'stage-lost', pipelineId: 'default-pipeline', name: 'Closed Lost', order: 6, probabilityPercentage: 0, color: '#64748b' },
];

export function getDefaultPipeline(orgId: string): Pipeline {
  return {
    id: 'default-pipeline',
    orgId,
    name: 'Standard Sales Pipeline',
    isDefault: true,
    stages: DEFAULT_PIPELINE_STAGES,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ----------------------------------------------------
// OPPORTUNITIES
// ----------------------------------------------------

export function subscribeToOpportunities(
  userId: string,
  onData: (opps: Opportunity[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const localKey = `flow_opps_${userId}`;
  const loadLocal = () => {
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) return JSON.parse(stored) as Opportunity[];
    } catch {}
    return [];
  };

  onData(loadLocal());

  if (!isLiveFirestoreUser(userId)) {
    return () => {};
  }

  try {
    const oppsRef = collection(db, `users/${userId}/opportunities`);
    const q = query(oppsRef, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: Opportunity[] = [];
        snap.forEach((d) => items.push(d.data() as Opportunity));
        try {
          localStorage.setItem(localKey, JSON.stringify(items));
        } catch {}
        onData(items);
      },
      (err) => {
        console.warn('[Firestore] subscribeToOpportunities fallback:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function saveOpportunity(
  userId: string,
  opp: Partial<Opportunity> & { title: string; contactId: string; contactName: string; value: number }
): Promise<Opportunity> {
  const now = new Date().toISOString();
  const id = opp.id || `opp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const fullOpp: Opportunity = {
    id,
    orgId: userId,
    pipelineId: opp.pipelineId || 'default-pipeline',
    stageId: opp.stageId || 'stage-lead',
    title: opp.title,
    contactId: opp.contactId,
    contactName: opp.contactName,
    companyId: opp.companyId,
    companyName: opp.companyName,
    value: opp.value,
    currency: opp.currency || '$',
    status: opp.status || 'open',
    expectedCloseDate: opp.expectedCloseDate,
    assignedToUserId: opp.assignedToUserId || userId,
    leadSource: opp.leadSource || 'Manual Entry',
    campaignId: opp.campaignId,
    notes: opp.notes,
    tags: opp.tags || [],
    createdAt: opp.createdAt || now,
    updatedAt: now,
  };

  // Local storage update
  const localKey = `flow_opps_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    const list: Opportunity[] = stored ? JSON.parse(stored) : [];
    const index = list.findIndex((o) => o.id === id);
    if (index >= 0) list[index] = fullOpp;
    else list.unshift(fullOpp);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  // Cloud sync
  if (isLiveFirestoreUser(userId)) {
    try {
      await setDoc(doc(db, `users/${userId}/opportunities`, id), fullOpp, { merge: true });
    } catch (e) {
      console.warn('[Firestore] saveOpportunity cloud write notice:', e);
    }
  }

  // Publish reactive event
  if (!opp.id) {
    emitBusinessEvent.opportunityCreated(userId, {
      id: fullOpp.id,
      title: fullOpp.title,
      contactId: fullOpp.contactId,
      contactName: fullOpp.contactName,
      value: fullOpp.value,
      stageId: fullOpp.stageId,
    });
  } else if (fullOpp.stageId === 'stage-won' || fullOpp.status === 'won') {
    emitBusinessEvent.opportunityWon(userId, {
      id: fullOpp.id,
      title: fullOpp.title,
      contactId: fullOpp.contactId,
      contactName: fullOpp.contactName,
      value: fullOpp.value,
    });
  }

  return fullOpp;
}

export async function deleteOpportunity(userId: string, oppId: string): Promise<void> {
  const localKey = `flow_opps_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    if (stored) {
      const list: Opportunity[] = JSON.parse(stored);
      localStorage.setItem(localKey, JSON.stringify(list.filter((o) => o.id !== oppId)));
    }
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await deleteDoc(doc(db, `users/${userId}/opportunities`, oppId));
    } catch (e) {
      console.warn('[Firestore] deleteOpportunity cloud delete notice:', e);
    }
  }
}

// ----------------------------------------------------
// INVOICES & PAYMENTS
// ----------------------------------------------------

export function subscribeToInvoices(
  userId: string,
  onData: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const localKey = `flow_invoices_${userId}`;
  const loadLocal = () => {
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) return JSON.parse(stored) as Invoice[];
    } catch {}
    return [];
  };

  onData(loadLocal());

  if (!isLiveFirestoreUser(userId)) {
    return () => {};
  }

  try {
    const invRef = collection(db, `users/${userId}/invoices`);
    const q = query(invRef, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: Invoice[] = [];
        snap.forEach((d) => items.push(d.data() as Invoice));
        try {
          localStorage.setItem(localKey, JSON.stringify(items));
        } catch {}
        onData(items);
      },
      (err) => {
        console.warn('[Firestore] subscribeToInvoices fallback:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function saveInvoice(
  userId: string,
  invoice: Partial<Invoice> & { contactId: string; contactName: string; items: any[] }
): Promise<Invoice> {
  const now = new Date().toISOString();
  const id = invoice.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const subtotal = invoice.items.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0), 0);
  const taxRate = Number(invoice.taxRatePercentage) || 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const discountAmount = Number(invoice.discountAmount) || 0;
  const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);
  const amountPaid = Number(invoice.amountPaid) || 0;
  const balanceDue = Math.max(0, totalAmount - amountPaid);

  const fullInvoice: Invoice = {
    id,
    orgId: userId,
    invoiceNumber: invoice.invoiceNumber || `INV-${String(Date.now()).slice(-6)}`,
    contactId: invoice.contactId,
    contactName: invoice.contactName,
    contactEmail: invoice.contactEmail,
    contactPhone: invoice.contactPhone,
    contactAddress: invoice.contactAddress,
    companyName: invoice.companyName,
    opportunityId: invoice.opportunityId,
    status: invoice.status || (balanceDue === 0 ? 'paid' : 'sent'),
    issueDate: invoice.issueDate || now.split('T')[0],
    dueDate: invoice.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    paidAt: invoice.paidAt,
    items: invoice.items.map((it, idx) => ({
      id: it.id || `item-${idx + 1}`,
      description: it.description || 'Service line item',
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      total: (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
    })),
    subtotal,
    taxRatePercentage: taxRate,
    taxAmount,
    discountAmount,
    totalAmount,
    amountPaid,
    balanceDue,
    currency: invoice.currency || '$',
    notes: invoice.notes,
    paymentTerms: invoice.paymentTerms || 'Payment due within 14 days of issue',
    paymentLinkUrl: invoice.paymentLinkUrl,
    pdfUrl: invoice.pdfUrl,
    createdAt: invoice.createdAt || now,
    updatedAt: now,
  };

  // Local storage update
  const localKey = `flow_invoices_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    const list: Invoice[] = stored ? JSON.parse(stored) : [];
    const index = list.findIndex((i) => i.id === id);
    if (index >= 0) list[index] = fullInvoice;
    else list.unshift(fullInvoice);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  // Cloud sync
  if (isLiveFirestoreUser(userId)) {
    try {
      await setDoc(doc(db, `users/${userId}/invoices`, id), fullInvoice, { merge: true });
    } catch (e) {
      console.warn('[Firestore] saveInvoice cloud write notice:', e);
    }
  }

  // Publish reactive event
  if (!invoice.id) {
    emitBusinessEvent.invoiceCreated(userId, {
      id: fullInvoice.id,
      invoiceNumber: fullInvoice.invoiceNumber,
      contactId: fullInvoice.contactId,
      contactName: fullInvoice.contactName,
      totalAmount: fullInvoice.totalAmount,
      currency: fullInvoice.currency,
    });
  }

  if (fullInvoice.status === 'paid' && !invoice.paidAt) {
    emitBusinessEvent.paymentReceived(userId, {
      invoiceId: fullInvoice.id,
      contactId: fullInvoice.contactId,
      contactName: fullInvoice.contactName,
      amount: fullInvoice.totalAmount,
      currency: fullInvoice.currency,
      paymentMethod: 'credit_card',
    });
  }

  return fullInvoice;
}

export async function deleteInvoice(userId: string, invoiceId: string): Promise<void> {
  const localKey = `flow_invoices_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    if (stored) {
      const list: Invoice[] = JSON.parse(stored);
      localStorage.setItem(localKey, JSON.stringify(list.filter((i) => i.id !== invoiceId)));
    }
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await deleteDoc(doc(db, `users/${userId}/invoices`, invoiceId));
    } catch (e) {
      console.warn('[Firestore] deleteInvoice notice:', e);
    }
  }
}

// ----------------------------------------------------
// CAMPAIGNS
// ----------------------------------------------------

export function subscribeToCampaigns(
  userId: string,
  onData: (campaigns: Campaign[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const localKey = `flow_campaigns_${userId}`;
  const loadLocal = () => {
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) return JSON.parse(stored) as Campaign[];
    } catch {}
    return [];
  };

  onData(loadLocal());

  if (!isLiveFirestoreUser(userId)) {
    return () => {};
  }

  try {
    const campRef = collection(db, `users/${userId}/campaigns`);
    const q = query(campRef, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: Campaign[] = [];
        snap.forEach((d) => items.push(d.data() as Campaign));
        try {
          localStorage.setItem(localKey, JSON.stringify(items));
        } catch {}
        onData(items);
      },
      (err) => {
        console.warn('[Firestore] subscribeToCampaigns fallback:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function saveCampaign(
  userId: string,
  campaign: Partial<Campaign> & { name: string; objective: any; channel: any }
): Promise<Campaign> {
  const now = new Date().toISOString();
  const id = campaign.id || `camp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const fullCamp: Campaign = {
    id,
    orgId: userId,
    name: campaign.name,
    objective: campaign.objective || 'lead_generation',
    channel: campaign.channel || 'meta_ads',
    status: campaign.status || 'active',
    budget: Number(campaign.budget) || 0,
    currency: campaign.currency || '$',
    adSpend: Number(campaign.adSpend) || 0,
    impressions: Number(campaign.impressions) || 0,
    clicks: Number(campaign.clicks) || 0,
    leadsGenerated: Number(campaign.leadsGenerated) || 0,
    qualifiedLeads: Number(campaign.qualifiedLeads) || 0,
    dealsWon: Number(campaign.dealsWon) || 0,
    revenueGenerated: Number(campaign.revenueGenerated) || 0,
    targetAudience: campaign.targetAudience,
    contentHeadline: campaign.contentHeadline,
    contentBody: campaign.contentBody,
    startDate: campaign.startDate || now.split('T')[0],
    endDate: campaign.endDate,
    connectedWorkflowId: campaign.connectedWorkflowId,
    utmSource: campaign.utmSource || campaign.channel,
    utmCampaign: campaign.utmCampaign || campaign.name.toLowerCase().replace(/\s+/g, '-'),
    tags: campaign.tags || [],
    createdAt: campaign.createdAt || now,
    updatedAt: now,
  };

  const localKey = `flow_campaigns_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    const list: Campaign[] = stored ? JSON.parse(stored) : [];
    const index = list.findIndex((c) => c.id === id);
    if (index >= 0) list[index] = fullCamp;
    else list.unshift(fullCamp);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await setDoc(doc(db, `users/${userId}/campaigns`, id), fullCamp, { merge: true });
    } catch (e) {
      console.warn('[Firestore] saveCampaign cloud write notice:', e);
    }
  }

  if (!campaign.id) {
    emitBusinessEvent.campaignStarted(userId, {
      id: fullCamp.id,
      name: fullCamp.name,
      channel: fullCamp.channel,
      budget: fullCamp.budget,
    });
  }

  return fullCamp;
}

export async function deleteCampaign(userId: string, campaignId: string): Promise<void> {
  const localKey = `flow_campaigns_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    if (stored) {
      const list: Campaign[] = JSON.parse(stored);
      localStorage.setItem(localKey, JSON.stringify(list.filter((c) => c.id !== campaignId)));
    }
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await deleteDoc(doc(db, `users/${userId}/campaigns`, campaignId));
    } catch (e) {
      console.warn('[Firestore] deleteCampaign cloud notice:', e);
    }
  }
}

// ----------------------------------------------------
// KNOWLEDGE BASE (AI Grounding)
// ----------------------------------------------------

export function subscribeToKnowledgeBase(
  userId: string,
  onData: (docs: KnowledgeBaseDoc[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const localKey = `flow_kb_${userId}`;
  const loadLocal = () => {
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) return JSON.parse(stored) as KnowledgeBaseDoc[];
    } catch {}
    return [];
  };

  onData(loadLocal());

  if (!isLiveFirestoreUser(userId)) {
    return () => {};
  }

  try {
    const kbRef = collection(db, `users/${userId}/knowledge_base`);
    const q = query(kbRef, orderBy('lastUpdated', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: KnowledgeBaseDoc[] = [];
        snap.forEach((d) => items.push(d.data() as KnowledgeBaseDoc));
        try {
          localStorage.setItem(localKey, JSON.stringify(items));
        } catch {}
        onData(items);
      },
      (err) => {
        console.warn('[Firestore] subscribeToKnowledgeBase notice:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function saveKnowledgeBaseDoc(
  userId: string,
  item: Partial<KnowledgeBaseDoc> & { category: any; title: string; content: string }
): Promise<KnowledgeBaseDoc> {
  const now = new Date().toISOString();
  const id = item.id || `kb-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const fullDoc: KnowledgeBaseDoc = {
    id,
    orgId: userId,
    category: item.category,
    title: item.title,
    content: item.content,
    tags: item.tags || [],
    lastUpdated: now,
  };

  const localKey = `flow_kb_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    const list: KnowledgeBaseDoc[] = stored ? JSON.parse(stored) : [];
    const index = list.findIndex((d) => d.id === id);
    if (index >= 0) list[index] = fullDoc;
    else list.unshift(fullDoc);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await setDoc(doc(db, `users/${userId}/knowledge_base`, id), fullDoc, { merge: true });
    } catch (e) {
      console.warn('[Firestore] saveKnowledgeBaseDoc cloud notice:', e);
    }
  }

  return fullDoc;
}

export async function deleteKnowledgeBaseDoc(userId: string, docId: string): Promise<void> {
  const localKey = `flow_kb_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    if (stored) {
      const list: KnowledgeBaseDoc[] = JSON.parse(stored);
      localStorage.setItem(localKey, JSON.stringify(list.filter((d) => d.id !== docId)));
    }
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await deleteDoc(doc(db, `users/${userId}/knowledge_base`, docId));
    } catch (e) {
      console.warn('[Firestore] deleteKnowledgeBaseDoc notice:', e);
    }
  }
}

// ----------------------------------------------------
// CUSTOMER REVIEWS & REPUTATION
// ----------------------------------------------------

export function subscribeToReviews(
  userId: string,
  onData: (reviews: CustomerReview[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const localKey = `flow_reviews_${userId}`;
  const loadLocal = () => {
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) return JSON.parse(stored) as CustomerReview[];
    } catch {}
    return [];
  };

  onData(loadLocal());

  if (!isLiveFirestoreUser(userId)) {
    return () => {};
  }

  try {
    const revRef = collection(db, `users/${userId}/reviews`);
    const q = query(revRef, orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: CustomerReview[] = [];
        snap.forEach((d) => items.push(d.data() as CustomerReview));
        try {
          localStorage.setItem(localKey, JSON.stringify(items));
        } catch {}
        onData(items);
      },
      (err) => {
        console.warn('[Firestore] subscribeToReviews notice:', err);
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function saveCustomerReview(
  userId: string,
  review: Partial<CustomerReview> & { contactId: string; contactName: string; rating: number; feedbackText: string }
): Promise<CustomerReview> {
  const now = new Date().toISOString();
  const id = review.id || `rev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const fullRev: CustomerReview = {
    id,
    orgId: userId,
    contactId: review.contactId,
    contactName: review.contactName,
    rating: review.rating,
    feedbackText: review.feedbackText,
    platform: review.platform || 'internal',
    isPublic: review.isPublic ?? true,
    status: review.status || 'approved',
    createdAt: review.createdAt || now,
  };

  const localKey = `flow_reviews_${userId}`;
  try {
    const stored = localStorage.getItem(localKey);
    const list: CustomerReview[] = stored ? JSON.parse(stored) : [];
    const index = list.findIndex((r) => r.id === id);
    if (index >= 0) list[index] = fullRev;
    else list.unshift(fullRev);
    localStorage.setItem(localKey, JSON.stringify(list));
  } catch {}

  if (isLiveFirestoreUser(userId)) {
    try {
      await setDoc(doc(db, `users/${userId}/reviews`, id), fullRev, { merge: true });
    } catch (e) {
      console.warn('[Firestore] saveCustomerReview cloud write notice:', e);
    }
  }

  emitBusinessEvent.reviewCreated(userId, {
    id: fullRev.id,
    contactId: fullRev.contactId,
    contactName: fullRev.contactName,
    rating: fullRev.rating,
    feedbackText: fullRev.feedbackText,
  });

  return fullRev;
}
