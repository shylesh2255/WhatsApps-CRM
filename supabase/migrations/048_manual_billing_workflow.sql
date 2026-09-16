ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS payment_upi_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_mobile_number TEXT,
  ADD COLUMN IF NOT EXISTS pending_payment_access BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.customer_payments DROP CONSTRAINT IF EXISTS customer_payments_status_check;
ALTER TABLE public.customer_payments ADD CONSTRAINT customer_payments_status_check
  CHECK (status IN ('paid', 'pending', 'failed', 'overdue', 'rejected', 'refunded'));

DROP POLICY IF EXISTS customer_payments_customer_insert ON public.customer_payments;
CREATE POLICY customer_payments_customer_insert ON public.customer_payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_account_member(account_id));

DROP POLICY IF EXISTS customer_payments_customer_update ON public.customer_payments;
CREATE POLICY customer_payments_customer_update ON public.customer_payments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'rejected')
  WITH CHECK (user_id = auth.uid() AND status = 'pending');