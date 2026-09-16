import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

// Starts an impersonation session: mints a one-time magic-link token for
// the target customer that the browser exchanges client-side via
// supabase.auth.verifyOtp(). This never touches or exposes the
// customer's actual password — the platform owner authenticates as them
// through Supabase's own passwordless flow, same mechanism as "forgot
// password" links.
export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requirePlatformOwner();
    const { userId } = await params;

    if (userId === ctx.userId) {
      return NextResponse.json({ error: 'You cannot impersonate yourself' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    const { data: target } = await admin.from('profiles').select('user_id, full_name, email, account_role').eq('user_id', userId).maybeSingle();
    if (!target?.email) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: link, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: target.email,
    });
    if (error || !link?.properties?.hashed_token) {
      return NextResponse.json({ error: error?.message ?? 'Unable to start impersonation session' }, { status: 400 });
    }

    await admin.from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      target_user_id: userId,
      action: 'impersonation_started',
      details: { targetEmail: target.email, targetName: target.full_name },
    });

    return NextResponse.json({
      tokenHash: link.properties.hashed_token,
      targetName: target.full_name || target.email,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return toErrorResponse(error); }
}

// Called after the browser has restored the platform owner's own
// session, to close out the audit trail for this impersonation.
export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requirePlatformOwner();
    const { userId } = await params;
    const body = (await request.json().catch(() => null)) as { startedAt?: unknown } | null;
    await ctx.supabase.from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      target_user_id: userId,
      action: 'impersonation_ended',
      details: { startedAt: typeof body?.startedAt === 'string' ? body.startedAt : null },
    });
    return NextResponse.json({ success: true });
  } catch (error) { return toErrorResponse(error); }
}
