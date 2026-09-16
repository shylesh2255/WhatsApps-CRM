import crypto from 'node:crypto';

import { supabaseAdmin } from '@/lib/flows/admin-client';

export function getRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured');
  return { keyId, keySecret };
}

function razorpayAuthHeader() {
  const { keyId, keySecret } = getRazorpayConfig();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function razorpayRequest<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Razorpay ${path} request failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T;
}

export async function createRazorpayOrder(amount: number, receipt: string) {
  return razorpayRequest<{ id: string; amount: number; currency: string }>('orders', {
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt,
  });
}

// Plans are immutable in Razorpay once created — callers create one per
// billing_plans row and cache the id (billing_plans.razorpay_plan_id)
// rather than creating a new Plan on every subscribe.
export async function createRazorpayPlan(params: {
  name: string;
  amount: number;
  currency: string;
}): Promise<{ id: string }> {
  return razorpayRequest<{ id: string }>('plans', {
    period: 'monthly',
    interval: 1,
    item: {
      name: params.name,
      amount: Math.round(params.amount * 100),
      currency: params.currency,
    },
  });
}

// `total_count: 120` = up to 10 years of monthly cycles — Razorpay
// requires a finite count, there's no "forever" option; the mandate
// still renews automatically each cycle until then, or until the
// customer/admin cancels it.
export async function createRazorpaySubscription(params: {
  planId: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; short_url: string; status: string }> {
  return razorpayRequest<{ id: string; short_url: string; status: string }>('subscriptions', {
    plan_id: params.planId,
    customer_notify: 1,
    total_count: 120,
    notes: params.notes ?? {},
  });
}

export async function cancelRazorpaySubscription(subscriptionId: string): Promise<void> {
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cancel_at_cycle_end: 0 }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Razorpay subscription cancel failed (${response.status}): ${detail}`);
  }
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

// Subscriptions checkout signs `payment_id|subscription_id` instead of
// `order_id|payment_id` — a different field order than the one-time
// order flow above (see Razorpay's Subscriptions verification docs).
export function verifySubscriptionCheckoutSignature(paymentId: string, subscriptionId: string, signature: string) {
  const { keySecret } = getRazorpayConfig();
  return signaturesMatch(crypto.createHmac('sha256', keySecret).update(`${paymentId}|${subscriptionId}`).digest('hex'), signature);
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

/**
 * Runs on the `subscription.charged` webhook — this is the whole point
 * of autopay: no admin click, no customer action, the mandate charges
 * on schedule and this extends access automatically. Idempotent per
 * Razorpay payment id, since Razorpay retries webhook delivery.
 */
export async function activateRazorpaySubscriptionCharge(params: {
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
}) {
  const admin = supabaseAdmin();

  const { data: existingPayment } = await admin
    .from('customer_payments')
    .select('id')
    .eq('razorpay_payment_id', params.razorpayPaymentId)
    .maybeSingle();
  if (existingPayment) return; // already processed this charge

  const { data: subscription, error } = await admin
    .from('customer_subscriptions')
    .select('id, account_id, user_id, expiry_date, duration_days')
    .eq('razorpay_subscription_id', params.razorpaySubscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!subscription) throw new Error(`No local subscription for Razorpay subscription ${params.razorpaySubscriptionId}`);

  const now = new Date();
  const start = subscription.expiry_date && new Date(subscription.expiry_date) > now ? new Date(subscription.expiry_date) : now;
  const expiry = new Date(start.getTime() + Number(subscription.duration_days || 30) * 86400000);

  const { error: subscriptionError } = await admin
    .from('customer_subscriptions')
    .update({
      payment_status: 'paid',
      status: 'active',
      autopay_status: 'active',
      start_date: start.toISOString(),
      expiry_date: expiry.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', subscription.id);
  if (subscriptionError) throw subscriptionError;

  const { error: paymentError } = await admin.from('customer_payments').insert({
    account_id: subscription.account_id,
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    amount: params.amount,
    currency: params.currency,
    payment_method: 'Razorpay Autopay',
    razorpay_payment_id: params.razorpayPaymentId,
    payment_id: params.razorpayPaymentId,
    payment_date: now.toISOString(),
    period_start: start.toISOString(),
    period_end: expiry.toISOString(),
    due_date: expiry.toISOString(),
    status: 'paid',
  });
  if (paymentError) throw paymentError;

  const { error: profileError } = await admin.from('profiles').update({ account_status: 'active' }).eq('user_id', subscription.user_id);
  if (profileError) throw profileError;
}

/**
 * Lifecycle events that don't themselves grant/charge access — just
 * keep `autopay_status` in sync so the admin UI can show *why* a
 * mandate stopped renewing (e.g. `halted` after repeated card
 * declines) instead of the renewal silently not happening. Current
 * access is unaffected: it's still governed by `expiry_date` /
 * `payment_status`, same as manual payments.
 */
export async function syncRazorpaySubscriptionStatus(razorpaySubscriptionId: string, status: string) {
  const admin = supabaseAdmin();
  await admin
    .from('customer_subscriptions')
    .update({ autopay_status: status, updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', razorpaySubscriptionId);
}