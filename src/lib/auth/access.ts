import { ForbiddenError, type AccountContext } from './account';
import { hasMinRole } from './roles';

export type AccessState = {
  allowed: boolean;
  reason?: 'inactive' | 'suspended' | 'expired' | 'payment_pending';
};

export async function getAccessState(ctx: AccountContext): Promise<AccessState> {
  if (hasMinRole(ctx.role, 'admin')) return { allowed: true };

  const { data: profile, error: profileError } = await ctx.supabase
    .from('profiles')
    .select('account_status')
    .eq('user_id', ctx.userId)
    .single();
  if (profileError) throw new ForbiddenError('Could not verify account status');
  if (profile.account_status === 'suspended') return { allowed: false, reason: 'suspended' };
  if (profile.account_status !== 'active') return { allowed: false, reason: 'inactive' };

  const [{ data: subscription, error: subscriptionError }, { data: account, error: accountError }] = await Promise.all([
    ctx.supabase
    .from('customer_subscriptions')
    .select('status, payment_status, expiry_date')
    .eq('user_id', ctx.userId)
    .order('expiry_date', { ascending: false })
    .limit(1)
    .maybeSingle(),
    ctx.supabase.from('accounts').select('pending_payment_access').eq('id', ctx.accountId).single(),
  ]);
  if (subscriptionError) throw new ForbiddenError('Could not verify subscription status');
  if (accountError) throw new ForbiddenError('Could not verify billing settings');
  const { data: pendingPayment } = await ctx.supabase.from('customer_payments').select('id').eq('user_id', ctx.userId).eq('status', 'pending').limit(1).maybeSingle();
  if (!subscription || (new Date(subscription.expiry_date) <= new Date() && !(account.pending_payment_access && pendingPayment))) {
    return { allowed: false, reason: 'expired' };
  }
  if (account.pending_payment_access && pendingPayment) return { allowed: true };
  if (subscription.payment_status !== 'paid' || !['active', 'expiring_soon'].includes(subscription.status)) {
    return { allowed: false, reason: 'payment_pending' };
  }
  return { allowed: true };
}

export async function requireCustomerAccess(ctx: AccountContext) {
  const state = await getAccessState(ctx);
  if (!state.allowed) {
    throw new ForbiddenError(
      state.reason === 'expired'
        ? 'Your subscription has expired'
        : state.reason === 'suspended'
          ? 'Your account is suspended'
          : state.reason === 'inactive'
            ? 'Your account is inactive'
            : 'Your payment is pending',
    );
  }
  return ctx;
}