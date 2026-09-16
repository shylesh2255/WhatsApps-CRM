-- The ad_banners *table* is written only through the service-role admin
-- API (see 071_ad_banners.sql), but the banner *image* is uploaded
-- directly from the browser to Storage via the client SDK — which
-- respects Storage RLS and had no write policy at all, so every upload
-- was rejected. Scoped to the platform owner's immutable user id,
-- matching the same designated-owner pattern as
-- 058_designated_app_owner.sql / src/lib/auth/platform-owner.ts.
DROP POLICY IF EXISTS "platform_owner_can_upload_ad_banner_images" ON storage.objects;
CREATE POLICY "platform_owner_can_upload_ad_banner_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ad-banners'
    AND auth.uid() = '0147e2a1-eaa3-48d6-9169-3d2e378a7798'
  );

DROP POLICY IF EXISTS "platform_owner_can_update_ad_banner_images" ON storage.objects;
CREATE POLICY "platform_owner_can_update_ad_banner_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ad-banners'
    AND auth.uid() = '0147e2a1-eaa3-48d6-9169-3d2e378a7798'
  );

DROP POLICY IF EXISTS "platform_owner_can_delete_ad_banner_images" ON storage.objects;
CREATE POLICY "platform_owner_can_delete_ad_banner_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ad-banners'
    AND auth.uid() = '0147e2a1-eaa3-48d6-9169-3d2e378a7798'
  );
