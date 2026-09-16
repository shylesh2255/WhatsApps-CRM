import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { createRazorpayOrder } from '@/lib/billing/razorpay';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { planId?: unknown } | null;
    if (typeof body?.planId !== 'string') return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    const { data: plan } = await ctx.supabase.from('billing_plans').select('id, name, monthly_price, currency, chat_limit').eq('id', body.planId).eq('active', true).maybeSingle();
    if (!plan || plan.currency !== 'INR') return NextResponse.json({ error: 'An active INR plan is required' }, { status: 400 });
    if (Number(plan.monthly_price) === 0) return NextResponse.json({ error: 'Plan 1 is free but can only be assigned by an administrator' }, { status: 403 });
    const admin = supabaseAdmin();
    const start = new Date();
    const expiry = new Date(start.getTime() + 30 * 86400000);
    const { data: subscription, error: subscriptionError } = await admin.from('customer_subscriptions').insert({ account_id: ctx.accountId, user_id: ctx.userId, plan_id: plan.id, plan_name: plan.name, amount: plan.monthly_price, currency: plan.currency, chat_limit: plan.chat_limit, duration_days: 30, start_date: start.toISOString(), expiry_date: expiry.toISOString(), payment_status: 'pending', status: 'payment_pending' }).select('id').single();
    if (subscriptionError) throw subscriptionError;
    const order = await createRazorpayOrder(Number(plan.monthly_price), `wacrm_${subscription.id}`);
    const { error: paymentError } = await admin.from('customer_payments').insert({ account_id: ctx.accountId, user_id: ctx.userId, subscription_id: subscription.id, amount: plan.monthly_price, currency: plan.currency, due_date: expiry.toISOString(), period_start: start.toISOString(), period_end: expiry.toISOString(), payment_method: 'Razorpay', razorpay_order_id: order.id, status: 'pending' });
    if (paymentError) throw paymentError;
    return NextResponse.json({ keyId: process.env.RAZORPAY_KEY_ID, order, plan: { name: plan.name, amount: plan.monthly_price } });
  } catch (error) { return toErrorResponse(error); }
}