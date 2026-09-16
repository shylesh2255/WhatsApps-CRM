import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function GET() {
  try {
    // Platform-wide metrics across every tenant — restricted to the
    // platform owner (see requirePlatformOwner for why account_role
    // alone isn't enough here).
    const ctx = await requirePlatformOwner();
    const admin = supabaseAdmin();
    const [{ data: customers }, { data: subscriptions }, { data: payments }, { data: activity }] = await Promise.all([
      admin.from('profiles').select('user_id, account_status, created_at').neq('user_id', ctx.userId),
      admin.from('customer_subscriptions').select('user_id, status, payment_status, expiry_date, amount, auto_renew'),
      admin.from('customer_payments').select('status, amount, payment_date, due_date'),
      admin.from('audit_logs').select('action, created_at, details').order('created_at', { ascending: false }).limit(10),
    ]);
    const now = Date.now(); const soon = now + 7 * 86400000; const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    return NextResponse.json({ metrics: {
      totalCustomers: customers?.length ?? 0,
      activeUsers: customers?.filter((item) => item.account_status === 'active').length ?? 0,
      inactiveUsers: customers?.filter((item) => item.account_status === 'inactive').length ?? 0,
      suspendedUsers: customers?.filter((item) => item.account_status === 'suspended').length ?? 0,
      expiredSubscriptions: subscriptions?.filter((item) => new Date(item.expiry_date).getTime() <= now).length ?? 0,
      expiringSoon: subscriptions?.filter((item) => { const date = new Date(item.expiry_date).getTime(); return date > now && date <= soon; }).length ?? 0,
      paymentsDue: payments?.filter((item) => item.status === 'pending').length ?? 0,
      paidCustomers: subscriptions?.filter((item) => item.payment_status === 'paid').length ?? 0,
      paymentVerificationPending: payments?.filter((item) => item.status === 'pending').length ?? 0,
      paymentsDueToday: subscriptions?.filter((item) => new Date(item.expiry_date).toDateString() === new Date().toDateString()).length ?? 0,
      paymentsDueWithin3Days: subscriptions?.filter((item) => { const days = (new Date(item.expiry_date).getTime() - now) / 86400000; return days >= 0 && days <= 3; }).length ?? 0,
      paymentsDueWithin7Days: subscriptions?.filter((item) => { const days = (new Date(item.expiry_date).getTime() - now) / 86400000; return days >= 0 && days <= 7; }).length ?? 0,
      earlyPayments: payments?.filter((item) => item.payment_date && item.due_date && new Date(item.payment_date) < new Date(item.due_date)).length ?? 0,
      rejectedPayments: payments?.filter((item) => item.status === 'rejected').length ?? 0,
      totalAmountReceived: payments?.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0) ?? 0,
      totalAmountPending: payments?.filter((item) => item.status === 'pending').reduce((sum, item) => sum + Number(item.amount), 0) ?? 0,
      totalOverdueAmount: payments?.filter((item) => item.status === 'overdue').reduce((sum, item) => sum + Number(item.amount), 0) ?? 0,
      overduePayments: payments?.filter((item) => item.status === 'overdue').length ?? 0,
      failedPayments: payments?.filter((item) => item.status === 'failed').length ?? 0,
      autoRenewCustomers: subscriptions?.filter((item) => item.auto_renew).length ?? 0,
      paymentsReceived: payments?.filter((item) => item.status === 'paid').length ?? 0,
      currentMonthRevenue: payments?.filter((item) => item.status === 'paid' && item.payment_date && new Date(item.payment_date) >= month).reduce((sum, item) => sum + Number(item.amount), 0) ?? 0,
      upcomingRevenue: subscriptions?.filter((item) => item.payment_status !== 'paid' && new Date(item.expiry_date).getTime() > now).reduce((sum, item) => sum + Number(item.amount), 0) ?? 0,
      newCustomers: customers?.filter((item) => new Date(item.created_at) >= month).length ?? 0,
      recentActivity: activity ?? [],
    } });
  } catch (error) { return toErrorResponse(error); }
}