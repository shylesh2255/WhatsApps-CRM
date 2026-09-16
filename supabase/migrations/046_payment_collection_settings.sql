ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS payment_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_ifsc TEXT;

ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS payment_details JSONB NOT NULL DEFAULT '{}'::jsonb;