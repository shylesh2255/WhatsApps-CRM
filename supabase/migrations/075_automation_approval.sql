-- ============================================================
-- 075_automation_approval.sql — Automation approval workflow.
--
-- 069_viewers_can_manage_automations.sql deliberately let any account
-- member, including viewer, create/edit automation *definitions* —
-- only *running* one (engine route, agent+) sends real messages. But
-- nothing stopped a viewer from setting is_active=true directly on
-- their own automation via PATCH (or the list page's activation
-- Switch, which has no role gate on the toggle itself) — activation
-- had no review step at all. This adds one: a viewer-authored
-- automation starts 'pending' and cannot be active until an agent+
-- approves it; agent+-authored automations are auto-approved, same
-- as today.
-- ============================================================

ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Defense-in-depth backstop (the app routes are the primary gate,
-- but 069 already permits any member to write to this table directly
-- under RLS): an automation can never actually be active while not
-- approved, no matter which path wrote the row.
CREATE OR REPLACE FUNCTION public.enforce_automation_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.approval_status <> 'approved' THEN
    NEW.is_active := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_automation_approval ON automations;
CREATE TRIGGER enforce_automation_approval
  BEFORE INSERT OR UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_automation_approval();

CREATE INDEX IF NOT EXISTS idx_automations_approval_status
  ON automations(approval_status) WHERE approval_status = 'pending';
