import type { BusinessEvent, CustomerTimelineEvent } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { isLiveFirestoreUser } from './db';

type EventHandler<T = any> = (event: BusinessEvent<T>) => void | Promise<void>;

class BusinessEventBus {
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private wildcardSubscribers: Set<EventHandler> = new Set();
  private localHistory: BusinessEvent[] = [];
  private static readonly MAX_HISTORY_LENGTH = 300;
  private static readonly STORAGE_KEY = 'flow_business_events_history';

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(BusinessEventBus.STORAGE_KEY);
        if (stored) {
          this.localHistory = JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('[EventBus] Could not load stored event history:', e);
    }
  }

  private persistHistory() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const sliced = this.localHistory.slice(-BusinessEventBus.MAX_HISTORY_LENGTH);
        localStorage.setItem(BusinessEventBus.STORAGE_KEY, JSON.stringify(sliced));
      }
    } catch (e) {
      console.warn('[EventBus] Could not save event history to storage:', e);
    }
  }

  /**
   * Subscribe to a specific business event or all events ('*')
   */
  public subscribe<T = any>(
    eventType: string,
    handler: EventHandler<T>
  ): () => void {
    if (eventType === '*') {
      this.wildcardSubscribers.add(handler);
      return () => {
        this.wildcardSubscribers.delete(handler);
      };
    }

    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    const set = this.subscribers.get(eventType)!;
    set.add(handler as EventHandler);

    return () => {
      set.delete(handler as EventHandler);
    };
  }

  /**
   * Publish a business event across the platform
   */
  public async publish<T = any>(
    eventData: Omit<BusinessEvent<T>, 'id' | 'timestamp'>
  ): Promise<BusinessEvent<T>> {
    const event: BusinessEvent<T> = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // Store in internal history
    this.localHistory.unshift(event);
    if (this.localHistory.length > BusinessEventBus.MAX_HISTORY_LENGTH) {
      this.localHistory.pop();
    }
    this.persistHistory();

    // Persist to Firestore if live user session
    if (event.orgId && isLiveFirestoreUser(event.orgId)) {
      try {
        const eventDoc = doc(collection(db, `users/${event.orgId}/events`), event.id);
        setDoc(eventDoc, event).catch((err) =>
          console.warn('[EventBus] Firestore event persistence notice:', err)
        );
      } catch (err) {
        console.warn('[EventBus] Cloud event logging non-critical error:', err);
      }
    }

    // Notify specific type subscribers
    const typeSubscribers = this.subscribers.get(event.type);
    if (typeSubscribers) {
      typeSubscribers.forEach((handler) => {
        try {
          handler(event);
        } catch (err) {
          console.error(`[EventBus] Error executing subscriber for ${event.type}:`, err);
        }
      });
    }

    // Notify wildcard subscribers
    this.wildcardSubscribers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[EventBus] Error executing wildcard subscriber for ${event.type}:`, err);
      }
    });

    return event;
  }

  /**
   * Get recent business events from memory / local storage
   */
  public getHistory(limit = 50, filterType?: string): BusinessEvent[] {
    let list = this.localHistory;
    if (filterType) {
      list = list.filter((e) => e.type === filterType);
    }
    return list.slice(0, limit);
  }

  /**
   * Clear local event buffer
   */
  public clearLocalHistory() {
    this.localHistory = [];
    try {
      localStorage.removeItem(BusinessEventBus.STORAGE_KEY);
    } catch {}
  }
}

// Global Singleton instance
export const eventBus = new BusinessEventBus();

// Convenience helpers for publishing common standard events
export const emitBusinessEvent = {
  leadCreated: (orgId: string, lead: { id: string; name: string; email?: string; phone?: string; leadSource?: string; expectedDealValue?: number; campaignId?: string }) =>
    eventBus.publish({
      orgId,
      type: 'lead.created',
      payload: lead,
      actorType: 'system',
    }),

  leadQualified: (orgId: string, lead: { id: string; name: string; score?: number; qualificationNotes?: string }) =>
    eventBus.publish({
      orgId,
      type: 'lead.qualified',
      payload: lead,
      actorType: 'ai',
    }),

  appointmentCreated: (orgId: string, appointment: { id: string; title: string; contactName?: string; scheduledAt: string; durationMinutes?: number; expectedDealValue?: number }) =>
    eventBus.publish({
      orgId,
      type: 'appointment.created',
      payload: appointment,
      actorType: 'user',
    }),

  opportunityCreated: (orgId: string, opp: { id: string; title: string; contactId: string; contactName: string; value: number; stageId: string }) =>
    eventBus.publish({
      orgId,
      type: 'opportunity.created',
      payload: opp,
      actorType: 'user',
    }),

  opportunityWon: (orgId: string, opp: { id: string; title: string; contactId: string; contactName: string; value: number }) =>
    eventBus.publish({
      orgId,
      type: 'opportunity.won',
      payload: opp,
      actorType: 'user',
    }),

  invoiceCreated: (orgId: string, invoice: { id: string; invoiceNumber: string; contactId: string; contactName: string; totalAmount: number; currency: string }) =>
    eventBus.publish({
      orgId,
      type: 'invoice.created',
      payload: invoice,
      actorType: 'user',
    }),

  invoiceSent: (orgId: string, invoice: { id: string; invoiceNumber: string; contactId: string; contactName: string; channel?: string }) =>
    eventBus.publish({
      orgId,
      type: 'invoice.sent',
      payload: invoice,
      actorType: 'user',
    }),

  paymentReceived: (orgId: string, payment: { id?: string; invoiceId?: string; contactId: string; contactName: string; amount: number; currency: string; paymentMethod: string }) =>
    eventBus.publish({
      orgId,
      type: 'payment.received',
      payload: payment,
      actorType: 'system',
    }),

  customerCreated: (orgId: string, customer: { id: string; name: string; email?: string; company?: string }) =>
    eventBus.publish({
      orgId,
      type: 'customer.created',
      payload: customer,
      actorType: 'system',
    }),

  campaignStarted: (orgId: string, campaign: { id: string; name: string; channel: string; budget: number }) =>
    eventBus.publish({
      orgId,
      type: 'campaign.started',
      payload: campaign,
      actorType: 'user',
    }),

  reviewRequested: (orgId: string, reviewReq: { contactId: string; contactName: string; channel: string }) =>
    eventBus.publish({
      orgId,
      type: 'review.requested',
      payload: reviewReq,
      actorType: 'system',
    }),

  reviewCreated: (orgId: string, review: { id: string; contactId: string; contactName: string; rating: number; feedbackText: string }) =>
    eventBus.publish({
      orgId,
      type: 'review.created',
      payload: review,
      actorType: 'contact',
    }),

  aiEscalated: (orgId: string, data: { contactId: string; contactName: string; reason: string; conversationSnippet?: string }) =>
    eventBus.publish({
      orgId,
      type: 'ai.escalated',
      payload: data,
      actorType: 'ai',
    }),
};
