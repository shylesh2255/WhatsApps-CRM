import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET(request: Request) {
  try {
    // Platform-wide export (every tenant's customers/payments/subscriptions,
    // not just the caller's own account) — restricted to the platform owner.
    await requirePlatformOwner();
    const type = new URL(request.url).searchParams.get('type') ?? 'customers';
    const source = type === 'payments' ? 'customer_payments' : type === 'subscriptions' ? 'customer_subscriptions' : 'profiles';
    const { data, error } = await supabaseAdmin().from(source).select('*').limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-report.csv"` } });
  } catch (error) { return toErrorResponse(error); }
}