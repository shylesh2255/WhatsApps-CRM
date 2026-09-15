import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { getStripe } from '@/lib/billing/stripe';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
    const supabase = getAdminClient();

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;
      if (session.metadata?.account_id && session.customer && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(supabase, session.metadata.account_id, subscription);
      }
    }

    if (event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata.account_id;
      if (accountId) await upsertSubscription(supabase, accountId, subscription);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[billing webhook]', error);
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 });
  }
}

async function upsertSubscription(
  supabase: ReturnType<typeof getAdminClient>,
  accountId: string,
  subscription: Stripe.Subscription,
) {
  const item = subscription.items.data[0];
  await supabase.from('account_subscriptions').upsert({
    account_id: accountId,
    stripe_customer_id: typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: item?.price.id ?? null,
    status: subscription.status,
    current_period_end: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'account_id' });
}