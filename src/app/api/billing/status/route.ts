import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from('account_subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('account_id', ctx.accountId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ subscription: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}