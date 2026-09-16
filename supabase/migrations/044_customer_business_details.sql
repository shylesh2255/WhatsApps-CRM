ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_account_email ON public.profiles(account_id, email);
CREATE INDEX IF NOT EXISTS idx_profiles_gst_number ON public.profiles(gst_number);