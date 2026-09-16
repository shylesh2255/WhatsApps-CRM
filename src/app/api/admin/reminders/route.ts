import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function POST() {
  try {
    const ctx = await requireRole('admin');
    const { data: subscriptions, error } = await ctx.supabase.from('customer_subscriptions').select('id, user_id, expiry_date').eq('account_id', ctx.accountId).eq('status', 'active');
    if (error) throw error;
    const now = Date.now(); const windows = [30, 7, 3, 1]; let created = 0;
    for (const subscription of subscriptions ?? []) {
      const days = Math.ceil((new Date(subscription.expiry_date).getTime() - now) / 86400000);
      if (!windows.includes(days)) continue;
      const { error: insertError } = await ctx.supabase.from('customer_notifications').insert({ account_id: ctx.accountId, user_id: subscription.user_id, type: 'subscription_expiring', title: 'Subscription renewal reminder', message: `Your subscription expires in ${days} day${days === 1 ? '' : 's'}.` });
      if (!insertError) created++;
    }
    return NextResponse.json({ created });
  } catch (error) { return toErrorResponse(error); }
}