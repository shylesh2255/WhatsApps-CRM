import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

type BranchBody = {
  id?: unknown;
  name?: unknown;
  code?: unknown;
  address?: unknown;
  phone?: unknown;
  email?: unknown;
  managerUserId?: unknown;
  active?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data: branches, error } = await ctx.supabase
      .from('branches')
      .select('id, name, code, address, phone, email, manager_user_id, active, created_at')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ branches: branches ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as BranchBody | null;
    const name = text(body?.name);
    const code = text(body?.code).toUpperCase();
    if (!name || !code) {
      return NextResponse.json({ error: 'Branch name and code are required' }, { status: 400 });
    }
    const managerUserId = text(body?.managerUserId) || null;
    if (managerUserId) {
      const { data: manager } = await ctx.supabase
        .from('profiles')
        .select('user_id')
        .eq('account_id', ctx.accountId)
        .eq('user_id', managerUserId)
        .maybeSingle();
      if (!manager) return NextResponse.json({ error: 'Manager is not a member of this company' }, { status: 400 });
    }
    const { data, error } = await ctx.supabase
      .from('branches')
      .insert({
        account_id: ctx.accountId,
        name,
        code,
        address: text(body?.address) || null,
        phone: text(body?.phone) || null,
        email: text(body?.email) || null,
        manager_user_id: managerUserId,
        active: body?.active !== false,
      })
      .select()
      .single();
    if (error) throw error;
    await ctx.supabase.from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      action: 'branch_created',
      details: { branchId: data.id, name, code },
    });
    return NextResponse.json({ branch: data }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as BranchBody | null;
    const id = text(body?.id);
    if (!id) return NextResponse.json({ error: 'Branch id is required' }, { status: 400 });
    if (typeof body?.active === 'boolean' && !['owner', 'admin'].includes(ctx.role)) {
      return NextResponse.json({ error: 'Only admins can change branch status' }, { status: 403 });
    }
    const updates: Record<string, unknown> = {};
    if (typeof body?.name === 'string' && text(body.name)) updates.name = text(body.name);
    if (typeof body?.code === 'string' && text(body.code)) updates.code = text(body.code).toUpperCase();
    for (const [input, column] of [['address', 'address'], ['phone', 'phone'], ['email', 'email']] as const) {
      if (typeof body?.[input] === 'string') updates[column] = text(body[input]) || null;
    }
    if (typeof body?.managerUserId === 'string') updates.manager_user_id = text(body.managerUserId) || null;
    if (typeof body?.active === 'boolean') updates.active = body.active;
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No branch changes supplied' }, { status: 400 });
    const { data, error } = await ctx.supabase.from('branches').update(updates).eq('id', id).eq('account_id', ctx.accountId).select().single();
    if (error) throw error;
    await ctx.supabase.from('audit_logs').insert({ account_id: ctx.accountId, actor_user_id: ctx.userId, action: 'branch_updated', details: { branchId: id, updates } });
    return NextResponse.json({ branch: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}