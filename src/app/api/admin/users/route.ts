import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

function temporaryPassword() {
  return `${randomBytes(9).toString('base64url')}Aa1!`;
}

function sanitizeUser(row: Record<string, unknown>) {
  return {
    id: typeof row.user_id === 'string' ? row.user_id : null,
    email: typeof row.email === 'string' ? row.email : null,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    business_name: typeof row.business_name === 'string' ? row.business_name : null,
    company_name: typeof row.business_name === 'string' ? row.business_name : null,
    customer_code: typeof row.customer_code === 'string' ? row.customer_code : null,
    account_role: typeof row.account_role === 'string' ? row.account_role : 'viewer',
    account_status: typeof row.account_status === 'string' ? row.account_status : 'active',
    must_change_password: Boolean(row.must_change_password),
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    last_login_at: typeof row.last_login_at === 'string' ? row.last_login_at : null,
    provider: typeof row.provider === 'string' ? row.provider : null,
  };
}

export async function GET() {
  try {
    const ctx = await requireRole('admin');

    const { data, error } = await ctx.supabase
      .from('profiles')
      .select('user_id, full_name, email, phone, business_name, customer_code, account_role, account_status, must_change_password, last_login_at, created_at')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const adminUsers = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: { users: [] } }));
    const authUsers = new Map(
      (adminUsers.data?.users ?? []).map((user) => [user.id, user]),
    );

    const users = (data ?? []).map((row) => {
      const authUser = authUsers.get(row.user_id);
      return sanitizeUser({
        ...row,
        provider: authUser?.app_metadata?.provider ?? null,
        email: row.email ?? authUser?.email ?? null,
        full_name: row.full_name ?? authUser?.user_metadata?.full_name ?? null,
        created_at: row.created_at ?? authUser?.created_at ?? null,
        last_login_at: row.last_login_at ?? authUser?.last_sign_in_at ?? null,
      });
    });

    return NextResponse.json({ users });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as { userId?: unknown; action?: unknown; accountStatus?: unknown } | null;

    if (body?.action === 'setStatus' && typeof body.userId === 'string' && ['active', 'inactive', 'suspended'].includes(String(body.accountStatus))) {
      const { data: target } = await ctx.supabase
        .from('profiles')
        .select('user_id, account_role')
        .eq('account_id', ctx.accountId)
        .eq('user_id', body.userId)
        .maybeSingle();

      if (!target) {
        return NextResponse.json({ error: 'User is not in your account' }, { status: 404 });
      }

      const { error } = await ctx.supabase
        .from('profiles')
        .update({ account_status: body.accountStatus })
        .eq('account_id', ctx.accountId)
        .eq('user_id', body.userId);
      if (error) throw error;

      await ctx.supabase.from('audit_logs').insert({
        account_id: ctx.accountId,
        actor_user_id: ctx.userId,
        target_user_id: body.userId,
        action: `user_${String(body.accountStatus)}`,
      });

      return NextResponse.json({ success: true, accountStatus: body.accountStatus });
    }

    if (body?.action !== 'resetPassword' || typeof body.userId !== 'string') {
      return NextResponse.json({ error: 'userId and action "resetPassword" are required' }, { status: 400 });
    }

    const { data: target } = await ctx.supabase
      .from('profiles')
      .select('user_id, account_role')
      .eq('account_id', ctx.accountId)
      .eq('user_id', body.userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: 'User is not in your account' }, { status: 404 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
    }

    const password = temporaryPassword();
    const { error } = await supabaseAdmin().auth.admin.updateUserById(body.userId, { password });
    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to reset user password' }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin()
      .from('profiles')
      .update({ must_change_password: true })
      .eq('account_id', ctx.accountId)
      .eq('user_id', body.userId);

    if (profileError) throw profileError;

    await supabaseAdmin().from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      target_user_id: body.userId,
      action: 'user_password_reset',
    });

    return NextResponse.json({ success: true, temporaryPassword: password, userId: body.userId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const PROTECTED_CUSTOMER_CODE = 'CUS-0147E2A1';

export async function DELETE(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const body = (await request.json().catch(() => null)) as { userId?: unknown; confirmText?: unknown } | null;

    if (typeof body?.userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (body.confirmText !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm permanent removal' }, { status: 400 });
    }
    if (body.userId === ctx.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const { data: target } = await ctx.supabase
      .from('profiles')
      .select('user_id, account_role, customer_code')
      .eq('account_id', ctx.accountId)
      .eq('user_id', body.userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: 'User is not in your account' }, { status: 404 });
    }
    if (target.account_role === 'owner') {
      return NextResponse.json({ error: 'The account owner cannot be deleted here' }, { status: 400 });
    }
    if (target.customer_code === PROTECTED_CUSTOMER_CODE) {
      return NextResponse.json({ error: 'This protected user cannot be deleted' }, { status: 400 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
    }

    await supabaseAdmin().from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      target_user_id: body.userId,
      action: 'user_deleted',
    });

    const { error } = await supabaseAdmin().auth.admin.deleteUser(body.userId);
    if (error) {
      return NextResponse.json({ error: error.message || 'Unable to delete user' }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: body.userId });
  } catch (error) {
    return toErrorResponse(error);
  }
}
