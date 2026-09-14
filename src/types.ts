export type ContactTag = 'Lead' | 'Client' | 'Prospect' | 'VIP' | 'Invoice' | 'Proposal' | 'Appointment' | string;

export interface Contact {
  id: string;
  userId: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  project?: string;
  service?: string;
  amount?: number;
  currency?: string;
  preferredChannel?: 'whatsapp' | 'email' | 'sms' | 'phone' | 'manual' | 'other' | 'no_preference';
  timezone?: string;
  communicationConsent?: boolean;
  notes?: string;
  tags?: ContactTag[];
  createdAt: string;
  updatedAt: string;
}

export type FollowUpType = 'lead' | 'proposal' | 'invoice' | 'appointment' | 'customer' | 'general';
export type FollowUpChannel = 'whatsapp' | 'email' | 'sms' | 'phone' | 'manual' | 'other';
export type FollowUpPriority = 'low' | 'medium' | 'high' | 'urgent';
export type FollowUpStatus = 'pending' | 'contacted' | 'completed' | 'snoozed' | 'cancelled';
export type MessageTone = 'friendly' | 'professional' | 'casual' | 'firm' | 'urgent' | 'short' | 'warm';

export interface FollowUpAttachment {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  storagePath?: string;
  fileSize: number;
  downloadUrl?: string;
  contentBase64?: string; // Base64 encoded file for real provider transmission
}

export type UniversalDeliveryChannel = 'email' | 'whatsapp' | 'phone' | 'manual';
export type UniversalDeliveryStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface UniversalFollowUpJob {
  followUpId?: string;
  userId: string;
  contactId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: UniversalDeliveryChannel;
  subject?: string;
  message: string;
  scheduledFor?: string; // ISO 8601 UTC timestamp
  status: UniversalDeliveryStatus;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  provider?: string; // 'resend' | 'gmail' | 'whatsapp_link' | 'tel_protocol' | 'manual_clipboard'
  providerMessageId?: string;
  failureReason?: string;
  attemptCount: number;
  idempotencyKey: string;
  attachments?: FollowUpAttachment[];
}

export interface DeliveryMetrics {
  emailsSentToday: number;
  emailsScheduled: number;
  emailsDelivered: number;
  emailsFailed: number;
  whatsappActions: number;
  callsInitiated: number;
  followUpsCompleted: number;
}

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
  scheduledFor?: string;
  source?: string;
  sequenceId?: string;
  sequenceStepId?: string;
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

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'proposal_sent';

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
  | 'pipeline'
  | 'crm'
  | 'follow-ups'
  | 'sequences'
  | 'analytics'
  | 'templates'
  | 'contacts'
  | 'invoices'
  | 'campaigns'
  | 'knowledge-base'
  | 'capture'
  | 'settings'
  | 'billing'
  | 'pricing';

export type TemplateTaskCategory =
  | 'Proposal Follow-Up'
  | 'Invoice Recovery'
  | 'Cold Lead Revival'
  | 'Appointment Confirmation'
  | 'Customer Check-In'
  | 'Feedback Request'
  | 'Upsell'
  | 'General Follow-Up';

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
  purpose?: string;
  description?: string;
  stage: TemplateStage;
  category: TemplateTaskCategory | string;
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
  | 'snooze_followup'
  | 'open_composer_template';

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

export type TimelineEventType =
  | 'created'
  | 'outreach_sent'
  | 'ai_generated'
  | 'completed'
  | 'snoozed'
  | 'sequence_step'
  | 'note_added'
  | 'lead_created'
  | 'proposal_created'
  | 'followup_created'
  | 'email_scheduled'
  | 'email_sent'
  | 'email_delivered'
  | 'email_failed'
  | 'email_bounced'
  | 'whatsapp_opened'
  | 'call_initiated'
  | 'manual_copied'
  | 'response_received'
  | 'invoice_paid'
  | 'followup_completed';

export interface ContactTimelineEvent {
  id: string;
  contactId: string;
  followUpId?: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  channel?: FollowUpChannel;
  amount?: number;
  currency?: string;
  provider?: string;
  providerMessageId?: string;
  deliveryStatus?: UniversalDeliveryStatus;
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

export type PriorityLevel = 'HIGH PRIORITY' | 'MEDIUM PRIORITY' | 'LOW PRIORITY';

export interface PriorityScoreResult {
  score: number;
  level: PriorityLevel;
  badgeClass: string;
  breakdown: string[];
}

export interface SmartActionRecommendation {
  id: string;
  followUpId?: string;
  contactId?: string;
  contactName: string;
  contactCompany?: string;
  actionTitle: string;
  whyNow: string;
  whatToDo: string;
  recommendedChannel: FollowUpChannel;
  recommendedTone: MessageTone;
  potentialValue: string;
  urgency: 'urgent' | 'high' | 'medium';
  priorityScore: number;
  priorityLevel: PriorityLevel;
  scoreBreakdown: string[];
  type?: FollowUpType | string;
  dueDate?: string;
  recommendedMessageHook?: string;
}

export interface DailyRevenueBrief {
  headline: string;
  overview: string;
  hasInsufficientData: boolean;
  insufficientDataReason?: string;

  // Real aggregated metric counters
  moneyAtRisk: number; // overdue invoices + cold leads + past-due proposals
  outstanding: number; // overdue or pending unpaid invoices
  totalAtStake: number;
  currency: string;

  // Real data categories identified by Flow
  followUpsDueToday: FollowUp[];
  overdueInvoices: FollowUp[];
  unansweredProposals: FollowUp[];
  coldLeads: Lead[];
  highValueOpportunities: FollowUp[];
  upcomingAppointments: Appointment[];
  completedFollowUps: FollowUp[];
  recentlyReceivedResponses: any[];

  // Primary Returns required
  todaysPriorities: SmartActionRecommendation[];
  mostImportantAction: SmartActionRecommendation | null;
  opportunitiesRequiringAttention: SmartActionRecommendation[];

  tacticalAdvice: string;
  generatedAt: string;
}// Re-export Unified Business OS types
export * from './types/businessOs';
