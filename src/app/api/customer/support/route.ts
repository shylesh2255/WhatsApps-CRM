import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { computeSlaDueAt } from '@/lib/support/sla';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from('support_requests')
      .select('id, subject, message, status, priority, category, created_at, updated_at')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { message?: unknown; subject?: unknown; category?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'A support message is required' }, { status: 400 });
    const subject = typeof body?.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'Payment support';
    const category = typeof body?.category === 'string' ? body.category.trim() || null : null;
    const { data, error } = await ctx.supabase
      .from('support_requests')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        subject,
        message,
        category,
        sla_due_at: computeSlaDueAt('medium'),
      })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ requestId: data.id }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
