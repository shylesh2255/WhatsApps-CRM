UPDATE public.billing_plans SET name = 'Plan 1', monthly_price = 0, currency = 'INR', chat_limit = NULL WHERE slug = 'free';
UPDATE public.billing_plans SET name = 'Plan 2', monthly_price = 150, currency = 'INR', chat_limit = 1000 WHERE slug = 'starter';
UPDATE public.billing_plans SET name = 'Plan 3', monthly_price = 350, currency = 'INR', chat_limit = 5000 WHERE slug = 'growth';
UPDATE public.billing_plans SET name = 'Plan 4', monthly_price = 500, currency = 'INR', chat_limit = NULL WHERE slug = 'unlimited';

ALTER TABLE public.customer_subscriptions
  ADD COLUMN IF NOT EXISTS chat_limit INTEGER;