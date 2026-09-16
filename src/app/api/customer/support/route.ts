import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'A support message is required' }, { status: 400 });
    const { data, error } = await ctx.supabase.from('support_requests').insert({ account_id: ctx.accountId, user_id: ctx.userId, subject: 'Payment support', message }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ requestId: data.id }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}