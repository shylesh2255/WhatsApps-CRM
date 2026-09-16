import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { activateRazorpayPayment, verifyCheckoutSignature } from '@/lib/billing/razorpay';

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const body = (await request.json().catch(() => null)) as { orderId?: unknown; paymentId?: unknown; signature?: unknown } | null;
    if (typeof body?.orderId !== 'string' || typeof body.paymentId !== 'string' || typeof body.signature !== 'string') return NextResponse.json({ error: 'Razorpay verification details are required' }, { status: 400 });
    const { data: payment } = await ctx.supabase.from('customer_payments').select('id').eq('razorpay_order_id', body.orderId).eq('user_id', ctx.userId).maybeSingle();
    if (!payment || !verifyCheckoutSignature(body.orderId, body.paymentId, body.signature)) return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    await activateRazorpayPayment(body.orderId, body.paymentId, body.signature);
    return NextResponse.json({ success: true });
  } catch (error) { return toErrorResponse(error); }
}