-- Product decision: unlike the rest of the write surface (contacts,
-- deals, broadcasts stay agent+), any account member — including
-- viewer — can create/edit/delete automation *definitions*. Running an
-- automation (POST /api/automations/engine) sends real outbound
-- WhatsApp messages and is unaffected — that stays agent+.
--
-- The app's own API routes (src/app/api/automations/*) already enforce
-- this via requireRole('viewer'); this migration keeps the RLS policies
-- (the defense-in-depth backstop for direct Supabase-client writes) in
-- sync with that decision.
DROP POLICY IF EXISTS automations_insert ON automations;
CREATE POLICY automations_insert ON automations FOR INSERT WITH CHECK (is_account_member(account_id));

DROP POLICY IF EXISTS automations_update ON automations;
CREATE POLICY automations_update ON automations FOR UPDATE USING (is_account_member(account_id));

DROP POLICY IF EXISTS automations_delete ON automations;
CREATE POLICY automations_delete ON automations FOR DELETE USING (is_account_member(account_id));
