# Products Feature - Setup Guide

You now have a complete Products management system in your app. Here's what was added:

## What Was Created

1. **Database Table** (`supabase/migrations/040_products.sql`)
   - Products table with columns: name, description, price, currency, image_url, category, SKU
   - Row-level security (RLS) enabled
   - Only admins/owners can add/edit products

2. **Sidebar Navigation**
   - Added "Products" menu item in the sidebar
   - Icon: Package

3. **Products Page** (`src/app/(dashboard)/products/page.tsx`)
   - Main page to view and manage products
   - "Add Product" button to create new products

4. **Products Components**
   - `ProductsList`: Displays all products in a table with edit/delete options
   - `ProductForm`: Form to add/edit products with image upload

## Setup Steps

### Step 1: Run the Database Migration
```bash
cd /Users/shylesh/Desktop/wacrm
npx supabase migration up
```

Or push using the Supabase CLI:
```bash
supabase db push
```

### Step 2: Configure Supabase Storage

Migration `040_products.sql` creates the public `products` bucket and its
account-scoped upload, update, and delete policies automatically. No manual
bucket creation is required. If the migration was already applied before the
Storage section was added, run the migration in a new Supabase project or add
the Storage statements from `040_products.sql` through the Supabase SQL editor.

The app stores files at `products/<account-id>/<timestamp>-<filename>` and
saves the generated public URL in `products.image_url`.

### Step 3: Test It Out
1. Go to your app dashboard
2. Click **Products** in the sidebar
3. Click **Add Product**
4. Fill in:
   - Product Name (required)
   - Upload a photo
   - Price
   - Currency (default: INR)
   - Category (optional)
   - SKU (optional)
5. Click **Add Product**

## How to Use Products in Flows

Once you have products stored, you can use them in your WhatsApp automations:

### Example Flow:
1. **Trigger**: Customer sends "Show me shirts"
2. **Action**: Send product name + price + image URL
3. **Image URL Source**: Copy from your Products table

### In Flow Builder:
- Go to **Flows** > **New Flow**
- Set trigger: keyword match ("shirt", "product", etc.)
- Add action: Send message with product details
- Add media: Use the image_url from products table

## Database Structure

```sql
products table:
- id (UUID, primary key)
- account_id (UUID, tenant isolation)
- name (TEXT, required)
- description (TEXT, optional)
- price (NUMERIC)
- currency (TEXT, default: INR)
- image_url (TEXT, Supabase Storage URL)
- category (TEXT, optional)
- sku (TEXT, unique)
- created_at, updated_at (timestamps)
- created_by, updated_by (audit fields)
```

## Permissions
- **Owners/Admins**: Can add, edit, delete products
- **Agents/Viewers**: Can view products only

## Image Hosting
- Images are stored in Supabase Storage (`products` bucket)
- Public URLs are auto-generated
- Max file size: 5MB
- Supported formats: JPEG, PNG, WebP, GIF

That's it! Your products feature is ready to use. 🎉
