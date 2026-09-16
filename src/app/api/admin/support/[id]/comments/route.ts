import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformOwner();
    const { id } = await params;
    const admin = supabaseAdmin();
    const { data, error } = await admin
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
    const ctx = await requirePlatformOwner();
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) return NextResponse.json({ error: 'A message is required' }, { status: 400 });
    const admin = supabaseAdmin();
    const { data: ticket } = await admin.from('support_requests').select('id').eq('id', id).maybeSingle();
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const { data, error } = await admin
      .from('support_request_comments')
      .insert({ request_id: id, author_user_id: ctx.userId, message })
      .select('id, author_user_id, message, created_at')
      .single();
    if (error) throw error;
    await admin.from('support_requests').update({ status: 'waiting_customer', updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
