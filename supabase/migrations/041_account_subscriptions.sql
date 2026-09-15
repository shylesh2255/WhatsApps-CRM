CREATE TABLE IF NOT EXISTS account_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_members_can_view_subscription"
  ON account_subscriptions FOR SELECT
  USING (account_id IN (
    SELECT account_id FROM account_members WHERE profile_id = auth.uid()::uuid
  ));

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account_id
  ON account_subscriptions(account_id);