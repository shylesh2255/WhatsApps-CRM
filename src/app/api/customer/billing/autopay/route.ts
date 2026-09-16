import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { createRazorpayPlan, createRazorpaySubscription } from '@/lib/billing/razorpay';
import { supabaseAdmin } from '@/lib/flows/admin-client';

// Starts autopay enrollment: gets-or-creates the Razorpay Plan for this
// billing plan, creates a Razorpay Subscription (the recurring mandate),
// and a local `customer_subscriptions` row linked to it. The customer
// then authorizes the mandate client-side via Razorpay Checkout using
// the returned subscriptionId — see /api/customer/billing/verify-autopay
// for what happens after they complete that.
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { planId?: unknown } | null;
    if (typeof body?.planId !== 'string') return NextResponse.json({ error: 'planId is required' }, { status: 400 });

    const admin = supabaseAdmin();
    const { data: plan } = await admin
      .from('billing_plans')
      .select('id, name, monthly_price, currency, chat_limit, razorpay_plan_id')
      .eq('id', body.planId)
      .eq('active', true)
      .maybeSingle();
    if (!plan || plan.currency !== 'INR') return NextResponse.json({ error: 'An active INR plan is required' }, { status: 400 });
    if (Number(plan.monthly_price) === 0) return NextResponse.json({ error: 'Free plans do not need autopay' }, { status: 403 });

    let razorpayPlanId = plan.razorpay_plan_id;
    if (!razorpayPlanId) {
      const created = await createRazorpayPlan({ name: plan.name, amount: Number(plan.monthly_price), currency: plan.currency });
      razorpayPlanId = created.id;
      await admin.from('billing_plans').update({ razorpay_plan_id: razorpayPlanId }).eq('id', plan.id);
    }

    const razorpaySubscription = await createRazorpaySubscription({
      planId: razorpayPlanId,
      notes: { accountId: ctx.accountId, userId: ctx.userId, planName: plan.name },
    });

    const start = new Date();
    const { data: subscription, error: subscriptionError } = await admin
      .from('customer_subscriptions')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount: plan.monthly_price,
        currency: plan.currency,
        chat_limit: plan.chat_limit,
        duration_days: 30,
        start_date: start.toISOString(),
        expiry_date: start.toISOString(),
        payment_status: 'pending',
        status: 'payment_pending',
        auto_renew: true,
        autopay_enabled: true,
        autopay_status: razorpaySubscription.status,
        razorpay_subscription_id: razorpaySubscription.id,
      })
      .select('id')
      .single();
    if (subscriptionError) throw subscriptionError;

    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      subscriptionId: razorpaySubscription.id,
      localSubscriptionId: subscription.id,
      plan: { name: plan.name, amount: plan.monthly_price },
    });
  } catch (error) { return toErrorResponse(error); }
}
