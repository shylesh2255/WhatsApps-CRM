-- Service Center foundation. `accounts` is the company/tenant boundary.

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  manager_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, code)
);

CREATE TABLE IF NOT EXISTS public.branch_members (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.service_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.service_customers(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  model TEXT,
  device_type TEXT,
  serial_number TEXT,
  imei TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (account_id, name)
);

CREATE TABLE IF NOT EXISTS public.service_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.service_customers(id) ON DELETE RESTRICT,
  device_id UUID NOT NULL REFERENCES public.service_devices(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  ticket_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'READY', 'WAITING_FOR_DELIVERY', 'DELIVERED', 'NOT_READY', 'CANCELLED', 'REPEATED')),
  service_type TEXT NOT NULL DEFAULT 'PAID' CHECK (service_type IN ('PAID', 'FREE')),
  service_mode TEXT NOT NULL DEFAULT 'IN_SHOP' CHECK (service_mode IN ('IN_SHOP', 'ON_SITE')),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  estimated_cost NUMERIC NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  advance_payment NUMERIC NOT NULL DEFAULT 0 CHECK (advance_payment >= 0),
  intake_notes TEXT,
  internal_notes TEXT,
  tracking_token TEXT NOT NULL UNIQUE DEFAULT md5(random()::TEXT || clock_timestamp()::TEXT),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, ticket_number)
);

CREATE TABLE IF NOT EXISTS public.service_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.service_jobs(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  service_id UUID NOT NULL REFERENCES public.service_jobs(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.service_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.service_invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'OTHER')),
  reference TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  services_count INTEGER NOT NULL DEFAULT 0 CHECK (services_count >= 0),
  whatsapp_messages_count INTEGER NOT NULL DEFAULT 0 CHECK (whatsapp_messages_count >= 0),
  employee_count INTEGER NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  UNIQUE (account_id, period_start)
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['branches', 'branch_members', 'service_customers', 'service_devices', 'service_categories', 'service_jobs', 'service_status_history', 'service_invoices', 'service_invoice_payments', 'subscription_usage']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_account_access ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_account_access ON public.%I FOR ALL TO authenticated USING (is_account_member(account_id)) WITH CHECK (is_account_member(account_id))', table_name, table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_branches_account ON public.branches(account_id);
CREATE INDEX IF NOT EXISTS idx_branch_members_user ON public.branch_members(user_id);
CREATE INDEX IF NOT EXISTS idx_service_customers_account_phone ON public.service_customers(account_id, phone);
CREATE INDEX IF NOT EXISTS idx_service_devices_customer ON public.service_devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_account_status ON public.service_jobs(account_id, status);
CREATE INDEX IF NOT EXISTS idx_service_jobs_branch_status ON public.service_jobs(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_service_status_history_service ON public.service_status_history(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_invoices_account_status ON public.service_invoices(account_id, status);