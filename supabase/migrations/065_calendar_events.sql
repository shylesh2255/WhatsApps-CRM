-- Calendar: meetings, calls, follow-ups and reminders, optionally linked
-- to a lead, contact or deal. Distinct from `tasks` (checklist-style
-- work items) — this is schedule/time-based.
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting', 'call', 'follow_up', 'reminder', 'other')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_events_select" ON calendar_events;
CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "calendar_events_insert" ON calendar_events;
CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "calendar_events_update" ON calendar_events;
CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS "calendar_events_delete" ON calendar_events;
CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE INDEX IF NOT EXISTS idx_calendar_events_account_id ON calendar_events(account_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_at ON calendar_events(account_id, start_at);
