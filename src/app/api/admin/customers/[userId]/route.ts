import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { isValidGstNumber, isValidPhone } from '@/lib/validation/format';

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requirePlatformOwner();
    const { userId } = await params;
    const admin = supabaseAdmin();
    const [{ data: authUser, error: authError }, { data: customer, error }, { data: subscriptions }, { data: payments }, { data: activity }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('customer_subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      admin.from('customer_payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      admin.from('audit_logs').select('*').eq('target_user_id', userId).order('created_at', { ascending: false }).limit(100),
    ]);
    if (authError) throw authError;
    if (error) throw error;
    if (!authUser?.user) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    const mergedCustomer = {
      ...(customer ?? {}),
      user_id: userId,
      full_name: customer?.full_name ?? authUser.user.user_metadata?.full_name ?? null,
      email: customer?.email ?? authUser.user.email ?? null,
      company_name: customer?.business_name ?? null,
      account_status: customer?.account_status ?? 'active',
    };
    return NextResponse.json({ customer: mergedCustomer, subscriptions: subscriptions ?? [], payments: payments ?? [], activity: activity ?? [] });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();
    const { userId } = await params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const allowed = ['full_name', 'phone', 'business_name', 'business_type', 'gst_number', 'address', 'city', 'state', 'postal_code', 'country', 'account_status'];
    const updates = Object.fromEntries(Object.entries(body ?? {}).filter(([key, value]) => allowed.includes(key) && typeof value === 'string'));
    if (typeof body?.company_name === 'string' && !('business_name' in updates)) {
      updates.business_name = body.company_name.trim();
    }
    if (typeof updates.phone === 'string' && updates.phone.trim() && !isValidPhone(updates.phone)) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
    }
    if (typeof updates.gst_number === 'string' && updates.gst_number.trim() && !isValidGstNumber(updates.gst_number)) {
      return NextResponse.json({ error: 'Enter a valid GST number (e.g., 22AAAAA0000A1Z5)' }, { status: 400 });
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No customer changes supplied' }, { status: 400 });
    const { data: target } = await admin.from('profiles').select('user_id').eq('user_id', userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    const { data: updatedCustomer, error } = await admin.from('profiles').update(updates).eq('user_id', userId).select('*').single();
    if (error) throw error;
    await admin.from('audit_logs').insert({ account_id: ctx.accountId, actor_user_id: ctx.userId, target_user_id: userId, action: 'customer_updated', details: updates });
    return NextResponse.json({ success: true, customer: { ...updatedCustomer, company_name: updatedCustomer.business_name } });
  } catch (error) { return toErrorResponse(error); }
}