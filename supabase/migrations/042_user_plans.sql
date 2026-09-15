CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  chat_limit INTEGER,
  contact_limit INTEGER,
  product_limit INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_plans
  (slug, name, monthly_price, currency, chat_limit, contact_limit, product_limit)
VALUES
  ('free', 'Free', 0, 'USD', 100, 500, 10),
  ('starter', 'Starter', 10, 'USD', 1000, 5000, 100),
  ('growth', 'Growth', 25, 'USD', 5000, 20000, NULL),
  ('unlimited', 'Unlimited', 50, 'USD', NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES billing_plans(id),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_can_view_active_plans"
  ON billing_plans FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "users_can_view_own_subscription"
  ON user_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "account_admins_can_view_subscriptions"
  ON user_subscriptions FOR SELECT TO authenticated
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY "account_admins_can_manage_subscriptions"
  ON user_subscriptions FOR ALL TO authenticated
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_account_id
  ON user_subscriptions(account_id);