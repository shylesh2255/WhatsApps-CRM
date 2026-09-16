-- Support ticket enhancements: priority, category, SLA due date,
-- assignment to a platform-support agent, attachments, and a fuller
-- status lifecycle (waiting_customer / closed added to open/in_progress/
-- resolved).
ALTER TABLE public.support_requests
  DROP CONSTRAINT IF EXISTS support_requests_status_check;
ALTER TABLE public.support_requests
  ADD CONSTRAINT support_requests_status_check CHECK (
    status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')
  );

ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.support_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_request_comments ENABLE ROW LEVEL SECURITY;

-- Comment visibility follows the parent ticket: the ticket's own
-- customer (any member of that account) or the author themself.
-- Platform-owner access to any ticket's comments goes through the
-- service-role client in the admin API route (requirePlatformOwner),
-- same as the parent ticket's own admin-update policy.
DROP POLICY IF EXISTS support_request_comments_read ON public.support_request_comments;
CREATE POLICY support_request_comments_read ON public.support_request_comments FOR SELECT TO authenticated
  USING (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.support_requests r
      WHERE r.id = support_request_comments.request_id
        AND is_account_member(r.account_id)
    )
  );

DROP POLICY IF EXISTS support_request_comments_insert ON public.support_request_comments;
CREATE POLICY support_request_comments_insert ON public.support_request_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_requests r
      WHERE r.id = support_request_comments.request_id
        AND is_account_member(r.account_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_support_request_comments_request ON public.support_request_comments(request_id, created_at);

-- Attachments live in a private bucket, one folder per account (same
-- pattern as the `products` bucket) so a tenant can only read/write its
-- own ticket attachments; the platform-owner admin route reads through
-- the service-role client, which bypasses storage RLS entirely.
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "account_members_can_read_support_attachments" ON storage.objects;
CREATE POLICY "account_members_can_read_support_attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND is_account_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "account_members_can_upload_support_attachments" ON storage.objects;
CREATE POLICY "account_members_can_upload_support_attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND is_account_member((storage.foldername(name))[1]::uuid)
  );
