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
        'id, account_id, user_id, plan_name, start_date, expiry_date, amount, currency, chat_limit, duration_days, payment_status, status, auto_renew'
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
    const accountIds = [...new Set((subscriptions ?? []).map((subscription) => subscription.account_id))];
    const { data: usageRows, error: usageError } = accountIds.length
      ? await admin
          .from('subscription_usage')
          .select('account_id, period_start, period_end, whatsapp_messages_count')
          .in('account_id', accountIds)
          .order('period_start', { ascending: false })
      : { data: [], error: null };
    if (usageError) throw usageError;
    const usageByAccount = new Map<string, (typeof usageRows)[number]>();
    for (const usage of usageRows ?? []) {
      if (!usageByAccount.has(usage.account_id)) usageByAccount.set(usage.account_id, usage);
    }
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
        usage: usageByAccount.get(subscription.account_id) ?? null,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const admin = supabaseAdmin();
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
    const { data: target } = await admin
      .from('profiles')
      .select('user_id, account_id')
      .eq('user_id', body.userId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { data: requestedPlan } = await admin
      .from('billing_plans')
      .select('monthly_price')
      .eq('name', body.planName.trim())
      .eq('active', true)
      .maybeSingle();
    const isFreePlan = Number(requestedPlan?.monthly_price ?? body.amount ?? 0) === 0;
    const expiry = isFreePlan ? null : new Date(start.getTime() + durationDays * 86400000);
    const paymentStatus = isFreePlan || body.paymentStatus === 'paid' ? 'paid' : 'pending';
    const { data: plan } = await admin
      .from('billing_plans')
      .select('id, name, monthly_price, currency, chat_limit')
      .eq('name', body.planName.trim())
      .eq('active', true)
      .maybeSingle();
    const { data, error } = await admin
      .from('customer_subscriptions')
      .insert({
        account_id: target.account_id,
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
        expiry_date: expiry?.toISOString() ?? null,
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
        account_id: target.account_id,
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

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const admin = supabaseAdmin();
    const body = (await request.json().catch(() => null)) as {
      subscriptionId?: unknown;
      action?: unknown;
      days?: unknown;
    } | null;
    if (typeof body?.subscriptionId !== 'string' || !['extend', 'cancel', 'reset_usage'].includes(String(body.action))) {
      return NextResponse.json({ error: 'subscriptionId and a valid action are required' }, { status: 400 });
    }
    const { data: subscription } = await admin
      .from('customer_subscriptions')
      .select('id, account_id, user_id, expiry_date, duration_days')
      .eq('id', body.subscriptionId)
      .maybeSingle();
    if (!subscription) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

    if (body.action === 'reset_usage') {
      const { data: currentUsage } = await admin
        .from('subscription_usage')
        .select('id')
        .eq('account_id', subscription.account_id)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!currentUsage) return NextResponse.json({ success: true });
      const { error } = await admin
        .from('subscription_usage')
        .update({ whatsapp_messages_count: 0 })
        .eq('id', currentUsage.id);
      if (error) throw error;
    } else {
      const days = typeof body.days === 'number' && body.days > 0 ? Math.floor(body.days) : Number(subscription.duration_days) || 30;
      const update = body.action === 'cancel'
        ? { status: 'cancelled' }
        : { status: 'active', expiry_date: new Date(Math.max(subscription.expiry_date ? new Date(subscription.expiry_date).getTime() : 0, Date.now()) + days * 86400000).toISOString() };
      const { error } = await admin.from('customer_subscriptions').update(update).eq('id', subscription.id);
      if (error) throw error;
    }
    await admin.from('audit_logs').insert({ account_id: subscription.account_id, actor_user_id: ctx.userId, target_user_id: subscription.user_id, action: `subscription_${body.action}`, details: { subscriptionId: subscription.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
