import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import {
  getDefaultPipeline,
  subscribeToOpportunities,
  saveOpportunity,
  deleteOpportunity,
  subscribeToInvoices,
  saveInvoice,
  deleteInvoice,
  subscribeToCampaigns,
  saveCampaign,
  deleteCampaign,
  subscribeToKnowledgeBase,
  saveKnowledgeBaseDoc,
  deleteKnowledgeBaseDoc,
  subscribeToReviews,
  saveCustomerReview,
} from '../services/businessDb';
import { eventBus } from '../services/eventBus';
import type {
  Opportunity,
  Pipeline,
  Invoice,
  Campaign,
  KnowledgeBaseDoc,
  CustomerReview,
  BusinessEvent,
} from '../types';

interface BusinessOsStats {
  pipelineValue: number;
  weightedPipelineValue: number;
  wonDealsValue: number;
  openOpportunitiesCount: number;
  totalInvoicedAmount: number;
  paidInvoicesAmount: number;
  outstandingInvoicesAmount: number;
  activeCampaignsCount: number;
  totalCampaignSpend: number;
  totalAttributedRevenue: number;
  campaignRoiPercentage: number;
  averageRating: number;
  totalReviewsCount: number;
}

interface BusinessOsContextType {
  loading: boolean;
  pipeline: Pipeline;
  opportunities: Opportunity[];
  invoices: Invoice[];
  campaigns: Campaign[];
  knowledgeBase: KnowledgeBaseDoc[];
  customerReviews: CustomerReview[];
  recentEvents: BusinessEvent[];
  stats: BusinessOsStats;

  // Opportunity Actions
  createOpportunity: (opp: Partial<Opportunity> & { title: string; contactId: string; contactName: string; value: number }) => Promise<Opportunity>;
  updateOpportunity: (opp: Partial<Opportunity> & { id: string }) => Promise<Opportunity>;
  deleteOpportunityById: (id: string) => Promise<void>;

  // Invoice Actions
  createInvoice: (inv: Partial<Invoice> & { contactId: string; contactName: string; items: any[] }) => Promise<Invoice>;
  updateInvoice: (inv: Partial<Invoice> & { id: string }) => Promise<Invoice>;
  markInvoicePaid: (id: string, paymentMethod?: string) => Promise<Invoice>;
  deleteInvoiceById: (id: string) => Promise<void>;

  // Campaign Actions
  createCampaign: (camp: Partial<Campaign> & { name: string; objective: any; channel: any }) => Promise<Campaign>;
  updateCampaign: (camp: Partial<Campaign> & { id: string }) => Promise<Campaign>;
  deleteCampaignById: (id: string) => Promise<void>;

  // Knowledge Base Actions
  createKnowledgeDoc: (doc: Partial<KnowledgeBaseDoc> & { category: any; title: string; content: string }) => Promise<KnowledgeBaseDoc>;
  deleteKnowledgeDocById: (id: string) => Promise<void>;

  // Review Actions
  createReview: (review: Partial<CustomerReview> & { contactId: string; contactName: string; rating: number; feedbackText: string }) => Promise<CustomerReview>;

  // Event bus triggering
  triggerCustomEvent: (type: any, payload: any) => Promise<BusinessEvent>;
}

const BusinessOsContext = createContext<BusinessOsContextType | undefined>(undefined);

