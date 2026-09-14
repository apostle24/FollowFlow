import { handlePaystackWebhookServer } from '../../../../src/server/paystackService';

/**
 * Next.js App Router API Route: /api/paystack/webhook
 * Handles incoming webhooks from Paystack with HMAC SHA-512 signature validation.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const result = await handlePaystackWebhookServer(
      { 'x-paystack-signature': signature },
      rawBody,
      body
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Paystack webhook error:', err.message);
    return new Response(err.message || 'Webhook processing failed', { status: 400 });
  }
}
