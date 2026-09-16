-- Razorpay recurring payments ("autopay"): a customer authorizes a
-- mandate once (UPI Autopay / card auto-debit, depending on what's
-- enabled on the Razorpay account), and subsequent renewals charge
-- automatically via webhook instead of needing admin approval each
-- cycle. The existing one-time Razorpay Checkout + manual payment
-- flows are untouched — this is purely additive.

-- Cached Razorpay Plan id per billing plan (Razorpay Plans are
-- immutable once created, so we create-once-and-reuse rather than
-- creating a new Plan on every subscribe).
ALTER TABLE public.billing_plans
  ADD COLUMN IF NOT EXISTS razorpay_plan_id TEXT;

ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Mirrors Razorpay's own subscription lifecycle status (created,
  -- authenticated, active, paused, halted, cancelled, completed,
  -- expired) so the admin UI can show *why* autopay isn't charging
  -- without calling out to Razorpay's API.
  ADD COLUMN IF NOT EXISTS autopay_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customer_subscriptions_razorpay_subscription_id_key
  ON public.customer_subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
