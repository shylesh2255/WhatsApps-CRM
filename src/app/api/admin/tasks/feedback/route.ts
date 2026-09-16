import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { notifyTaskClient } from '@/lib/tasks/notify';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { taskId?: unknown; rating?: unknown; comment?: unknown } | null;
    if (typeof body?.taskId !== 'string' || typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) return NextResponse.json({ error: 'Task and rating from 1 to 5 are required' }, { status: 400 });
    const { data: task } = await ctx.supabase.from('tasks').select('id, client_user_id, phone_number, task_number').eq('id', body.taskId).eq('account_id', ctx.accountId).eq('status', 'COMPLETED').maybeSingle();
    if (!task) return NextResponse.json({ error: 'Only completed tasks can receive feedback' }, { status: 400 });
    if (ctx.role === 'viewer' && task.client_user_id !== ctx.userId) return NextResponse.json({ error: 'You can only submit feedback for your own task' }, { status: 403 });
    const { data, error } = await ctx.supabase.from('task_feedback').upsert({ account_id: ctx.accountId, task_id: body.taskId, rating: body.rating, comment: typeof body.comment === 'string' ? body.comment.trim() : null }, { onConflict: 'task_id' }).select().single();
    if (error) throw error;
    await notifyTaskClient(ctx.supabase, ctx.accountId, task.phone_number, `Thank you for your feedback for task #${task.task_number}. We received your ${body.rating}/5 rating.`);
    return NextResponse.json({ feedback: data });
  } catch (error) { return toErrorResponse(error); }
}