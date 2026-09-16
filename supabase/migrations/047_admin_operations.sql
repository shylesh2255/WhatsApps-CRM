CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
  read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, subscription_id UUID REFERENCES public.customer_subscriptions(id) ON DELETE SET NULL,
  action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_notifications_read ON public.customer_notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_account_member(account_id, 'admin'));
CREATE POLICY customer_notifications_admin ON public.customer_notifications FOR ALL TO authenticated USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY subscription_history_admin ON public.subscription_history FOR ALL TO authenticated USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
CREATE INDEX IF NOT EXISTS idx_customer_notifications_user ON public.customer_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON public.subscription_history(user_id, created_at DESC);