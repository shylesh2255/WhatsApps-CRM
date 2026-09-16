import { NextResponse } from 'next/server';

import {
  activateRazorpayPayment,
  activateRazorpaySubscriptionCharge,
  syncRazorpaySubscriptionStatus,
  verifyWebhookSignature,
} from '@/lib/billing/razorpay';

interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    payment?: { entity?: { order_id?: string; id?: string; amount?: number; currency?: string } };
    subscription?: { entity?: { id?: string; status?: string } };
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (!signature) return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
  try {
    if (!verifyWebhookSignature(body, signature)) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    const event = JSON.parse(body) as RazorpayWebhookEvent;

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const entity = event.payload?.payment?.entity;
      if (entity?.order_id && entity.id) await activateRazorpayPayment(entity.order_id, entity.id, signature);
    }

    // Recurring autopay charge — the actual "no admin click needed"
    // renewal. Fires once per billing cycle for every active mandate.
    if (event.event === 'subscription.charged') {
      const subscriptionId = event.payload?.subscription?.entity?.id;
      const payment = event.payload?.payment?.entity;
      if (subscriptionId && payment?.id && payment.amount) {
        await activateRazorpaySubscriptionCharge({
          razorpaySubscriptionId: subscriptionId,
          razorpayPaymentId: payment.id,
          amount: payment.amount / 100,
          currency: payment.currency ?? 'INR',
        });
      }
    }

    // Lifecycle events that don't grant access themselves, just keep
    // the mandate's status visible in the admin UI (e.g. `halted` means
    // renewals have stopped and the customer needs to re-authorize).
    if (
      [
        'subscription.activated',
        'subscription.pending',
        'subscription.halted',
        'subscription.cancelled',
        'subscription.completed',
        'subscription.paused',
        'subscription.resumed',
        'subscription.charged.failed',
      ].includes(event.event ?? '')
    ) {
      const entity = event.payload?.subscription?.entity;
      if (entity?.id) {
        await syncRazorpaySubscriptionStatus(entity.id, entity.status ?? event.event!.split('.').pop()!);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[razorpay webhook]', error);
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  }
}