export const BusinessOsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.uid || 'guest';

  const [loading, setLoading] = useState(true);
  const [pipeline] = useState<Pipeline>(() => getDefaultPipeline(userId));
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseDoc[]>([]);
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);
  const [recentEvents, setRecentEvents] = useState<BusinessEvent[]>(() => eventBus.getHistory(30));

  // Subscribe to internal event bus to keep live audit trail in state
  useEffect(() => {
    const unsub = eventBus.subscribe('*', (event) => {
      setRecentEvents((prev) => [event, ...prev.slice(0, 49)]);
    });
    return unsub;
  }, []);

  // Real-time Firestore subscriptions with local fallbacks
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubOpps = subscribeToOpportunities(userId, (data) => {
      setOpportunities(data);
    });

    const unsubInvoices = subscribeToInvoices(userId, (data) => {
      setInvoices(data);
    });

    const unsubCampaigns = subscribeToCampaigns(userId, (data) => {
      setCampaigns(data);
    });

    const unsubKb = subscribeToKnowledgeBase(userId, (data) => {
      setKnowledgeBase(data);
    });

    const unsubReviews = subscribeToReviews(userId, (data) => {
      setCustomerReviews(data);
      setLoading(false);
    });

    return () => {
      unsubOpps();
      unsubInvoices();
      unsubCampaigns();
      unsubKb();
      unsubReviews();
    };
  }, [userId]);

  // Aggregate Business Metrics
  const stats: BusinessOsStats = useMemo(() => {
    // Pipeline calculations
    const openOpps = opportunities.filter((o) => o.status === 'open');
    const pipelineValue = openOpps.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
    
    // Stage-weighted probability calculation
    const weightedPipelineValue = openOpps.reduce((sum, o) => {
      const stage = pipeline.stages.find((s) => s.id === o.stageId);
      const prob = stage ? stage.probabilityPercentage / 100 : 0.5;
      return sum + (Number(o.value) || 0) * prob;
    }, 0);

    const wonDealsValue = opportunities
      .filter((o) => o.status === 'won' || o.stageId === 'stage-won')
      .reduce((sum, o) => sum + (Number(o.value) || 0), 0);

    // Invoice calculations
    const totalInvoicedAmount = invoices.reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
    const paidInvoicesAmount = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + (Number(i.totalAmount) || 0), 0);
    const outstandingInvoicesAmount = invoices
      .filter((i) => i.status !== 'paid' && i.status !== 'void' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + (Number(i.balanceDue) || 0), 0);

    // Campaign funnel calculations
    const activeCamps = campaigns.filter((c) => c.status === 'active');
    const totalCampaignSpend = campaigns.reduce((sum, c) => sum + (Number(c.adSpend) || 0), 0);
    const totalAttributedRevenue = campaigns.reduce((sum, c) => sum + (Number(c.revenueGenerated) || 0), 0);
    const campaignRoiPercentage =
      totalCampaignSpend > 0
        ? Math.round(((totalAttributedRevenue - totalCampaignSpend) / totalCampaignSpend) * 100)
        : 0;

    // Reputation calculations
    const totalReviewsCount = customerReviews.length;
    const averageRating =
      totalReviewsCount > 0
        ? Number((customerReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviewsCount).toFixed(1))
        : 5.0;

    return {
      pipelineValue,
      weightedPipelineValue,
      wonDealsValue,
      openOpportunitiesCount: openOpps.length,
      totalInvoicedAmount,
      paidInvoicesAmount,
      outstandingInvoicesAmount,
      activeCampaignsCount: activeCamps.length,
      totalCampaignSpend,
      totalAttributedRevenue,
      campaignRoiPercentage,
      averageRating,
      totalReviewsCount,
    };
  }, [opportunities, invoices, campaigns, customerReviews, pipeline]);

  // Opportunity Actions
  const createOpportunity = async (opp: Partial<Opportunity> & { title: string; contactId: string; contactName: string; value: number }) => {
    const saved = await saveOpportunity(userId, opp);
    setOpportunities((prev) => [saved, ...prev.filter((o) => o.id !== saved.id)]);
    return saved;
  };

  const updateOpportunity = async (opp: Partial<Opportunity> & { id: string }) => {
    const existing = opportunities.find((o) => o.id === opp.id);
    const merged = { ...(existing || {}), ...opp } as any;
    const saved = await saveOpportunity(userId, merged);
    setOpportunities((prev) => prev.map((o) => (o.id === saved.id ? saved : o)));
    return saved;
  };

  const deleteOpportunityById = async (id: string) => {
    await deleteOpportunity(userId, id);
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
  };

  // Invoice Actions
  const createInvoiceAction = async (inv: Partial<Invoice> & { contactId: string; contactName: string; items: any[] }) => {
    const saved = await saveInvoice(userId, inv);
    setInvoices((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)]);
    return saved;
  };

  const updateInvoiceAction = async (inv: Partial<Invoice> & { id: string }) => {
    const existing = invoices.find((i) => i.id === inv.id);
    const merged = { ...(existing || {}), ...inv } as any;
    const saved = await saveInvoice(userId, merged);
    setInvoices((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
    return saved;
  };

  const markInvoicePaid = async (id: string, paymentMethod = 'credit_card') => {
    const existing = invoices.find((i) => i.id === id);
    if (!existing) throw new Error('Invoice not found');
    const updated = await saveInvoice(userId, {
      ...existing,
      status: 'paid',
      amountPaid: existing.totalAmount,
      balanceDue: 0,
      paidAt: new Date().toISOString(),
    });
    setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
    return updated;
  };

  const deleteInvoiceById = async (id: string) => {
    await deleteInvoice(userId, id);
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  };

  // Campaign Actions
  const createCampaignAction = async (camp: Partial<Campaign> & { name: string; objective: any; channel: any }) => {
    const saved = await saveCampaign(userId, camp);
    setCampaigns((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
    return saved;
  };

  const updateCampaignAction = async (camp: Partial<Campaign> & { id: string }) => {
    const existing = campaigns.find((c) => c.id === camp.id);
    const merged = { ...(existing || {}), ...camp } as any;
    const saved = await saveCampaign(userId, merged);
    setCampaigns((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    return saved;
  };

  const deleteCampaignById = async (id: string) => {
    await deleteCampaign(userId, id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  // Knowledge Base Actions
  const createKnowledgeDoc = async (docData: Partial<KnowledgeBaseDoc> & { category: any; title: string; content: string }) => {
    const saved = await saveKnowledgeBaseDoc(userId, docData);
    setKnowledgeBase((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
    return saved;
  };

  const deleteKnowledgeDocById = async (id: string) => {
    await deleteKnowledgeBaseDoc(userId, id);
    setKnowledgeBase((prev) => prev.filter((d) => d.id !== id));
  };

  // Customer Review Actions
  const createReviewAction = async (rev: Partial<CustomerReview> & { contactId: string; contactName: string; rating: number; feedbackText: string }) => {
    const saved = await saveCustomerReview(userId, rev);
    setCustomerReviews((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
    return saved;
  };

  // Custom Event Trigger
  const triggerCustomEvent = async (type: any, payload: any) => {
    return eventBus.publish({
      orgId: userId,
      type,
      payload,
      actorType: 'user',
    });
  };

  return (
    <BusinessOsContext.Provider
      value={{
        loading,
        pipeline,
        opportunities,
        invoices,
        campaigns,
        knowledgeBase,
        customerReviews,
        recentEvents,
        stats,
        createOpportunity,
        updateOpportunity,
        deleteOpportunityById,
        createInvoice: createInvoiceAction,
        updateInvoice: updateInvoiceAction,
        markInvoicePaid,
        deleteInvoiceById,
        createCampaign: createCampaignAction,
        updateCampaign: updateCampaignAction,
        deleteCampaignById,
        createKnowledgeDoc,
        deleteKnowledgeDocById,
        createReview: createReviewAction,
        triggerCustomEvent,
      }}
    >
      {children}
    </BusinessOsContext.Provider>
  );
};

export const useBusinessOs = () => {
  const context = useContext(BusinessOsContext);
  if (!context) {
    throw new Error('useBusinessOs must be used within a BusinessOsProvider');
  }
  return context;
};
