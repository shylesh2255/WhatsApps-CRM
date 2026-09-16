import { NextResponse } from 'next/server';
import { requirePlatformOwner, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/flows/admin-client';

export async function POST() {
  try {
    // Platform-wide sweep across every tenant's subscriptions —
    // restricted to the platform owner.
    await requirePlatformOwner();
    const admin = supabaseAdmin();
    const { data: subscriptions, error } = await admin
      .from('customer_subscriptions')
      .select('id, account_id, user_id, expiry_date')
      .eq('status', 'active');
    if (error) throw error;
    const now = Date.now(); const windows = [30, 7, 3, 1]; let created = 0;
    for (const subscription of subscriptions ?? []) {
      if (!subscription.expiry_date) continue;
      const days = Math.ceil((new Date(subscription.expiry_date).getTime() - now) / 86400000);
      if (!windows.includes(days)) continue;
      const { error: insertError } = await admin.from('customer_notifications').insert({ account_id: subscription.account_id, user_id: subscription.user_id, type: 'subscription_expiring', title: 'Subscription renewal reminder', message: `Your subscription expires in ${days} day${days === 1 ? '' : 's'}.` });
      if (!insertError) created++;
    }
    return NextResponse.json({ created });
  } catch (error) { return toErrorResponse(error); }
}
