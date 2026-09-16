-- DB-level backstops for the format/range gaps found in the field
-- validation audit. Client-side checks (src/lib/validation/format.ts)
-- handle the UX; these constraints are what actually stops a direct
-- Supabase/API call with malformed data, since most CRM forms write
-- straight from the browser to these tables (no server route to
-- re-validate in between).

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_value_non_negative;
ALTER TABLE public.deals
  ADD CONSTRAINT deals_value_non_negative CHECK (value >= 0);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_non_negative CHECK (price >= 0);

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_expected_value_non_negative;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_expected_value_non_negative CHECK (expected_value IS NULL OR expected_value >= 0);

ALTER TABLE public.quotation_items
  DROP CONSTRAINT IF EXISTS quotation_items_ranges;
ALTER TABLE public.quotation_items
  ADD CONSTRAINT quotation_items_ranges CHECK (
    quantity >= 0 AND unit_price >= 0
    AND discount_percent BETWEEN 0 AND 100
    AND tax_percent BETWEEN 0 AND 100
  );

ALTER TABLE public.crm_invoice_items
  DROP CONSTRAINT IF EXISTS crm_invoice_items_ranges;
ALTER TABLE public.crm_invoice_items
  ADD CONSTRAINT crm_invoice_items_ranges CHECK (
    quantity >= 0 AND unit_price >= 0
    AND discount_percent BETWEEN 0 AND 100
    AND tax_percent BETWEEN 0 AND 100
  );

-- Overpayment guard: amount_paid can never exceed the invoice total.
-- record-payment-dialog.tsx now also clamps client-side, but this is
-- the real backstop.
ALTER TABLE public.crm_invoices
  DROP CONSTRAINT IF EXISTS crm_invoices_amount_paid_bounds;
ALTER TABLE public.crm_invoices
  ADD CONSTRAINT crm_invoices_amount_paid_bounds CHECK (amount_paid >= 0 AND amount_paid <= total);

-- A calendar event can't end before it starts.
ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_end_after_start;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_end_after_start CHECK (end_at IS NULL OR end_at >= start_at);
