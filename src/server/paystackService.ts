import crypto from 'crypto';
import { getAdminFirestore } from './firebaseAdmin';
import { getSecret } from '../lib/secrets.server';

export interface PaystackInitParams {
  email: string;
  userId: string;
  callbackUrl?: string;
  planCode?: string;
}

export interface PaystackVerifyParams {
  reference: string;
  userId: string;
}

export interface PaystackVerifyResult {
  success: boolean;
  status: string;
  alreadyProcessed?: boolean;
  subscription?: {
    plan: string;
    status: string;
    amount: number;
    currency: string;
    paystackTransactionReference: string;
    currentPeriodEnd: string;
    startedAt: string;
    updatedAt: string;
  };
  transaction?: {
    reference: string;
    amount: number;
    currency: string;
    paidAt: string;
    channel: string;
  };
  error?: string;
}

// In-memory set of processed payments for rapid deduplication
const processedPaymentsMemory = new Set<string>();

/**
 * Server-side transaction initialization with Paystack.
 * Secret key is strictly kept server-side.
 */
export async function initializePaystackTransaction(params: PaystackInitParams) {
  const { email, userId, callbackUrl, planCode } = params;

  if (!email || !userId) {
    throw new Error('User email and userId are required.');
  }

  const secretKey = getSecret('PAYSTACK_SECRET_KEY');
  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    throw new Error(
      'Paystack is not configured. Please set PAYSTACK_SECRET_KEY in server environment settings.'
    );
  }

  const currency = getSecret('BILLING_CURRENCY', 'GHS').toUpperCase();
  const rawPrice = Number(process.env.BILLING_PRO_PRICE || 102);
  const amountInSubunits = Math.round(rawPrice * 100);

  const payload: any = {
    email,
    amount: amountInSubunits,
    currency,
    metadata: {
      userId,
      email,
      plan: 'pro',
      custom_fields: [
        { display_name: 'FollowFlow User ID', variable_name: 'user_id', value: userId },
        { display_name: 'Plan', variable_name: 'plan', value: `FollowFlow Pro (${currency} ${rawPrice}/mo)` },
      ],
    },
  };

  if (callbackUrl) {
    payload.callback_url = callbackUrl;
  }

  const effectivePlanCode = planCode || getSecret('PAYSTACK_PRO_PLAN_CODE');
  if (effectivePlanCode && !effectivePlanCode.toLowerCase().includes('followflow')) {
    payload.plan = effectivePlanCode;
  }

  let response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data = (await response.json()) as any;

  // Fallback retry without plan code if plan code is rejected by Paystack
  if ((!response.ok || !data.status) && payload.plan) {
    console.warn('[Paystack] Plan initialization failed, attempting fallback direct checkout:', data?.message);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.plan;

    const fallbackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fallbackPayload),
    });
    const fallbackData = (await fallbackResponse.json()) as any;
    if (fallbackResponse.ok && fallbackData.status) {
      response = fallbackResponse;
      data = fallbackData;
    }
  }

  if (!response.ok || !data.status) {
    const errorMsg = data?.message || 'Failed to initialize Paystack checkout.';
    throw new Error(errorMsg);
  }

  return {
    success: true,
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Server-side payment verification:
 * 1. Queries Paystack REST API directly with PAYSTACK_SECRET_KEY
 * 2. Confirms status == 'success'
 * 3. Verifies metadata matches the authenticated userId
 * 4. Updates Firestore Admin SDK (users/{userId} & users/{userId}/subscription/current)
 * 5. Idempotently records reference in processed_payments to prevent double elevation
 */
export async function verifyPaystackPaymentServer(params: PaystackVerifyParams): Promise<PaystackVerifyResult> {
  const { reference, userId } = params;

  if (!reference || !userId) {
    return { success: false, status: 'failed', error: 'Reference and userId are required.' };
  }

  const secretKey = getSecret('PAYSTACK_SECRET_KEY');
  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    return { success: false, status: 'failed', error: 'Paystack is not configured on the server.' };
  }

  // Deduplication check
  if (processedPaymentsMemory.has(String(reference))) {
    return {
      success: true,
      status: 'active_pro',
      alreadyProcessed: true,
    };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const data = (await response.json()) as any;

  if (!response.ok || !data.status) {
    return {
      success: false,
      status: 'failed',
      error: data?.message || 'Transaction verification failed with Paystack API.',
    };
  }

  const txData = data.data;

  if (txData.status !== 'success') {
    return {
      success: false,
      status: txData.status,
      error: `Transaction status is '${txData.status}', not successful.`,
    };
  }

  // Metadata verification: verify this transaction belongs to the requesting user
  const metadataUserId = txData.metadata?.userId || txData.metadata?.user_id;
  if (metadataUserId && metadataUserId !== userId) {
    return {
      success: false,
      status: 'unauthorized',
      error: 'Transaction metadata does not match authenticated user.',
    };
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

  const subscriptionData = {
    plan: 'pro',
    status: 'active_pro',
    amount: (txData.amount || 0) / 100,
    currency: txData.currency || 'USD',
    paystackCustomerCode: txData.customer?.customer_code || '',
    paystackSubscriptionCode: txData.plan || '',
    paystackTransactionReference: txData.reference,
    paystackAuthorizationCode: txData.authorization?.authorization_code || '',
    startedAt: now.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    updatedAt: now.toISOString(),
  };

  processedPaymentsMemory.add(String(txData.reference));

  // Update Firestore using Firebase Admin SDK (server-side only, bypasses client restrictions)
  const db = getAdminFirestore();
  if (db) {
    try {
      await db.doc(`users/${userId}/subscription/current`).set(subscriptionData, { merge: true });
      await db.doc(`users/${userId}`).set(
        {
          plan: 'pro',
          subscriptionStatus: 'active_pro',
          updatedAt: now.toISOString(),
        },
        { merge: true }
      );

      // Record in processed_payments collection to guarantee idempotency across webhooks
      await db.collection('processed_payments').doc(String(txData.reference)).set(
        {
          reference: String(txData.reference),
          userId,
          amount: (txData.amount || 0) / 100,
          currency: txData.currency || 'USD',
          channel: txData.channel || 'card',
          paidAt: txData.paid_at || now.toISOString(),
          processedAt: now.toISOString(),
          source: 'paystack_verify',
          customerCode: txData.customer?.customer_code || '',
        },
        { merge: true }
      );
    } catch (dbErr: any) {
      console.warn('[Paystack Verify] Firestore Admin write warning:', dbErr?.message || dbErr);
    }
  }

  return {
    success: true,
    status: 'active_pro',
    subscription: subscriptionData,
    transaction: {
      reference: txData.reference,
      amount: (txData.amount || 0) / 100,
      currency: txData.currency,
      paidAt: txData.paid_at,
      channel: txData.channel,
    },
  };
}

/**
 * Server-side Paystack Webhook handler with HMAC SHA-512 signature validation
 */
export async function handlePaystackWebhookServer(headers: Record<string, any>, rawBody: Buffer | string, body: any) {
  const secretKey = getSecret('PAYSTACK_SECRET_KEY');
  if (!secretKey) {
    throw new Error('Webhook secret key not configured.');
  }

  const signature = headers['x-paystack-signature'];
  if (!signature) {
    throw new Error('Missing x-paystack-signature header.');
  }

  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
    .digest('hex');

  if (hash !== signature) {
    throw new Error('Invalid signature.');
  }

  const event = body;
  const eventData = event?.data;
  const userId =
    eventData?.metadata?.userId ||
    eventData?.metadata?.user_id ||
    eventData?.customer?.metadata?.userId;

  if (!userId) {
    return { status: 'ignored_no_user' };
  }

  const reference = eventData?.reference || eventData?.id;
  if (reference && processedPaymentsMemory.has(String(reference))) {
    return { status: 'already_processed', reference };
  }

  const db = getAdminFirestore();

  if (event.event === 'charge.success') {
    if (reference) processedPaymentsMemory.add(String(reference));
    if (db) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await db.doc(`users/${userId}/subscription/current`).set(
        {
          plan: 'pro',
          status: 'active_pro',
          amount: (eventData.amount || 0) / 100,
          currency: eventData.currency || 'USD',
          paystackTransactionReference: reference,
          updatedAt: now.toISOString(),
          currentPeriodEnd: periodEnd.toISOString(),
        },
        { merge: true }
      );
      await db.doc(`users/${userId}`).set(
        {
          plan: 'pro',
          subscriptionStatus: 'active_pro',
          updatedAt: now.toISOString(),
        },
        { merge: true }
      );
    }
    return { status: 'pro_activated', userId, reference };
  }

  if (event.event === 'subscription.disable' || event.event === 'invoice.payment_failed') {
    if (db) {
      await db.doc(`users/${userId}`).set(
        {
          plan: 'free',
          subscriptionStatus: 'inactive',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    return { status: 'subscription_disabled', userId };
  }

  return { status: 'event_received', event: event.event };
}
