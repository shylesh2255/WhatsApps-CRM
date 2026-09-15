import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

const DEFAULT_PAYMENT_SETTINGS = { payment_account_name: 'SHYLESH MUTHUSAMY', payment_bank_name: 'UNION BANK', payment_account_number: '618802010009159', payment_ifsc: 'UBIN0561886', payment_upi_id: 'mshylesh02-2@okicici', payment_qr_url: null, payment_mobile_number: null, pending_payment_access: true };

export async function GET() {
  try {
    const ctx = await requireRole('admin');
    const { data, error } = await ctx.supabase.from('accounts').select('payment_account_name, payment_bank_name, payment_account_number, payment_ifsc, payment_upi_id, payment_qr_url, payment_mobile_number, pending_payment_access').eq('id', ctx.accountId).single();
    if (error && error.code !== '42703') throw error;
    return NextResponse.json({ settings: data ?? DEFAULT_PAYMENT_SETTINGS });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole('owner');
    const body = (await request.json().catch(() => null)) as { accountName?: unknown; bankName?: unknown; accountNumber?: unknown; ifsc?: unknown; upiId?: unknown; qrUrl?: unknown; mobileNumber?: unknown; pendingPaymentAccess?: unknown } | null;
    const { error } = await ctx.supabase.from('accounts').update({ payment_account_name: typeof body?.accountName === 'string' ? body.accountName.trim() : null, payment_bank_name: typeof body?.bankName === 'string' ? body.bankName.trim() : null, payment_account_number: typeof body?.accountNumber === 'string' ? body.accountNumber.trim() : null, payment_ifsc: typeof body?.ifsc === 'string' ? body.ifsc.trim().toUpperCase() : null, payment_upi_id: typeof body?.upiId === 'string' ? body.upiId.trim() : null, payment_qr_url: typeof body?.qrUrl === 'string' ? body.qrUrl.trim() : null, payment_mobile_number: typeof body?.mobileNumber === 'string' ? body.mobileNumber.trim() : null, pending_payment_access: body?.pendingPaymentAccess !== false }).eq('id', ctx.accountId);
    if (error) throw error;
    await ctx.supabase.from('audit_logs').insert({ account_id: ctx.accountId, actor_user_id: ctx.userId, action: 'payment_settings_updated' });
    return NextResponse.json({ success: true });
  } catch (error) { return toErrorResponse(error); }
}