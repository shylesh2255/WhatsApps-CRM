-- Ad banner slider spec: per-banner title/description/display duration,
-- on top of the existing company_name/image_url/link_url/position.
ALTER TABLE public.ad_banners
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS display_duration_seconds INTEGER NOT NULL DEFAULT 30
    CHECK (display_duration_seconds BETWEEN 3 AND 300);
