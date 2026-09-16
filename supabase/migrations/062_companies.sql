-- Companies: a proper account entity for the free-text `contacts.company`
-- field, so a company can be viewed/managed independently of any one
-- contact and multiple contacts can be linked to the same company record.
CREATE TABLE IF NOT EXISTS companies (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  email TEXT,
  phone TEXT,
  gst_number TEXT,
  address TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "companies_insert" ON companies;
CREATE POLICY "companies_insert" ON companies FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "companies_update" ON companies;
CREATE POLICY "companies_update" ON companies FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "companies_delete" ON companies;
CREATE POLICY "companies_delete" ON companies FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE INDEX IF NOT EXISTS idx_companies_account_id ON companies(account_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(account_id, name);

-- Link contacts to a company record. The existing free-text
-- `contacts.company` column stays untouched (still shown/editable as a
-- fallback for contacts not yet linked to a company row) — this FK is
-- additive, not a replacement/migration of that column.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
