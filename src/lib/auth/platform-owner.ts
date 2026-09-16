// The single designated operator of this wacrm deployment (see
// supabase/migrations/058_designated_app_owner.sql /
// 059_single_designated_owner.sql). Every tenant account can have its
// own 'owner'/'admin' profile (see POST /api/admin/customers, which lets
// this designated owner grant either role to a newly created customer),
// so `account_role >= 'admin'` alone is NOT sufficient to gate the
// Super-Admin surface (customers/subscriptions/payments/support across
// every tenant) — that must be restricted to this one user specifically.
// Keyed by the immutable auth user id, matching the migrations' approach.
export const PLATFORM_OWNER_USER_ID =
  process.env.PLATFORM_OWNER_USER_ID || '0147e2a1-eaa3-48d6-9169-3d2e378a7798';

// Client-side UX gating only (e.g. hiding nav links) — never a security
// boundary by itself. The real enforcement is `requirePlatformOwner()`
// server-side, keyed by the immutable user id above.
export const PLATFORM_OWNER_EMAIL = 'mshylesh02@gmail.com';
