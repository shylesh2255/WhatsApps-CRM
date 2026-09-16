import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { notifyTaskClient } from '@/lib/tasks/notify';

type TaskBody = { id?: unknown; title?: unknown; clientName?: unknown; phoneNumber?: unknown; description?: unknown; branchId?: unknown; assignedTo?: unknown; priority?: unknown; dueDate?: unknown; notes?: unknown; status?: unknown };
const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const;
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function notification(task: { task_number: number; title: string; status: string }) {
  const feedback = task.status === 'COMPLETED' && process.env.NEXT_PUBLIC_GOOGLE_FEEDBACK_FORM_URL
    ? ` Please share your feedback: ${process.env.NEXT_PUBLIC_GOOGLE_FEEDBACK_FORM_URL}?task=${task.task_number}`
    : '';
  const request = task.status === 'COMPLETED' ? ' Please reply with a rating from 1 to 5 and your feedback.' : '';
  return `Task update: #${task.task_number} ${task.title} is now ${task.status.replace('_', ' ')}.${request}${feedback}`;
}

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data: profile, error: profileError } = await ctx.supabase.from('profiles').select('business_name').eq('user_id', ctx.userId).maybeSingle();
    if (profileError) throw profileError;
    const displayCompanyName = profile?.business_name?.trim() || ctx.account.name;
    const { data, error } = await ctx.supabase.from('tasks').select('*, branches(name)').eq('account_id', ctx.accountId).order('created_at', { ascending: false });
    if (error) throw error;
    const creatorIds = [...new Set((data ?? []).map((task) => task.created_by).filter((id): id is string => Boolean(id)))];
    const { data: creators, error: creatorsError } = creatorIds.length
      ? await ctx.supabase.from('profiles').select('user_id, full_name, email').in('user_id', creatorIds)
      : { data: [], error: null };
    if (creatorsError) throw creatorsError;
    const creatorById = new Map((creators ?? []).map((creator) => [creator.user_id, creator]));
    return NextResponse.json({
      company_name: displayCompanyName,
      tasks: (data ?? []).map((task) => ({
        ...task,
        company_name: task.client_company_name || displayCompanyName,
        created_by_name: task.created_by ? creatorById.get(task.created_by)?.full_name ?? creatorById.get(task.created_by)?.email ?? 'Admin user' : 'Admin user',
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as TaskBody | null;
    const { data: profile } = await ctx.supabase.from('profiles').select('full_name, phone, business_name').eq('user_id', ctx.userId).maybeSingle();
    const isClientSubmission = ctx.role === 'viewer';
    const title = text(body?.title); const clientName = isClientSubmission ? text(body?.clientName) || text(profile?.full_name) : text(body?.clientName); const phoneNumber = isClientSubmission ? text(body?.phoneNumber) || text(profile?.phone) : text(body?.phoneNumber); const description = text(body?.description);
    if (!title || !clientName || !phoneNumber || !description) return NextResponse.json({ error: 'Title, client name, phone number, and description are required' }, { status: 400 });
    const branchId = text(body?.branchId);
    if (!branchId) return NextResponse.json({ error: 'Branch ID is required' }, { status: 400 });
    const { data: branch } = await ctx.supabase.from('branches').select('id').eq('id', branchId).eq('account_id', ctx.accountId).maybeSingle();
    if (!branch) return NextResponse.json({ error: 'Branch is not part of this company' }, { status: 400 });
    if (body?.priority && !priorities.includes(body.priority as typeof priorities[number])) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    const { data: task, error } = await ctx.supabase.from('tasks').insert({ account_id: ctx.accountId, title, client_name: clientName, phone_number: phoneNumber, description, branch_id: branchId, assigned_to: text(body?.assignedTo) || null, priority: body?.priority ?? 'NORMAL', due_date: text(body?.dueDate) || null, notes: text(body?.notes) || null, created_by: ctx.userId, client_user_id: isClientSubmission ? ctx.userId : null, client_company_name: isClientSubmission ? text(profile?.business_name) || ctx.account.name : null }).select().single();
    if (error) throw error;
    await ctx.supabase.from('task_status_history').insert({ account_id: ctx.accountId, task_id: task.id, new_status: 'PENDING', changed_by: ctx.userId });
    await notifyTaskClient(ctx.supabase, ctx.accountId, phoneNumber, notification(task));
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as TaskBody | null;
    const id = text(body?.id);
    if (!id || !statuses.includes(body?.status as typeof statuses[number])) return NextResponse.json({ error: 'Task id and valid status are required' }, { status: 400 });
    const { data: current } = await ctx.supabase.from('tasks').select('id, task_number, title, phone_number, status').eq('id', id).eq('account_id', ctx.accountId).maybeSingle();
    if (!current) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    const nextStatus = body.status as typeof statuses[number];
    const { data: task, error } = await ctx.supabase.from('tasks').update({ status: nextStatus, completed_at: nextStatus === 'COMPLETED' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id).eq('account_id', ctx.accountId).select().single();
    if (error) throw error;
    if (current.status !== nextStatus) {
      await ctx.supabase.from('task_status_history').insert({ account_id: ctx.accountId, task_id: id, previous_status: current.status, new_status: nextStatus, changed_by: ctx.userId });
      await notifyTaskClient(ctx.supabase, ctx.accountId, current.phone_number, notification(task));
    }
    return NextResponse.json({ task });
  } catch (error) { return toErrorResponse(error); }
}