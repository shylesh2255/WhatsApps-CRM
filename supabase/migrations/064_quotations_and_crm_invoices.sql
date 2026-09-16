-- Generic sales quotations + CRM-side invoicing (distinct from the
-- service-center's job-scoped service_invoices, and distinct from the
-- SaaS billing that bills *this company's own* customers for their
-- wacrm subscription — these bill a tenant's *own* contacts for
-- whatever they sell them, exactly like the master spec's §40 split).
CREATE TABLE IF NOT EXISTS quotations (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired')),
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (account_id, quote_number)
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_invoices (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (account_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS crm_invoice_items (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_payments (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES crm_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  method TEXT,
  transaction_id TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- RLS: same account-scoping pattern as every other tenant table.
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotations_select" ON quotations;
CREATE POLICY "quotations_select" ON quotations FOR SELECT USING (is_account_member(account_id, 'viewer'));
DROP POLICY IF EXISTS "quotations_insert" ON quotations;
CREATE POLICY "quotations_insert" ON quotations FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS "quotations_update" ON quotations;
CREATE POLICY "quotations_update" ON quotations FOR UPDATE USING (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS "quotations_delete" ON quotations;
CREATE POLICY "quotations_delete" ON quotations FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "quotation_items_select" ON quotation_items;
CREATE POLICY "quotation_items_select" ON quotation_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_items.quotation_id AND is_account_member(q.account_id, 'viewer')));
DROP POLICY IF EXISTS "quotation_items_write" ON quotation_items;
CREATE POLICY "quotation_items_write" ON quotation_items FOR ALL
  USING (EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_items.quotation_id AND is_account_member(q.account_id, 'agent')))
  WITH CHECK (EXISTS (SELECT 1 FROM quotations q WHERE q.id = quotation_items.quotation_id AND is_account_member(q.account_id, 'agent')));

DROP POLICY IF EXISTS "crm_invoices_select" ON crm_invoices;
CREATE POLICY "crm_invoices_select" ON crm_invoices FOR SELECT USING (is_account_member(account_id, 'viewer'));
DROP POLICY IF EXISTS "crm_invoices_insert" ON crm_invoices;
CREATE POLICY "crm_invoices_insert" ON crm_invoices FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS "crm_invoices_update" ON crm_invoices;
CREATE POLICY "crm_invoices_update" ON crm_invoices FOR UPDATE USING (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS "crm_invoices_delete" ON crm_invoices;
CREATE POLICY "crm_invoices_delete" ON crm_invoices FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "crm_invoice_items_select" ON crm_invoice_items;
CREATE POLICY "crm_invoice_items_select" ON crm_invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm_invoices i WHERE i.id = crm_invoice_items.invoice_id AND is_account_member(i.account_id, 'viewer')));
DROP POLICY IF EXISTS "crm_invoice_items_write" ON crm_invoice_items;
CREATE POLICY "crm_invoice_items_write" ON crm_invoice_items FOR ALL
  USING (EXISTS (SELECT 1 FROM crm_invoices i WHERE i.id = crm_invoice_items.invoice_id AND is_account_member(i.account_id, 'agent')))
  WITH CHECK (EXISTS (SELECT 1 FROM crm_invoices i WHERE i.id = crm_invoice_items.invoice_id AND is_account_member(i.account_id, 'agent')));

DROP POLICY IF EXISTS "crm_payments_select" ON crm_payments;
CREATE POLICY "crm_payments_select" ON crm_payments FOR SELECT USING (is_account_member(account_id, 'viewer'));
DROP POLICY IF EXISTS "crm_payments_insert" ON crm_payments;
CREATE POLICY "crm_payments_insert" ON crm_payments FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS "crm_payments_delete" ON crm_payments;
CREATE POLICY "crm_payments_delete" ON crm_payments FOR DELETE USING (is_account_member(account_id, 'agent'));

CREATE INDEX IF NOT EXISTS idx_quotations_account_id ON quotations(account_id);
CREATE INDEX IF NOT EXISTS idx_quotations_contact_id ON quotations(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_account_id ON crm_invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_invoices_contact_id ON crm_invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_invoice_items_invoice_id ON crm_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_crm_payments_invoice_id ON crm_payments(invoice_id);
