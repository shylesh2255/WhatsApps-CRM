import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { computeSlaDueAt, type TicketPriority } from '@/lib/support/sla';

const STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export async function GET() {
  try {
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();
    const { data: requests, error } = await admin.from('support_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const userIds = [...new Set((requests ?? []).map((request) => request.user_id))];
    const assigneeIds = [...new Set((requests ?? []).map((request) => request.assigned_to).filter(Boolean))];
    const [{ data: profiles, error: profileError }, { data: assignees }, { data: agents }] = await Promise.all([
      userIds.length ? admin.from('profiles').select('user_id, full_name, email, phone, business_name').in('user_id', userIds) : Promise.resolve({ data: [], error: null }),
      assigneeIds.length ? admin.from('profiles').select('id, full_name, email').in('id', assigneeIds) : Promise.resolve({ data: [] }),
      // Support agents = members of the platform owner's own account (your team).
      admin.from('profiles').select('id, full_name, email').eq('account_id', ctx.accountId),
    ]);
    if (profileError) throw profileError;
    const byUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    const byAssignee = new Map((assignees ?? []).map((a) => [a.id, a]));

    return NextResponse.json({
      requests: (requests ?? []).map((request) => ({
        ...request,
        customer: byUser.get(request.user_id) ?? null,
        assignee: request.assigned_to ? (byAssignee.get(request.assigned_to) ?? null) : null,
      })),
      agents: agents ?? [],
    });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformOwner();
    const admin = supabaseAdmin();
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      status?: unknown;
      priority?: unknown;
      category?: unknown;
      assignedTo?: unknown;
    } | null;
    if (typeof body?.id !== 'string') return NextResponse.json({ error: 'Request id is required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) {
      if (!STATUSES.includes(String(body.status))) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      updates.status = body.status;
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority as TicketPriority)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
      updates.priority = body.priority;
      updates.sla_due_at = computeSlaDueAt(body.priority as TicketPriority);
    }
    if (body.category !== undefined) {
      updates.category = typeof body.category === 'string' ? body.category.trim() || null : null;
    }
    if (body.assignedTo !== undefined) {
      updates.assigned_to = typeof body.assignedTo === 'string' && body.assignedTo ? body.assignedTo : null;
    }
    if (Object.keys(updates).length === 1) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });

    const { data, error } = await admin.from('support_requests').update(updates).eq('id', body.id).select().single();
    if (error) throw error;
    return NextResponse.json({ request: data });
  } catch (error) { return toErrorResponse(error); }
}
