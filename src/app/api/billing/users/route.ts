import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const { data, error } = await ctx.supabase
      .from('profiles')
      .select('user_id, full_name, email, user_subscriptions(status, plan_id, billing_plans(name, slug))')
      .eq('account_id', ctx.accountId)
      .order('created_at');
    if (error) throw error;
    return NextResponse.json({ users: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json()) as { userId?: unknown; planId?: unknown };
    if (typeof body.userId !== 'string' || typeof body.planId !== 'string') {
      return NextResponse.json({ error: 'userId and planId are required' }, { status: 400 });
    }

    const { data: target } = await ctx.supabase
      .from('profiles')
      .select('user_id')
      .eq('account_id', ctx.accountId)
      .eq('user_id', body.userId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: 'User is not in your account' }, { status: 404 });

    const { data: plan } = await ctx.supabase
      .from('billing_plans')
      .select('id')
      .eq('id', body.planId)
      .eq('active', true)
      .maybeSingle();
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const { error } = await ctx.supabase.from('user_subscriptions').upsert({
      user_id: body.userId,
      account_id: ctx.accountId,
      plan_id: body.planId,
      status: 'active',
      assigned_by: ctx.userId,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}