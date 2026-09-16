-- Platform-wide sponsor/ad banners, shown only to viewer-role users
-- across every customer account. Managed exclusively by the platform
-- owner (see src/lib/auth/platform-owner.ts) via a service-role-backed
-- admin API — there is deliberately no INSERT/UPDATE/DELETE RLS policy
-- for the authenticated role, so only that API (which bypasses RLS
-- after checking requirePlatformOwner()) can write these rows. SELECT
-- is open to any authenticated user since every viewer, in any tenant,
-- needs to read active ads.
CREATE TABLE IF NOT EXISTS public.ad_banners (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_banners_read_active" ON public.ad_banners;
CREATE POLICY "ad_banners_read_active" ON public.ad_banners FOR SELECT TO authenticated
  USING (active = true);

CREATE INDEX IF NOT EXISTS idx_ad_banners_active ON public.ad_banners(active, position);

-- Ad images live in a public bucket (they're meant to be visible),
-- one folder per banner id. Reads are public; writes go through the
-- service-role admin API only (no storage RLS insert/update policy
-- for the authenticated role, matching the table above).
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-banners', 'ad-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "anyone_can_view_ad_banner_images" ON storage.objects;
CREATE POLICY "anyone_can_view_ad_banner_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-banners');
