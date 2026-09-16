import crypto from 'node:crypto';

import { supabaseAdmin } from '@/lib/flows/admin-client';

export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured');
  return { keyId, keySecret };
}

export async function createRazorpayOrder(amount: number, receipt: string) {
  const { keyId, keySecret } = getRazorpayConfig();
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'INR', receipt }),
  });
  if (!response.ok) throw new Error(`Razorpay order creation failed (${response.status})`);
  return (await response.json()) as { id: string; amount: number; currency: string };
}

function signaturesMatch(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = getRazorpayConfig();
  return signaturesMatch(crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
}

export function verifyWebhookSignature(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  return signaturesMatch(crypto.createHmac('sha256', secret).update(body).digest('hex'), signature);
}

export async function activateRazorpayPayment(orderId: string, paymentId: string, signature: string) {
  const admin = supabaseAdmin();
  const { data: payment, error } = await admin.from('customer_payments').select('id, user_id, subscription_id, status').eq('razorpay_order_id', orderId).maybeSingle();
  if (error) throw error;
  if (!payment) throw new Error('Razorpay order is not associated with a payment');
  if (payment.status === 'paid') return;
  const now = new Date();
  const { error: paymentError } = await admin.from('customer_payments').update({ status: 'paid', payment_id: paymentId, razorpay_payment_id: paymentId, razorpay_signature: signature, payment_date: now.toISOString() }).eq('id', payment.id);
  if (paymentError) throw paymentError;
  if (payment.subscription_id) {
    const { data: subscription } = await admin.from('customer_subscriptions').select('expiry_date, duration_days').eq('id', payment.subscription_id).single();
    if (subscription) {
      const start = new Date(subscription.expiry_date) > now ? new Date(subscription.expiry_date) : now;
      const expiry = new Date(start.getTime() + Number(subscription.duration_days) * 86400000);
      const { error: subscriptionError } = await admin.from('customer_subscriptions').update({ payment_status: 'paid', status: 'active', start_date: start.toISOString(), expiry_date: expiry.toISOString(), updated_at: now.toISOString() }).eq('id', payment.subscription_id);
      if (subscriptionError) throw subscriptionError;
    }
  }
  const { error: profileError } = await admin.from('profiles').update({ account_status: 'active' }).eq('user_id', payment.user_id);
  if (profileError) throw profileError;
}