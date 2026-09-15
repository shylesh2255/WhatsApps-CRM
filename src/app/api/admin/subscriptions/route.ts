import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const admin = supabaseAdmin();
    const { data: subscriptions, error } = await admin
      .from('customer_subscriptions')
      .select(
        'id, user_id, plan_name, start_date, expiry_date, amount, currency, duration_days, payment_status, status, auto_renew'
      )
      .order('expiry_date', { ascending: true });
    if (error) throw error;
    const userIds = [
      ...new Set(
        (subscriptions ?? []).map((subscription) => subscription.user_id)
      ),
    ];
    const { data: profiles, error: profilesError } = userIds.length
        ? await admin
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profileByUserId = new Map(
      (profiles ?? []).map((profile) => [profile.user_id, profile])
    );
    const subscriptionIds = (subscriptions ?? []).map(
      (subscription) => subscription.id
    );
    const { data: payments, error: paymentsError } = subscriptionIds.length
        ? await admin
          .from('customer_payments')
          .select('id, subscription_id, status, payment_method, payment_id')
          .in('subscription_id', subscriptionIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (paymentsError) throw paymentsError;
    const paymentBySubscription = new Map<string, (typeof payments)[number]>();
    for (const payment of payments ?? [])
      if (
        payment.subscription_id &&
        !paymentBySubscription.has(payment.subscription_id)
      )
        paymentBySubscription.set(payment.subscription_id, payment);
    return NextResponse.json({
      subscriptions: (subscriptions ?? []).map((subscription) => ({
        ...subscription,
        profiles: profileByUserId.get(subscription.user_id) ?? null,
        latest_payment: paymentBySubscription.get(subscription.id) ?? null,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as {
      userId?: unknown;
      planName?: unknown;
      amount?: unknown;
      durationDays?: unknown;
      paymentStatus?: unknown;
      autoRenew?: unknown;
    } | null;
    if (typeof body?.userId !== 'string' || typeof body?.planName !== 'string')
      return NextResponse.json(
        { error: 'userId and planName are required' },
        { status: 400 }
      );
    const durationDays =
      typeof body.durationDays === 'number' && body.durationDays > 0
        ? Math.floor(body.durationDays)
        : 30;
    const start = new Date();
    const expiry = new Date(start.getTime() + durationDays * 86400000);
    const paymentStatus = body.paymentStatus === 'paid' ? 'paid' : 'pending';
    const { data: plan } = await ctx.supabase
      .from('billing_plans')
      .select('id, name, monthly_price, currency, chat_limit')
      .eq('name', body.planName.trim())
      .eq('active', true)
      .maybeSingle();
    const { data, error } = await ctx.supabase
      .from('customer_subscriptions')
      .insert({
        account_id: ctx.accountId,
        user_id: body.userId,
        plan_id: plan?.id ?? null,
        plan_name: plan?.name ?? body.planName.trim(),
        amount: plan
          ? plan.monthly_price
          : typeof body.amount === 'number'
            ? body.amount
            : 0,
        currency: plan?.currency ?? 'INR',
        chat_limit: plan?.chat_limit ?? null,
        duration_days: durationDays,
        start_date: start.toISOString(),
        expiry_date: expiry.toISOString(),
        payment_status: paymentStatus,
        status: paymentStatus === 'paid' ? 'active' : 'payment_pending',
        auto_renew: body.autoRenew === true,
        created_by: ctx.userId,
      })
      .select()
      .single();
    if (error) throw error;
    await ctx.supabase
      .from('audit_logs')
      .insert({
        account_id: ctx.accountId,
        actor_user_id: ctx.userId,
        target_user_id: body.userId,
        action: 'subscription_assigned',
        details: { subscriptionId: data.id },
      });
    return NextResponse.json({ subscription: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
