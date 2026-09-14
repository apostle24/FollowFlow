// Unified Business Growth Operating System Data Entities & Types

export type UserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'salesperson'
  | 'marketer'
  | 'support'
  | 'custom';

export type SystemPermission =
  | 'crm:read'
  | 'crm:write'
  | 'crm:delete'
  | 'campaign:read'
  | 'campaign:manage'
  | 'opportunity:manage'
  | 'invoice:create'
  | 'invoice:view'
  | 'invoice:manage'
  | 'payment:view'
  | 'payment:manage'
  | 'ai:manage'
  | 'workflow:manage'
  | 'analytics:view'
  | 'settings:manage';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  industry?: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  website?: string;
  settings?: {
    defaultLeadAutoAssign?: boolean;
    defaultAiTone?: string;
    taxRatePercentage?: number;
    invoicePaymentTermsDays?: number;
    emailSenderName?: string;
    emailSenderAddress?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: SystemPermission[];
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export type LifecycleStage =
  | 'visitor'
  | 'lead'
  | 'mql'
  | 'sql'
  | 'opportunity'
  | 'customer'
  | 'advocate'
  | 'churned';

export interface Company {
  id: string;
  orgId: string;
  name: string;
  domain?: string;
  industry?: string;
  employeeCount?: string;
  annualRevenue?: number;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTimelineEvent {
  id: string;
  orgId: string;
  contactId: string;
  type:
    | 'lead_captured'
    | 'ai_conversation'
    | 'message_sent'
    | 'message_received'
    | 'appointment_booked'
    | 'appointment_attended'
    | 'opportunity_created'
    | 'opportunity_stage_changed'
    | 'invoice_created'
    | 'invoice_paid'
    | 'workflow_triggered'
    | 'review_requested'
    | 'review_submitted'
    | 'note_added';
  title: string;
  description: string;
  actor: 'user' | 'system' | 'ai' | 'contact';
  actorName?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  probabilityPercentage: number; // 0 to 100
  color?: string;
}

export interface Pipeline {
  id: string;
  orgId: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface Opportunity {
  id: string;
  orgId: string;
  contactId: string;
  contactName: string;
  companyId?: string;
  companyName?: string;
  pipelineId: string;
  stageId: string;
  title: string;
  value: number;
  currency: string;
  expectedCloseDate?: string;
  status: OpportunityStatus;
  lossReason?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  leadSource?: string;
  campaignId?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export type CampaignObjective =
  | 'lead_generation'
  | 'appointment_booking'
  | 'sales'
  | 'promotions'
  | 'customer_reactivation'
  | 'retention'
  | 'product_launch';

export type CampaignChannel =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'meta_ads'
  | 'google_ads'
  | 'multichannel';

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';

export interface Campaign {
  id: string;
  orgId: string;
  name: string;
  objective: CampaignObjective;
  channel: CampaignChannel;
  status: CampaignStatus;
  budget: number;
  currency: string;
  adSpend: number;
  
  // Funnel Performance Metrics (Spend -> Leads -> Qual -> Deals -> Rev -> ROI)
  impressions: number;
  clicks: number;
  leadsGenerated: number;
  qualifiedLeads: number;
  dealsWon: number;
  revenueGenerated: number;
  
  targetAudience?: string;
  contentHeadline?: string;
  contentBody?: string;
  startDate?: string;
  endDate?: string;
  connectedWorkflowId?: string;
  utmSource?: string;
  utmCampaign?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'cancelled';

export interface Invoice {
  id: string;
  orgId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  companyName?: string;
  opportunityId?: string;
  
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  
  items: InvoiceItem[];
  subtotal: number;
  taxRatePercentage: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  
  notes?: string;
  paymentTerms?: string;
  paymentLinkUrl?: string;
  pdfUrl?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  orgId: string;
  invoiceId?: string;
  contactId: string;
  contactName: string;
  amount: number;
  currency: string;
  paymentMethod: 'stripe' | 'paystack' | 'bank_transfer' | 'cash' | 'credit_card' | 'other';
  transactionReference?: string;
  status: 'successful' | 'pending' | 'failed' | 'refunded';
  notes?: string;
  receiptUrl?: string;
  createdAt: string;
}

export type WorkflowTriggerType =
  | 'lead.created'
  | 'lead.qualified'
  | 'contact.created'
  | 'tag.added'
  | 'appointment.booked'
  | 'appointment.completed'
  | 'appointment.cancelled'
  | 'opportunity.stage_changed'
  | 'opportunity.won'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.overdue'
  | 'payment.received'
  | 'review.received'
  | 'inactivity.detected';

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
}

export type WorkflowActionType =
  | 'send_message'
  | 'ai_qualify_lead'
  | 'create_opportunity'
  | 'update_contact_stage'
  | 'assign_team_member'
  | 'schedule_followup'
  | 'create_invoice'
  | 'request_review'
  | 'trigger_webhook'
  | 'add_tag'
  | 'delay';

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  label: string;
  config: Record<string, any>;
  delayMinutes?: number;
}

export interface Workflow {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: WorkflowTriggerType;
    filters?: Record<string, any>;
  };
  conditions?: WorkflowCondition[];
  actions: WorkflowAction[];
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  orgId: string;
  triggerType: string;
  targetContactId?: string;
  targetEntityId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused';
  currentStepIndex: number;
  logs: {
    stepIndex: number;
    actionType: string;
    status: 'success' | 'failed' | 'skipped';
    output?: any;
    error?: string;
    timestamp: string;
  }[];
  createdAt: string;
  completedAt?: string;
}

export interface KnowledgeBaseDoc {
  id: string;
  orgId: string;
  category: 'company_overview' | 'product_catalog' | 'pricing' | 'faq' | 'policies' | 'objections' | 'scripts';
  title: string;
  content: string;
  tags?: string[];
  lastUpdated: string;
}

export interface CustomerReview {
  id: string;
  orgId: string;
  contactId: string;
  contactName: string;
  rating: number; // 1 to 5
  feedbackText: string;
  platform: 'internal' | 'google' | 'trustpilot' | 'facebook' | 'direct';
  isPublic: boolean;
  status: 'pending' | 'approved' | 'hidden';
  createdAt: string;
}

// Unified Business Event specification for Reactive Bus
export interface BusinessEvent<T = any> {
  id: string;
  orgId: string;
  type:
    | 'lead.created'
    | 'lead.qualified'
    | 'contact.created'
    | 'contact.updated'
    | 'conversation.started'
    | 'message.received'
    | 'message.sent'
    | 'appointment.created'
    | 'appointment.completed'
    | 'opportunity.created'
    | 'opportunity.won'
    | 'opportunity.lost'
    | 'invoice.created'
    | 'invoice.sent'
    | 'invoice.overdue'
    | 'payment.received'
    | 'customer.created'
    | 'campaign.started'
    | 'campaign.completed'
    | 'review.requested'
    | 'review.created'
    | 'ai.escalated';
  payload: T;
  timestamp: string;
  actorId?: string;
  actorType?: 'user' | 'ai' | 'contact' | 'system';
}
