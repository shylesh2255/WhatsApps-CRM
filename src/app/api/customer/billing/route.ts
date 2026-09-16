import { NextResponse } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

const DEFAULT_PAYMENT_SETTINGS = {
  payment_account_name: 'SHYLESH MUTHUSAMY',
  payment_bank_name: 'UNION BANK',
  payment_account_number: '618802010009159',
  payment_ifsc: 'UBIN0561886',
  payment_upi_id: 'mshylesh02-2@okicici',
  payment_qr_url: null,
  payment_mobile_number: null,
  pending_payment_access: true,
};

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const [{ data: subscription, error: subscriptionError }, { data: payments, error: paymentsError }, { data: settings, error: settingsError }, { data: usage, error: usageError }] = await Promise.all([
      ctx.supabase.from('customer_subscriptions').select('*').eq('account_id', ctx.accountId).eq('user_id', ctx.userId).order('expiry_date', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from('customer_payments').select('*').eq('account_id', ctx.accountId).eq('user_id', ctx.userId).order('created_at', { ascending: false }),
      ctx.supabase.from('accounts').select('payment_account_name, payment_account_number, payment_ifsc, payment_upi_id, payment_qr_url, payment_mobile_number, pending_payment_access').eq('id', ctx.accountId).single(),
      ctx.supabase.from('subscription_usage').select('period_start, period_end, whatsapp_messages_count').eq('account_id', ctx.accountId).order('period_start', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (subscriptionError) throw subscriptionError;
    if (paymentsError) throw paymentsError;
    if (usageError) throw usageError;
    if (settingsError && settingsError.code !== '42703') throw settingsError;
    return NextResponse.json({ subscription, payments: payments ?? [], settings: settings ?? DEFAULT_PAYMENT_SETTINGS, usage: usage ?? { period_start: null, period_end: null, whatsapp_messages_count: 0 } });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { amount?: unknown; method?: unknown; transactionId?: unknown; paymentDate?: unknown; proofUrl?: unknown } | null;
    if (typeof body?.amount !== 'number' || body.amount <= 0 || typeof body.method !== 'string' || typeof body.transactionId !== 'string' || typeof body.paymentDate !== 'string') return NextResponse.json({ error: 'Amount, method, transaction ID, and payment date are required' }, { status: 400 });
    const { data: subscription } = await ctx.supabase.from('customer_subscriptions').select('id, expiry_date').eq('account_id', ctx.accountId).eq('user_id', ctx.userId).order('expiry_date', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await ctx.supabase.from('customer_payments').insert({ account_id: ctx.accountId, user_id: ctx.userId, subscription_id: subscription?.id ?? null, amount: body.amount, currency: 'INR', payment_date: body.paymentDate, due_date: subscription?.expiry_date ?? null, payment_method: body.method, payment_id: body.transactionId.trim(), proof_url: typeof body.proofUrl === 'string' ? body.proofUrl.trim() || null : null, status: 'pending', period_start: subscription?.expiry_date ?? null }).select().single();
    if (error) throw error;
    if (subscription) await ctx.supabase.from('customer_subscriptions').update({ payment_status: 'pending', status: 'payment_pending', updated_at: new Date().toISOString() }).eq('id', subscription.id).eq('account_id', ctx.accountId);
    return NextResponse.json({ payment: data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}