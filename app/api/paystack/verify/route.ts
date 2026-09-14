import { verifyPaystackPaymentServer } from '../../../../src/server/paystackService';

/**
 * Next.js App Router API Route: /api/paystack/verify
 * Handles real server-side Paystack payment verification.
 * No client handles secret keys or transaction state.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reference, userId } = body || {};

    if (!reference || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Reference and userId are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await verifyPaystackPaymentServer({ reference, userId });

    const status = result.success ? 200 : result.status === 'unauthorized' ? 403 : 400;
    return new Response(JSON.stringify(result), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Verification failed.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
