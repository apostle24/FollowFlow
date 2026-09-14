import { sendResendEmailServer } from '../../../../src/server/resendService';

/**
 * Next.js App Router API Route: /api/email/send
 * Dispatches real emails via Resend REST API server-side.
 * Secret keys and recipient delivery are never handled client-side.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await sendResendEmailServer(body);

    const status = result.success ? 200 : (result.statusCode || 422);
    return new Response(JSON.stringify(result), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, status: 'failed', error: err.message || 'Delivery failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
