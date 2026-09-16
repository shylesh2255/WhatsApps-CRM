import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { isValidEmail, isValidGstNumber, isValidPhone } from '@/lib/validation/format';

function temporaryPassword() {
  return `${randomBytes(9).toString('base64url')}Aa1!`;
}

export async function GET() {
  try {
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();
    const [{ data: authData, error: authError }, { data: profiles, error: profileError }] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin
      .from('profiles')
      .select('user_id, customer_code, full_name, email, phone, business_name, business_type, gst_number, address, city, state, postal_code, country, account_id, account_role, account_status, must_change_password, last_login_at, created_at')
      .neq('user_id', ctx.userId),
    ]);
    if (authError) throw authError;
    if (profileError) throw profileError;

    const profileByUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    const customers = (authData?.users ?? [])
      .filter((user) => user.id !== ctx.userId)
      .map((user) => {
        const profile = profileByUserId.get(user.id);
        return {
          user_id: user.id,
          customer_code: profile?.customer_code ?? null,
          full_name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
          email: profile?.email ?? user.email ?? null,
          phone: profile?.phone ?? user.phone ?? null,
          business_name: profile?.business_name ?? null,
          company_name: profile?.business_name ?? null,
          business_type: profile?.business_type ?? null,
          gst_number: profile?.gst_number ?? null,
          address: profile?.address ?? null,
          city: profile?.city ?? null,
          state: profile?.state ?? null,
          postal_code: profile?.postal_code ?? null,
          country: profile?.country ?? null,
          account_id: profile?.account_id ?? null,
          account_role: profile?.account_role ?? 'viewer',
          account_status: profile?.account_status ?? 'active',
          must_change_password: profile?.must_change_password ?? false,
          last_login_at: profile?.last_login_at ?? user.last_sign_in_at,
          created_at: profile?.created_at ?? user.created_at,
        };
      });
    return NextResponse.json({ customers });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requirePlatformOwner();
    const body = (await request.json().catch(() => null)) as { email?: unknown; fullName?: unknown; role?: unknown; temporaryPassword?: unknown; phone?: unknown; businessName?: unknown; businessType?: unknown; gstNumber?: unknown; address?: unknown; city?: unknown; state?: unknown; postalCode?: unknown; country?: unknown; planName?: unknown; amount?: unknown; paymentMethod?: unknown; paymentDetails?: unknown; receivedAmount?: unknown; receivedDate?: unknown; autoRenew?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
    const role = body?.role === 'owner' || body?.role === 'admin' ? body.role : 'viewer';
    const paymentMethods = ['UPI', 'Bank Transfer', 'Cash', 'Credit Card', 'Debit Card', 'Razorpay', 'Other'];
    const paymentMethod = typeof body?.paymentMethod === 'string' && paymentMethods.includes(body.paymentMethod) ? body.paymentMethod : null;
    if (!email || !isValidEmail(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    if (phone && !isValidPhone(phone)) return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
    const gstNumber = typeof body?.gstNumber === 'string' ? body.gstNumber.trim() : '';
    if (gstNumber && !isValidGstNumber(gstNumber)) return NextResponse.json({ error: 'Enter a valid GST number (e.g., 22AAAAA0000A1Z5)' }, { status: 400 });

    const password = typeof body?.temporaryPassword === 'string' && body.temporaryPassword.length >= 8
      ? body.temporaryPassword
      : temporaryPassword();
    const admin = supabaseAdmin();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? 'Failed to create customer' }, { status: 400 });

    const customerAccountName = typeof body?.businessName === 'string' && body.businessName.trim()
      ? body.businessName.trim()
      : fullName || email;
    const { data: independentProfile, error: profileError } = await admin.from('profiles').update({
      account_role: role,
      account_status: 'active',
      must_change_password: true,
      phone: phone || null,
      business_name: typeof body?.businessName === 'string' ? body.businessName.trim() : null,
      business_type: typeof body?.businessType === 'string' ? body.businessType.trim() : null,
      gst_number: gstNumber || null,
      address: typeof body?.address === 'string' ? body.address.trim() : null,
      city: typeof body?.city === 'string' ? body.city.trim() : null,
      state: typeof body?.state === 'string' ? body.state.trim() : null,
      postal_code: typeof body?.postalCode === 'string' ? body.postalCode.trim() : null,
      country: typeof body?.country === 'string' ? body.country.trim() : null,
    }).eq('user_id', created.user.id).select('account_id').single();
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }
    if (!independentProfile?.account_id) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: 'Failed to create the customer account' }, { status: 500 });
    }
    const { error: accountError } = await admin.from('accounts').update({ name: customerAccountName }).eq('id', independentProfile.account_id).eq('owner_user_id', created.user.id);
    if (accountError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw accountError;
    }
    await admin.from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      target_user_id: created.user.id,
      action: 'customer_created',
      details: { email, role, independentAccountId: independentProfile.account_id },
    });
    if (typeof body?.planName === 'string' && body.planName.trim()) {
      const { data: plan } = await admin.from('billing_plans').select('id, name, monthly_price, currency, chat_limit').eq('name', body.planName.trim()).eq('active', true).maybeSingle();
      const start = new Date();
      const expiry = plan?.monthly_price === 0 ? null : new Date(start.getTime() + 30 * 86400000);
      const subscriptionAmount = plan ? plan.monthly_price : (typeof body.amount === 'number' ? body.amount : 0);
      const receivedAmount = typeof body.receivedAmount === 'number' ? body.receivedAmount : 0;
      const paymentReceived = receivedAmount >= subscriptionAmount;
      const { data: subscription } = await admin.from('customer_subscriptions').insert({
        account_id: independentProfile.account_id,
        user_id: created.user.id,
        plan_id: plan?.id ?? null,
        plan_name: plan?.name ?? body.planName.trim(),
        amount: subscriptionAmount,
        currency: plan?.currency ?? 'INR',
        chat_limit: plan?.chat_limit ?? null,
        duration_days: 30,
        start_date: start.toISOString(),
        expiry_date: expiry?.toISOString() ?? null,
        payment_method: paymentMethod,
        payment_status: paymentReceived ? 'paid' : 'pending',
        status: paymentReceived ? 'active' : 'payment_pending',
        auto_renew: body.autoRenew === true,
        created_by: ctx.userId,
      }).select('id').single();
      await admin.from('customer_payments').insert({
        account_id: independentProfile.account_id,
        user_id: created.user.id,
        subscription_id: subscription?.id ?? null,
        amount: subscriptionAmount,
        currency: plan?.currency ?? 'INR',
        payment_method: paymentMethod,
        payment_date: paymentReceived ? (typeof body.receivedDate === 'string' ? body.receivedDate : new Date().toISOString()) : null,
        payment_details: body.paymentDetails && typeof body.paymentDetails === 'object' ? body.paymentDetails : {},
        due_date: expiry?.toISOString() ?? null,
        period_start: start.toISOString(),
        period_end: expiry?.toISOString() ?? null,
        status: paymentReceived ? 'paid' : 'pending',
      });
    }
    return NextResponse.json({ customer: { id: created.user.id, email, fullName, role, accountId: independentProfile.account_id }, temporaryPassword }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();
    const body = (await request.json().catch(() => null)) as { userId?: unknown; accountStatus?: unknown; action?: unknown } | null;
    if (body?.action === 'resetPassword' && typeof body.userId === 'string') {
      const { data: target } = await admin.from('profiles').select('user_id').eq('user_id', body.userId).maybeSingle();
      if (!target) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(body.userId, { password });
      if (error) return NextResponse.json({ error: error.message || 'Unable to reset customer password' }, { status: 400 });
      const { error: profileError } = await admin.from('profiles').update({ must_change_password: true }).eq('user_id', body.userId);
      if (profileError) throw profileError;
      await admin.from('audit_logs').insert({ account_id: ctx.accountId, actor_user_id: ctx.userId, target_user_id: body.userId, action: 'customer_password_reset' });
      return NextResponse.json({ temporaryPassword: password, userId: body.userId }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (typeof body?.userId !== 'string' || !['active', 'inactive', 'suspended'].includes(String(body.accountStatus))) {
      return NextResponse.json({ error: 'userId and a valid accountStatus are required' }, { status: 400 });
    }
    const { data: target } = await admin.from('profiles').select('user_id').eq('user_id', body.userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    const { error } = await admin.from('profiles').update({ account_status: body.accountStatus }).eq('user_id', body.userId);
    if (error) throw error;
    await admin.from('audit_logs').insert({ account_id: ctx.accountId, actor_user_id: ctx.userId, target_user_id: body.userId, action: `customer_${body.accountStatus}` });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

const PROTECTED_CUSTOMER_CODE = 'CUS-0147E2A1';

export async function DELETE(request: Request) {
  try {
    const ctx = await requirePlatformOwner();
    const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
    if (typeof body?.userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (body.userId === ctx.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }
    const admin = supabaseAdmin();
    const { data: target } = await admin
      .from('profiles')
      .select('user_id, account_role, customer_code')
      .eq('user_id', body.userId)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    if (target.account_role === 'owner') {
      return NextResponse.json({ error: 'The account owner cannot be deleted here' }, { status: 400 });
    }
    if (target.customer_code === PROTECTED_CUSTOMER_CODE) {
      return NextResponse.json({ error: 'This protected customer cannot be deleted' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' }, { status: 500 });
    }
    await admin.from('audit_logs').insert({
      account_id: ctx.accountId,
      actor_user_id: ctx.userId,
      target_user_id: body.userId,
      action: 'customer_deleted',
    });
    const { error } = await admin.auth.admin.deleteUser(body.userId);
    if (error) return NextResponse.json({ error: error.message || 'Unable to delete customer' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}