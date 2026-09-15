-- Products table for managing product catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  image_url TEXT,
  -- metadata for easy searching/filtering
  category TEXT,
  sku TEXT UNIQUE,
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Audit
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- RLS: Users can only see products from their account
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_read_own_account_products" ON products;
CREATE POLICY "users_can_read_own_account_products"
  ON products FOR SELECT
  USING (is_account_member(account_id, 'viewer'));

DROP POLICY IF EXISTS "users_can_create_own_account_products" ON products;
CREATE POLICY "users_can_create_own_account_products"
  ON products FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "users_can_update_own_account_products" ON products;
CREATE POLICY "users_can_update_own_account_products"
  ON products FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "users_can_delete_own_account_products" ON products;
CREATE POLICY "users_can_delete_own_account_products"
  ON products FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(account_id, category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(account_id, sku);

-- Product images live in a public bucket. Folder names are account IDs so
-- authenticated users can only write to their own account's folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "authenticated_users_can_view_product_images" ON storage.objects;
CREATE POLICY "authenticated_users_can_view_product_images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "account_members_can_upload_product_images" ON storage.objects;
CREATE POLICY "account_members_can_upload_product_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND is_account_member((storage.foldername(name))[2]::uuid, 'admin')
  );

DROP POLICY IF EXISTS "account_members_can_update_product_images" ON storage.objects;
CREATE POLICY "account_members_can_update_product_images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'products'
    AND is_account_member((storage.foldername(name))[2]::uuid, 'admin')
  );

DROP POLICY IF EXISTS "account_members_can_delete_product_images" ON storage.objects;
CREATE POLICY "account_members_can_delete_product_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'products'
    AND is_account_member((storage.foldername(name))[2]::uuid, 'admin')
  );
