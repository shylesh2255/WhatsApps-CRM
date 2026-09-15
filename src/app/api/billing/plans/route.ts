import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from('billing_plans')
      .select('id, slug, name, monthly_price, currency, chat_limit, contact_limit, product_limit')
      .eq('active', true)
      .order('monthly_price');
    if (error) throw error;
    return NextResponse.json({ plans: data });
  } catch (error) {
    return toErrorResponse(error);
  }
}