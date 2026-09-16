-- Admin-controlled customer lifecycle and subscription ledger.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'inactive', 'suspended')),
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date TIMESTAMPTZ NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('paid', 'pending', 'failed', 'overdue', 'refunded')),
  payment_method TEXT,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expiring_soon', 'expired', 'payment_pending', 'payment_failed', 'cancelled', 'suspended')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  payment_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('paid', 'pending', 'failed', 'overdue', 'refunded')),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_subscriptions_read ON public.customer_subscriptions;
CREATE POLICY customer_subscriptions_read ON public.customer_subscriptions FOR SELECT TO authenticated
  USING (is_account_member(account_id));
DROP POLICY IF EXISTS customer_subscriptions_admin ON public.customer_subscriptions;
CREATE POLICY customer_subscriptions_admin ON public.customer_subscriptions FOR ALL TO authenticated
  USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS customer_payments_read ON public.customer_payments;
CREATE POLICY customer_payments_read ON public.customer_payments FOR SELECT TO authenticated
  USING (is_account_member(account_id));
DROP POLICY IF EXISTS customer_payments_admin ON public.customer_payments;
CREATE POLICY customer_payments_admin ON public.customer_payments FOR ALL TO authenticated
  USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS audit_logs_admin_insert ON public.audit_logs;
CREATE POLICY audit_logs_admin_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_account_expiry
  ON public.customer_subscriptions(account_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_customer_payments_account_status
  ON public.customer_payments(account_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_account_created
  ON public.audit_logs(account_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.customer_access_allowed(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_user_id
      AND p.account_status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.customer_subscriptions s
        WHERE s.user_id = p.user_id
          AND s.status IN ('active', 'expiring_soon')
          AND s.payment_status = 'paid'
          AND s.expiry_date > NOW()
      )
  );
$$;