import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { activateRazorpaySubscriptionCharge, verifySubscriptionCheckoutSignature } from '@/lib/billing/razorpay';

// Completing Razorpay Subscription checkout both authorizes the mandate
// AND charges the first cycle immediately — this activates that first
// charge right away for a fast UX. The `subscription.charged` webhook
// (src/app/api/billing/razorpay/webhook) does the same thing for every
// *later* cycle, and is the actual source of truth (this route is a
// same-request confirmation that's skipped if the browser closes before
// the handler runs — the webhook still lands either way).
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as {
      subscriptionId?: unknown;
      paymentId?: unknown;
      signature?: unknown;
      amount?: unknown;
      currency?: unknown;
    } | null;
    if (
      typeof body?.subscriptionId !== 'string' ||
      typeof body.paymentId !== 'string' ||
      typeof body.signature !== 'string' ||
      typeof body.amount !== 'number' ||
      typeof body.currency !== 'string'
    ) {
      return NextResponse.json({ error: 'Razorpay verification details are required' }, { status: 400 });
    }

    const { data: subscription } = await ctx.supabase
      .from('customer_subscriptions')
      .select('id')
      .eq('razorpay_subscription_id', body.subscriptionId)
      .eq('user_id', ctx.userId)
      .maybeSingle();
    if (!subscription || !verifySubscriptionCheckoutSignature(body.paymentId, body.subscriptionId, body.signature)) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }

    await activateRazorpaySubscriptionCharge({
      razorpaySubscriptionId: body.subscriptionId,
      razorpayPaymentId: body.paymentId,
      amount: body.amount,
      currency: body.currency,
    });

    return NextResponse.json({ success: true });
  } catch (error) { return toErrorResponse(error); }
}
