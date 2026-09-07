export type ContactTag = 'Lead' | 'Client' | 'Prospect' | 'VIP' | 'Invoice' | 'Proposal' | 'Appointment' | string;

export interface Contact {
  id: string;
  userId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  preferredChannel?: 'whatsapp' | 'email' | 'sms' | 'phone' | 'other';
  notes?: string;
  tags?: ContactTag[];
  createdAt: string;
  updatedAt: string;
}

export type FollowUpType = 'lead' | 'proposal' | 'invoice' | 'appointment' | 'customer' | 'general';
export type FollowUpChannel = 'whatsapp' | 'email' | 'sms' | 'phone' | 'other';
export type FollowUpPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FollowUpStatus = 'pending' | 'contacted' | 'completed' | 'snoozed' | 'cancelled';
export type MessageTone = 'friendly' | 'professional' | 'casual' | 'firm' | 'urgent' | 'short' | 'warm';

export interface FollowUp {
  id: string;
  userId: string;
  contactId: string;
  contactName: string;
  contactCompany?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  title: string;
  description?: string;
  type: FollowUpType;
  amount?: number;
  currency: string;
  dueDate: string; // ISO date format YYYY-MM-DD
  priority: FollowUpPriority;
  priorityAutoCalculated?: boolean;
  channel: FollowUpChannel;
  status: FollowUpStatus;
  notes?: string;
  lastContactedAt?: string;
  completedAt?: string;
  snoozedUntil?: string;
  appointmentTimestamp?: string; // ISO 8601 UTC timestamp format
  appointmentDurationMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadSource =
  | 'website'
  | 'referral'
  | 'linkedin'
  | 'cold_outreach'
  | 'advertisement'
  | 'event'
  | 'inbound_call'
  | 'partner'
  | 'other';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost';

export interface Lead {
  id: string;
  userId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  leadSource: LeadSource | string;
  expectedDealValue: number;
  currency: string;
  status: LeadStatus;
  notes?: string;
  appointmentTimestamp?: string; // Consistent ISO 8601 UTC timestamp
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  userId: string;
  contactId?: string;
  contactName: string;
  contactCompany?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  title: string;
  description?: string;
  scheduledAt: string; // Stored consistently in ISO 8601 UTC timestamp format: YYYY-MM-DDTHH:mm:ss.sssZ
  durationMinutes: number;
  channel: FollowUpChannel;
  locationOrLink?: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  expectedDealValue?: number;
  currency?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMessage {
  id: string;
  userId: string;
  followUpId?: string;
  contactId?: string;
  contactName: string;
  tone: MessageTone;
  channel: FollowUpChannel;
  context: string;
  subject?: string;
  generatedContent: string;
  finalContent: string;
  createdAt: string;
}

export type UserPlan = 'free' | 'pro';

export type SubscriptionStatus =
  | 'free'
  | 'active'
  | 'active_pro'
  | 'payment_failed'
  | 'cancelled'
  | 'expired';

export interface UserSubscription {
  plan: UserPlan;
  status: SubscriptionStatus;
  paystackCustomerCode?: string;
  paystackSubscriptionCode?: string;
  paystackTransactionReference?: string;
  paystackAuthorizationCode?: string;
  amount: number;
  currency: string;
  interval?: 'monthly' | 'yearly';
  startedAt?: string;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  lastPaymentError?: string;
  updatedAt: string;
}

export interface BillingConfig {
  currency: string;
  proPrice: number;
  isConfigured: boolean;
  paystackPublicKey?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  profession?: string;
  businessType?: 'freelancer' | 'consultant' | 'agency' | 'small_business' | 'service_provider' | string;
  defaultTone?: MessageTone;
  defaultCurrency?: string;
  primaryFollowUpFocus?: string[];
  onboardingCompleted: boolean;
  plan: UserPlan;
  subscriptionStatus?: SubscriptionStatus;
  aiGenerationsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanLimitInfo {
  maxContacts: number;
  maxActiveFollowUps: number;
  maxAiGenerations: number;
  maxChatbotRequests: number;
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimitInfo> = {
  free: {
    maxContacts: 20,
    maxActiveFollowUps: 10,
    maxAiGenerations: 25,
    maxChatbotRequests: 25,
  },
  pro: {
    maxContacts: Infinity,
    maxActiveFollowUps: Infinity,
    maxAiGenerations: Infinity,
    maxChatbotRequests: Infinity,
  },
};

export type AppView =
  | 'landing'
  | 'dashboard'
  | 'follow-ups'
  | 'sequences'
  | 'analytics'
  | 'templates'
  | 'contacts'
  | 'settings'
  | 'billing'
  | 'pricing';

export type TemplateStage =
  | 'lead_qualification'
  | 'proposal_sent'
  | 'post_meeting'
  | 'negotiation'
  | 'invoice_overdue'
  | 're_engagement'
  | 'contract_signing'
  | 'referral'
  | 'general';

export interface EmailTemplate {
  id: string;
  userId: string;
  title: string;
  description?: string;
  stage: TemplateStage;
  category: string;
  channel: FollowUpChannel;
  subject?: string;
  body: string;
  variables: string[];
  isDefault?: boolean;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatActionType =
  | 'create_followup'
  | 'update_followup'
  | 'complete_followup'
  | 'snooze_followup';

export interface ChatPendingAction {
  id: string;
  type: ChatActionType;
  title: string;
  summary: string;
  payload: any;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'error';
  resultMessage?: string;
}

export type ProposedAction = ChatPendingAction;

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  pendingAction?: ChatPendingAction;
  suggestedPrompts?: string[];
}

export interface ContactTimelineEvent {
  id: string;
  contactId: string;
  followUpId?: string;
  type: 'created' | 'outreach_sent' | 'ai_generated' | 'completed' | 'snoozed' | 'sequence_step' | 'note_added';
  title: string;
  description?: string;
  channel?: FollowUpChannel;
  amount?: number;
  currency?: string;
  timestamp: string;
}

export interface SequenceVariation {
  id: string;
  tone: MessageTone;
  label: string;
  subject?: string;
  content: string;
}

export interface SequenceStep {
  id: string;
  stepNumber: number;
  delayDays: number; // e.g. 0 for immediate, 2 for 2 days later, etc.
  title: string;
  channel: FollowUpChannel;
  tone: MessageTone;
  templateSubject?: string;
  templateBody: string;
  aiPromptGuidance?: string;
  variations?: SequenceVariation[];
}

export type SequenceTriggerType = 'tag' | 'lead_stage' | 'manual';

export interface Sequence {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: FollowUpType | 'nurture' | 'recovery' | 'general';
  triggerType: SequenceTriggerType;
  triggerValue?: string; // e.g., 'VIP', 'Lead', 'proposal', 'invoice'
  targetChannel: FollowUpChannel | 'auto';
  isActive: boolean;
  steps: SequenceStep[];
  enrolledCount?: number;
  completedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type SequenceEnrollmentStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface SequenceEnrollmentStepHistory {
  stepNumber: number;
  stepTitle: string;
  channel: FollowUpChannel;
  tone: MessageTone;
  executedAt: string;
  subject?: string;
  content: string;
  notes?: string;
}

export interface SequenceEnrollment {
  id: string;
  userId: string;
  sequenceId: string;
  sequenceName: string;
  contactId: string;
  contactName: string;
  contactCompany?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  followUpId?: string;
  followUpTitle?: string;
  amount?: number;
  dealValue?: number;
  currency?: string;
  currentStepNumber: number; // 1-indexed
  totalSteps: number;
  status: SequenceEnrollmentStatus;
  nextStepDueAt: string; // ISO date string YYYY-MM-DD
  nextStepChannel: FollowUpChannel;
  nextStepTitle: string;
  history: SequenceEnrollmentStepHistory[];
  createdAt: string;
  updatedAt: string;
}

export type AnalyticsDateRange = '7d' | '14d' | '30d' | '90d' | 'ytd' | 'all';

export interface AnalyticsFilterState {
  dateRange: AnalyticsDateRange;
  followUpType: string; // 'all' or specific FollowUpType
  channel: string; // 'all' or specific FollowUpChannel
  tag: string; // 'all' or specific ContactTag
}

export interface ChannelPerformanceMetric {
  channel: FollowUpChannel;
  label: string;
  total: number;
  completed: number;
  conversionRate: number;
  avgResponseHours: number;
  recoveredRevenue: number;
}

export interface TypePerformanceMetric {
  type: FollowUpType;
  label: string;
  total: number;
  completed: number;
  conversionRate: number;
  avgDaysToClose: number;
  totalAmount: number;
  recoveredAmount: number;
}

export interface ActivityTimelinePoint {
  date: string;
  label: string;
  created: number;
  contacted: number;
  completed: number;
  revenue: number;
}

export interface TonePerformanceMetric {
  tone: MessageTone;
  label: string;
  count: number;
  successRate: number;
}

export interface AdvancedAnalyticsData {
  totalFollowUps: number;
  completedCount: number;
  cancelledCount: number;
  pendingCount: number;
  overdueCount: number;
  overallSuccessRate: number;
  avgDaysToClose: number;
  totalMoneyWaiting: number;
  totalMoneyRecovered: number;
  moneyAtRisk: number; // overdue > 7 days
  channelMetrics: ChannelPerformanceMetric[];
  typeMetrics: TypePerformanceMetric[];
  timelineData: ActivityTimelinePoint[];
  toneMetrics: TonePerformanceMetric[];
  sequencesStats: {
    activeSequencesCount: number;
    enrolledContactsCount: number;
    stepsExecutedCount: number;
    sequenceCompletionRate: number;
  };
}

export interface AnalyticsEvent {
  eventName: string;
  userId?: string;
  properties?: Record<string, any>;
  timestamp: string;
}

export interface SmartSummaryPriorityAction {
  id?: string;
  contactId?: string;
  rank: 1 | 2 | 3;
  badge: string;
  contactName: string;
  contactCompany?: string;
  actionTitle: string;
  reason: string;
  financialImpact?: string;
  channel: FollowUpChannel;
  urgency: 'urgent' | 'high' | 'medium';
  recommendedMessageHook?: string;
}

export interface SmartSummaryResult {
  headline: string;
  overview: string;
  totalPendingCount: number;
  totalAtStake: number;
  currency: string;
  topActions: SmartSummaryPriorityAction[];
  tacticalAdvice: string;
  generatedAt: string;
}

