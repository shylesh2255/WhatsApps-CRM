ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS customer_code TEXT;

UPDATE public.profiles
SET customer_code = 'CUS-' || upper(substr(replace(user_id::TEXT, '-', ''), 1, 8))
WHERE customer_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN customer_code SET DEFAULT ('CUS-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8)));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_account_customer_code_key
  ON public.profiles(account_id, customer_code)
  WHERE customer_code IS NOT NULL;