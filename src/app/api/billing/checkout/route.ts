import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { getStripe } from '@/lib/billing/stripe';

export async function POST() {
  try {
    const ctx = await getCurrentAccount();
    const priceId = process.env.STRIPE_PRICE_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!priceId || !appUrl) {
      return NextResponse.json(
        { error: 'Billing is not configured. Set STRIPE_PRICE_ID and NEXT_PUBLIC_APP_URL.' },
        { status: 503 },
      );
    }

    const stripe = getStripe();
    const { data: subscription } = await ctx.supabase
      .from('account_subscriptions')
      .select('stripe_customer_id')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: subscription?.stripe_customer_id ?? undefined,
      customer_email: subscription?.stripe_customer_id ? undefined : undefined,
      success_url: `${appUrl}/settings?tab=billing&checkout=success`,
      cancel_url: `${appUrl}/settings?tab=billing&checkout=cancelled`,
      client_reference_id: ctx.accountId,
      metadata: { account_id: ctx.accountId },
      subscription_data: { metadata: { account_id: ctx.accountId } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toErrorResponse(error);
  }
}