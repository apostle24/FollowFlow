import type { FollowUp, Contact, MessageTone, FollowUpChannel, SmartSummaryResult } from '../types';

async function safeParseJsonResponse<T>(response: Response, defaultErrorMessage: string): Promise<T> {
  const text = await response.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}. Please try again.`);
    }
    throw new Error('Unexpected response format from server. Please try again.');
  }

  if (!response.ok) {
    throw new Error(parsed?.error || defaultErrorMessage || `Request failed with status ${response.status}`);
  }

  return parsed as T;
}

export interface GenerateMessageParams {
  contact: Contact | { name: string; company?: string; email?: string; phone?: string; whatsapp?: string };
  followUp?: Partial<FollowUp>;
  tone: MessageTone;
  channel: FollowUpChannel;
  additionalContext?: string;
  userId?: string;
  isPro?: boolean;
  currentCount?: number;
}

export interface GeneratedResponse {
  success: boolean;
  subject?: string;
  message: string;
  fullText: string;
  tone: MessageTone;
  channel: FollowUpChannel;
  isFallback?: boolean;
  errorNotice?: string;
  limitReached?: boolean;
  generationCount?: number;
}

export async function generateFollowUpMessage(params: GenerateMessageParams): Promise<GeneratedResponse> {
  const { contact, followUp, tone, channel, additionalContext, userId, isPro, currentCount } = params;

  // Calculate days overdue if dueDate is present
  let daysOverdue = 0;
  if (followUp?.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(followUp.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    if (diffTime > 0) {
      daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }
  }

  const payload = {
    userId,
    isPro,
    currentCount,
    contactName: contact.name,
    company: contact.company,
    followUpType: followUp?.type || 'general',
    title: followUp?.title || 'Revenue follow up',
    description: followUp?.description || '',
    amount: followUp?.amount,
    currency: followUp?.currency || '$',
    dueDate: followUp?.dueDate,
    daysOverdue,
    tone,
    channel,
    additionalContext: additionalContext || '',
    lastContactDate: followUp?.lastContactedAt,
  };

  const response = await fetch('/api/ai/generate-followup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return safeParseJsonResponse<GeneratedResponse>(
    response,
    'Failed to generate follow-up message'
  );
}

export interface GenerateSequenceStepParams {
  sequenceName: string;
  sequenceCategory?: string;
  stepNumber: number;
  totalSteps?: number;
  delayDays: number;
  stepTitle?: string;
  tone?: MessageTone;
  channel?: FollowUpChannel;
  aiPromptGuidance?: string;
}

export async function generateSequenceStepTemplate(params: GenerateSequenceStepParams): Promise<{
  success: boolean;
  subject?: string;
  templateBody: string;
  isFallback?: boolean;
}> {
  const response = await fetch('/api/ai/generate-sequence-step', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return safeParseJsonResponse(response, 'Failed to generate sequence step template');
}

export interface GenerateSequenceVariationsParams {
  sequenceName: string;
  stepTitle: string;
  baseMessage: string;
  channel?: FollowUpChannel;
}

export async function generateSequenceVariations(params: GenerateSequenceVariationsParams): Promise<{
  success: boolean;
  variations: Array<{
    id?: string;
    tone: MessageTone;
    label: string;
    subject?: string;
    content: string;
  }>;
}> {
  const response = await fetch('/api/ai/generate-sequence-variations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return safeParseJsonResponse(response, 'Failed to generate sequence variations');
}

export interface RecommendationItem {
  title: string;
  impact: 'High' | 'Medium' | 'Quick Win';
  description: string;
  actionText: string;
}

export async function generateAnalyticsRecommendations(params: {
  totalFollowUps: number;
  completedCount: number;
  successRate: number;
  avgDaysToClose: number;
  moneyWaiting: number;
  moneyRecovered: number;
  moneyAtRisk: number;
  topChannel: string;
  overdueCount: number;
  userId?: string;
}): Promise<{ success: boolean; recommendations: RecommendationItem[] }> {
  const response = await fetch('/api/ai/generate-analytics-insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return safeParseJsonResponse(response, 'Failed to generate analytics recommendations');
}

export interface FlowChatParams {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  userId: string;
  contextData: {
    contacts: any[];
    todayFollowUps: any[];
    overdueFollowUps: any[];
    activeFollowUps: any[];
    moneyAtRisk: number;
    outstandingInvoices: number;
    totalFollowUpValue: number;
  };
}

export async function sendFlowChatMessage(params: FlowChatParams): Promise<{
  success: boolean;
  message: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: string;
    pendingAction?: any;
  };
}> {
  const response = await fetch('/api/ai/flow-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return safeParseJsonResponse(response, 'Failed to communicate with Flow assistant');
}

export interface SmartSummaryParams {
  pendingFollowUps: FollowUp[];
  contacts?: Contact[];
  userProfile?: { displayName?: string; email?: string };
}

export async function fetchSmartSummary(params: SmartSummaryParams): Promise<{
  success: boolean;
  isFallback?: boolean;
  summary: SmartSummaryResult;
}> {
  const response = await fetch('/api/ai/smart-summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  return safeParseJsonResponse(response, 'Failed to generate smart summary');
}

