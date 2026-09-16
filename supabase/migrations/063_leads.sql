-- Leads: a distinct pre-qualification entity, separate from Contacts and
-- Deals. A lead gets converted into a Contact (and optionally a Deal)
-- once it's qualified — contact_id/deal_id below record that conversion.
CREATE TABLE IF NOT EXISTS leads (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  company_name TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  alternate_phone TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('website', 'referral', 'whatsapp', 'email', 'phone', 'advertisement', 'social_media', 'manual', 'api')),
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expected_value NUMERIC(12, 2),
  notes TEXT,
  next_follow_up TIMESTAMPTZ,
  -- Set on conversion (see §9 "Convert lead"). Nullable: most leads never convert.
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "leads_insert" ON leads;
CREATE POLICY "leads_insert" ON leads FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "leads_delete" ON leads;
CREATE POLICY "leads_delete" ON leads FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE INDEX IF NOT EXISTS idx_leads_account_id ON leads(account_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(account_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
