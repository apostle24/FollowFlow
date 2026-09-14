import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'followflow-6690f',
  });
}

function getDb() {
  return getFirestore();
}

/**
 * Firebase Function: paystackVerify
 * Secure HTTPS endpoint for verifying Paystack payment reference and activating Pro subscription.
 */
export const paystackVerify = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { reference, userId } = req.body || {};
  if (!reference || !userId) {
    res.status(400).json({ error: 'Reference and userId are required.' });
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
    return;
  }

  try {
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = (await paystackRes.json()) as any;

    if (!paystackRes.ok || !data.status) {
      res.status(400).json({ error: data?.message || 'Paystack verification failed.' });
      return;
    }

    const tx = data.data;
    if (tx.status !== 'success') {
      res.status(400).json({ error: `Transaction status is '${tx.status}', not successful.` });
      return;
    }

    const metadataUserId = tx.metadata?.userId || tx.metadata?.user_id;
    if (metadataUserId && metadataUserId !== userId) {
      res.status(403).json({ error: 'Transaction metadata does not match authenticated user.' });
      return;
    }

    const db = getDb();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscriptionData = {
      plan: 'pro',
      status: 'active_pro',
      amount: (tx.amount || 0) / 100,
      currency: tx.currency || 'USD',
      paystackCustomerCode: tx.customer?.customer_code || '',
      paystackSubscriptionCode: tx.plan || '',
      paystackTransactionReference: tx.reference,
      paystackAuthorizationCode: tx.authorization?.authorization_code || '',
      startedAt: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Update user doc and subcollection in Firestore
    await db.doc(`users/${userId}/subscription/current`).set(subscriptionData, { merge: true });
    await db.doc(`users/${userId}`).set(
      {
        plan: 'pro',
        subscriptionStatus: 'active_pro',
        updatedAt: now.toISOString(),
      },
      { merge: true }
    );

    // Idempotency record
    await db.collection('processed_payments').doc(String(tx.reference)).set(
      {
        reference: String(tx.reference),
        userId,
        amount: (tx.amount || 0) / 100,
        currency: tx.currency || 'USD',
        channel: tx.channel || 'card',
        paidAt: tx.paid_at || now.toISOString(),
        processedAt: now.toISOString(),
        source: 'firebase_function_verify',
      },
      { merge: true }
    );

    res.json({
      success: true,
      status: 'active_pro',
      subscription: subscriptionData,
      transaction: {
        reference: tx.reference,
        amount: (tx.amount || 0) / 100,
        currency: tx.currency,
        paidAt: tx.paid_at,
      },
    });
  } catch (err: any) {
    console.error('Paystack verify error in Firebase Function:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

/**
 * Firebase Function: paystackWebhook
 * Validates HMAC SHA-512 signature on incoming Paystack webhook events.
 */
export const paystackWebhook = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).send('PAYSTACK_SECRET_KEY not configured');
    return;
  }

  const signature = req.headers['x-paystack-signature'] as string;
  if (!signature) {
    res.status(401).send('Missing signature header');
    return;
  }

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const hash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');

  if (hash !== signature) {
    res.status(400).send('Invalid signature');
    return;
  }

  const event = req.body;
  const eventData = event?.data;
  const userId =
    eventData?.metadata?.userId ||
    eventData?.metadata?.user_id ||
    eventData?.customer?.metadata?.userId;

  if (!userId) {
    res.status(200).json({ status: 'ignored_no_user' });
    return;
  }

  const db = getDb();
  const reference = eventData?.reference || eventData?.id;

  if (event.event === 'charge.success') {
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.doc(`users/${userId}/subscription/current`).set(
      {
        plan: 'pro',
        status: 'active_pro',
        amount: (eventData.amount || 0) / 100,
        currency: eventData.currency || 'USD',
        paystackTransactionReference: reference,
        currentPeriodEnd: periodEnd.toISOString(),
        updatedAt: now.toISOString(),
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

    if (reference) {
      await db.collection('processed_payments').doc(String(reference)).set(
        {
          reference: String(reference),
          userId,
          amount: (eventData.amount || 0) / 100,
          currency: eventData.currency || 'USD',
          channel: eventData.channel || 'card',
          processedAt: now.toISOString(),
          source: 'paystack_webhook',
        },
        { merge: true }
      );
    }
  }

  res.status(200).json({ status: 'ok', received: event.event });
});

/**
 * Firebase Function: resendSendEmail
 * HTTPS endpoint for sending real-time emails via Resend REST API.
 */
export const resendSendEmail = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { to, subject, body, userId, contactId, followUpId, attachments } = req.body || {};
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'to, subject, and body are required.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'RESEND_API_KEY is not configured.' });
    return;
  }

  const from = process.env.EMAIL_FROM || 'FollowFlow <onboarding@resend.dev>';

  try {
    const payload: any = {
      from,
      to: [to.trim()],
      subject: subject.trim(),
      text: body,
      html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        ${body.replace(/\n/g, '<br/>')}
      </div>`,
    };

    if (attachments && Array.isArray(attachments)) {
      payload.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content,
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;
    if (!response.ok) {
      res.status(422).json({ success: false, error: data?.message || 'Resend rejected email.' });
      return;
    }

    // Log message to Firestore and update contact/follow-up records
    if (userId) {
      const db = getDb();
      await db.collection(`users/${userId}/messages`).add({
        recipient: to,
        subject,
        message: body,
        status: 'sent',
        provider: 'resend',
        providerMessageId: data.id,
        timestamp: new Date().toISOString(),
        userId,
        contactId: contactId || '',
        followUpId: followUpId || '',
      });

      if (contactId) {
        await db.doc(`users/${userId}/contacts/${contactId}`).set(
          {
            lastContacted: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      if (followUpId) {
        await db.doc(`users/${userId}/followUps/${followUpId}`).set(
          {
            status: 'completed',
            completedAt: new Date().toISOString(),
            sentAt: new Date().toISOString(),
            channel: 'email',
            providerMessageId: data.id,
            deliveryProvider: 'resend',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }

    res.json({
      success: true,
      status: 'sent',
      provider: 'resend',
      providerMessageId: data.id,
      to,
      sentAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Delivery failed.' });
  }
});

/**
 * Firebase Function: paystackInitialize
 * Secure HTTPS endpoint for initializing Paystack checkout sessions server-side.
 * Secret keys are strictly handled on the server.
 */
export const paystackInitialize = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { email, userId, callbackUrl, planCode } = req.body || {};
  if (!email || !userId) {
    res.status(400).json({ error: 'User email and userId are required.' });
    return;
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
    return;
  }

  try {
    const currency = process.env.BILLING_CURRENCY || 'GHS';
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

    if (callbackUrl) payload.callback_url = callbackUrl;
    if (planCode || process.env.PAYSTACK_PRO_PLAN_CODE) {
      payload.plan = planCode || process.env.PAYSTACK_PRO_PLAN_CODE;
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

    if ((!response.ok || !data.status) && payload.plan) {
      delete payload.plan;
      const fallbackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const fallbackData = (await fallbackResponse.json()) as any;
      if (fallbackResponse.ok && fallbackData.status) {
        response = fallbackResponse;
        data = fallbackData;
      }
    }

    if (!response.ok || !data.status) {
      res.status(400).json({ error: data?.message || 'Failed to initialize Paystack checkout.' });
      return;
    }

    res.json({
      success: true,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Payment initialization failed.' });
  }
});
