import { NextResponse } from 'next/server';

import { activateRazorpayPayment, verifyWebhookSignature } from '@/lib/billing/razorpay';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  if (!signature) return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
  try {
    if (!verifyWebhookSignature(body, signature)) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    const event = JSON.parse(body) as { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const entity = event.payload?.payment?.entity;
      if (entity?.order_id && entity.id) await activateRazorpayPayment(entity.order_id, entity.id, signature);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[razorpay webhook]', error);
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  }
}