-- ============================================================
-- 076_contact_consent.sql — Opt-out tracking + last-inbound timestamp.
--
-- Nothing currently records that a contact asked to stop being
-- messaged, and nothing distinguishes "last message in either
-- direction" (conversations.last_message_at, bumped on every send)
-- from "last message we actually received" — the second is what a
-- 24h WhatsApp session-window warning needs.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

-- Extends bump_conversation_on_inbound (037_webhook_broadcast_reliability.sql)
-- to also stamp last_inbound_at, reusing the single call site already
-- wired into the inbound webhook path rather than adding a second RPC.
CREATE OR REPLACE FUNCTION public.bump_conversation_on_inbound(
  p_conversation_id UUID,
  p_last_message_text TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE conversations
  SET unread_count      = COALESCE(unread_count, 0) + 1,
      last_message_text = p_last_message_text,
      last_message_at   = NOW(),
      last_inbound_at   = NOW(),
      updated_at        = NOW()
  WHERE id = p_conversation_id;
$$;
