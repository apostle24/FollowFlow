import { initializePaystackTransaction } from '../../../../src/server/paystackService';

/**
 * Next.js App Router API Route: /api/paystack/initialize
 * Handles secure server-side Paystack transaction initialization.
 * No sensitive API keys (PAYSTACK_SECRET_KEY) are ever exposed to the client.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, userId, callbackUrl, planCode } = body || {};

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User email and userId are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await initializePaystackTransaction({
      email,
      userId,
      callbackUrl,
      planCode,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Payment initialization failed.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
