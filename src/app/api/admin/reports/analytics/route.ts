import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastNMonths(n: number): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
  }
  return months;
}

export async function GET() {
  try {
    // Platform-wide analytics (every tenant's payments/subscriptions),
    // not just the caller's own account — restricted to the platform
    // owner. Each customer is an independent `accounts` row (see POST
    // /api/admin/customers), so this deliberately does not scope by
    // ctx.accountId the way per-tenant admin routes do.
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();

    const [{ data: payments }, { data: subscriptions }, { data: accounts }] = await Promise.all([
      admin.from('customer_payments').select('amount, status, payment_date'),
      admin.from('customer_subscriptions').select('plan_name, status, amount, duration_days, updated_at, created_at'),
      admin.from('accounts').select('id, created_at').neq('owner_user_id', ctx.userId),
    ]);

    const months = lastNMonths(6);
    const monthIndex = new Map(months.map((m, i) => [m.key, i]));

    const revenueByMonth = months.map((m) => ({ month: m.label, revenue: 0 }));
    for (const p of payments ?? []) {
      if (p.status !== 'paid' || !p.payment_date) continue;
      const idx = monthIndex.get(monthKey(new Date(p.payment_date)));
      if (idx !== undefined) revenueByMonth[idx].revenue += Number(p.amount);
    }

    const newCustomersByMonth = months.map((m) => ({ month: m.label, customers: 0 }));
    for (const a of accounts ?? []) {
      const idx = monthIndex.get(monthKey(new Date(a.created_at)));
      if (idx !== undefined) newCustomersByMonth[idx].customers += 1;
    }

    // Churn is approximated from `updated_at` on subscriptions currently
    // sitting in a terminal state — this repo doesn't yet write to
    // `subscription_history` on every status transition, so there's no
    // exact "cancelled on this date" event log to aggregate from.
    const churnByMonth = months.map((m) => ({ month: m.label, churned: 0 }));
    for (const s of subscriptions ?? []) {
      if (s.status !== 'cancelled' && s.status !== 'expired') continue;
      const idx = monthIndex.get(monthKey(new Date(s.updated_at)));
      if (idx !== undefined) churnByMonth[idx].churned += 1;
    }

    const planCounts = new Map<string, number>();
    for (const s of subscriptions ?? []) {
      if (s.status !== 'active' && s.status !== 'trial' && s.status !== 'expiring_soon') continue;
      planCounts.set(s.plan_name, (planCounts.get(s.plan_name) ?? 0) + 1);
    }
    const planDistribution = Array.from(planCounts.entries()).map(([plan, count]) => ({ plan, count }));

    // Normalize each active subscription's amount to a monthly figure
    // (duration_days may be 30/90/180/365 for monthly/quarterly/etc plans).
    const mrrRaw = (subscriptions ?? [])
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (Number(s.amount) * 30) / (s.duration_days || 30), 0);
    const mrr = Math.round(mrrRaw * 100) / 100;

    return NextResponse.json({
      revenueByMonth,
      newCustomersByMonth,
      churnByMonth,
      planDistribution,
      mrr,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
