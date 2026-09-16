import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin');
    const type = new URL(request.url).searchParams.get('type') ?? 'customers';
    const source = type === 'payments' ? 'customer_payments' : type === 'subscriptions' ? 'customer_subscriptions' : 'profiles';
    const { data, error } = await ctx.supabase.from(source).select('*').eq('account_id', ctx.accountId).limit(5000);
    if (error) throw error;
    const rows = data ?? [];
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-report.csv"` } });
  } catch (error) { return toErrorResponse(error); }
}