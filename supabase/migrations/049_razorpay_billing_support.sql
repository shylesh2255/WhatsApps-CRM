ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customer_payments_razorpay_order_id_key
  ON public.customer_payments(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_requests_read ON public.support_requests;
CREATE POLICY support_requests_read ON public.support_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS support_requests_customer_insert ON public.support_requests;
CREATE POLICY support_requests_customer_insert ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_account_member(account_id));
DROP POLICY IF EXISTS support_requests_admin_update ON public.support_requests;
CREATE POLICY support_requests_admin_update ON public.support_requests FOR UPDATE TO authenticated
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_support_requests_account_created
  ON public.support_requests(account_id, created_at DESC);