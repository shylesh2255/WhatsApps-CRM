import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const admin = supabaseAdmin();
    const { data: requests, error } = await admin.from('support_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const userIds = [...new Set((requests ?? []).map((request) => request.user_id))];
    const { data: profiles, error: profileError } = userIds.length ? await admin.from('profiles').select('user_id, full_name, email, phone, business_name').in('user_id', userIds) : { data: [], error: null };
    if (profileError) throw profileError;
    const byUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    return NextResponse.json({ requests: (requests ?? []).map((request) => ({ ...request, customer: byUser.get(request.user_id) ?? null })) });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const admin = supabaseAdmin();
    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
    if (typeof body?.id !== 'string' || !['open', 'in_progress', 'resolved'].includes(String(body.status))) return NextResponse.json({ error: 'Request id and valid status are required' }, { status: 400 });
    const { data, error } = await admin.from('support_requests').update({ status: body.status }).eq('id', body.id).select().single();
    if (error) throw error;
    return NextResponse.json({ request: data });
  } catch (error) { return toErrorResponse(error); }
}