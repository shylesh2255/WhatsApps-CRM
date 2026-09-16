import { NextResponse } from 'next/server';

import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';

export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    let query = ctx.supabase
      .from('billing_plans')
      .select('id, slug, name, monthly_price, currency, chat_limit, contact_limit, product_limit')
      .eq('active', true);
    if (ctx.role !== 'owner' && ctx.role !== 'admin') query = query.gt('monthly_price', 0);
    const { data, error } = await query.order('monthly_price');
    if (error) throw error;
    return NextResponse.json({ plans: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}