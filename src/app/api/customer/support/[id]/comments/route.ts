import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;
    const { data: ticket } = await ctx.supabase.from('support_requests').select('id').eq('id', id).eq('account_id', ctx.accountId).maybeSingle();
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const { data, error } = await ctx.supabase
      .from('support_request_comments')
      .select('id, author_user_id, message, created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'A message is required' }, { status: 400 });
    const { data: ticket } = await ctx.supabase.from('support_requests').select('id').eq('id', id).eq('account_id', ctx.accountId).maybeSingle();
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const { data, error } = await ctx.supabase
      .from('support_request_comments')
      .insert({ request_id: id, author_user_id: ctx.userId, message })
      .select('id, author_user_id, message, created_at')
      .single();
    if (error) throw error;
    await ctx.supabase.from('support_requests').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'waiting_customer');
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
