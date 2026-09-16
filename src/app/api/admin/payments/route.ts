import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(request: Request) {
  try {
    await requirePlatformOwner();
    const admin = supabaseAdmin();
    const params = new URL(request.url).searchParams;
    const { data, error } = await admin
      .from('customer_payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const userIds = [
      ...new Set((data ?? []).map((payment) => payment.user_id)),
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
    const payments = (data ?? [])
      .map((payment) => ({
        ...payment,
        profiles: profileByUserId.get(payment.user_id) ?? null,
      }))
      .filter((payment) => {
        const customer =
          `${payment.profiles?.full_name ?? ''} ${payment.profiles?.email ?? ''}`.toLowerCase();
        const paymentDate = payment.payment_date
          ? new Date(payment.payment_date)
          : null;
        const dueDate = payment.due_date ? new Date(payment.due_date) : null;
        const query = params.get('customer')?.toLowerCase();
        return (
          (!query || customer.includes(query)) &&
          (!params.get('status') || payment.status === params.get('status')) &&
          (!params.get('method') ||
            payment.payment_method === params.get('method')) &&
          (!params.get('month') ||
            (paymentDate &&
              paymentDate.getMonth() + 1 === Number(params.get('month')))) &&
          (!params.get('year') ||
            (paymentDate &&
              paymentDate.getFullYear() === Number(params.get('year')))) &&
          (!params.get('dueDate') ||
            (dueDate &&
              dueDate.toISOString().slice(0, 10) === params.get('dueDate')))
        );
      });
    return NextResponse.json({ payments });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformOwner();
    const admin = supabaseAdmin();
    const body = (await request.json().catch(() => null)) as {
      subscriptionId?: unknown;
      amount?: unknown;
      paymentMethod?: unknown;
      reference?: unknown;
      paymentDate?: unknown;
    } | null;
    if (typeof body?.subscriptionId !== 'string')
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      );
    const { data: subscription } = await admin
      .from('customer_subscriptions')
      .select('id, account_id, user_id, amount, currency, start_date, expiry_date')
      .eq('id', body.subscriptionId)
      .maybeSingle();
    if (!subscription)
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    const amount =
      typeof body.amount === 'number' && body.amount >= 0
        ? body.amount
        : Number(subscription.amount);
    const { data, error } = await admin
      .from('customer_payments')
      .insert({
        account_id: subscription.account_id,
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        amount,
        currency: subscription.currency,
        payment_method:
          typeof body.paymentMethod === 'string'
            ? body.paymentMethod.trim() || 'Cash'
            : 'Cash',
        payment_id:
          typeof body.reference === 'string'
            ? body.reference.trim() || null
            : null,
        payment_date:
          typeof body.paymentDate === 'string'
            ? body.paymentDate
            : new Date().toISOString(),
        due_date: subscription.expiry_date,
        period_start: subscription.start_date,
        period_end: subscription.expiry_date,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ payment: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();
    const body = (await request.json().catch(() => null)) as {
      paymentId?: unknown;
      action?: unknown;
      paymentMethod?: unknown;
      reference?: unknown;
      paymentDate?: unknown;
    } | null;
    if (typeof body?.paymentId !== 'string')
      return NextResponse.json(
        { error: 'paymentId is required' },
        { status: 400 }
      );
    const { data: payment } = await admin
      .from('customer_payments')
      .select(
        'id, account_id, user_id, subscription_id, amount, payment_method, payment_id'
      )
      .eq('id', body.paymentId)
      .maybeSingle();
    if (!payment)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    const isReject = body.action === 'reject';
    const { error: paymentError } = await admin
      .from('customer_payments')
      .update({
        status: isReject ? 'rejected' : 'paid',
        payment_date: isReject
          ? null
          : typeof body.paymentDate === 'string'
            ? body.paymentDate
            : new Date().toISOString(),
        payment_method:
          typeof body.paymentMethod === 'string'
            ? body.paymentMethod.trim() || payment.payment_method
            : payment.payment_method,
        payment_id:
          typeof body.reference === 'string'
            ? body.reference.trim() || payment.payment_id
            : payment.payment_id,
      })
      .eq('id', payment.id)
    if (paymentError) throw paymentError;
    if (payment.subscription_id) {
      const { data: subscription } = await admin
        .from('customer_subscriptions')
        .select('expiry_date, duration_days')
        .eq('id', payment.subscription_id)
        .single();
      if (subscription && !isReject) {
        const now = new Date();
        const nextStart =
          new Date(subscription.expiry_date) > now
            ? new Date(subscription.expiry_date)
            : now;
        const nextExpiry = new Date(
          nextStart.getTime() + Number(subscription.duration_days) * 86400000
        );
        const { error: subscriptionError } = await admin
          .from('customer_subscriptions')
          .update({
            payment_status: 'paid',
            status: 'active',
            start_date: nextStart.toISOString(),
            expiry_date: nextExpiry.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', payment.subscription_id)
        if (subscriptionError) throw subscriptionError;
      } else if (isReject) {
        const { error: subscriptionError } = await admin
          .from('customer_subscriptions')
          .update({
            payment_status: 'pending',
            status: 'payment_pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', payment.subscription_id)
        if (subscriptionError) throw subscriptionError;
      }
    }
    if (!isReject) {
      const { error: profileError } = await admin
        .from('profiles')
        .update({ account_status: 'active' })
        .eq('user_id', payment.user_id);
      if (profileError) throw profileError;
    }
    await ctx.supabase
      .from('audit_logs')
      .insert({
        account_id: payment.account_id,
        actor_user_id: ctx.userId,
        target_user_id: payment.user_id,
        action: isReject ? 'payment_rejected' : 'payment_received',
        details: {
          paymentId: payment.id,
          paymentMethod: payment.payment_method,
        },
      });
    return NextResponse.json({
      success: true,
      paymentStatus: isReject ? 'rejected' : 'paid',
      subscriptionActivated: !isReject && Boolean(payment.subscription_id),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
