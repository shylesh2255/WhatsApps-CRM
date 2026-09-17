-- ============================================================
-- 077_quiet_hours.sql — Account-level quiet hours for automated sends.
--
-- Applies only to automation-triggered and broadcast sends (never
-- manual agent replies — a human choosing to reply late is a
-- deliberate action, not something to silently block). No job queue
-- exists in this codebase, so a send that would land inside quiet
-- hours is skipped and logged, not deferred — see
-- src/lib/whatsapp/quiet-hours.ts.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
