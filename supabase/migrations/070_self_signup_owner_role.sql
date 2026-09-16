-- Re-enabling public self-serve signup (src/middleware.ts) surfaces a
-- bug in handle_new_user(): every new signup was assigned 'viewer' in
-- their own brand-new account (a leftover from when self-signup was
-- disabled and every account was admin-provisioned with an explicit
-- role choice). A self-signed-up user is the sole member and
-- `accounts.owner_user_id` of their own new account — they must be
-- 'owner' there to configure WhatsApp, send messages, or invite a
-- team, none of which "viewer" permits.
--
-- Safe for the invite flow: a user who signs up via /join/<token>
-- still gets this same personal account + trial first, but
-- redeem_invitation() (migration 019) immediately moves them into the
-- inviter's account with the invite's own role, overwriting this.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
  v_role account_role_enum;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  -- Every self-signup is the sole owner of their own new account.
  v_role := 'owner'::account_role_enum;

  INSERT INTO public.accounts (name, owner_user_id)
  VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'), NEW.id)
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, v_role);

  -- Assign 14-day Free trial to every new user.
  INSERT INTO public.customer_subscriptions (
    account_id, user_id, plan_id, plan_name, amount, currency, chat_limit,
    duration_days, start_date, expiry_date, payment_status, status, auto_renew
  )
  SELECT
    v_account_id,
    NEW.id,
    bp.id,
    bp.name,
    0,
    'INR',
    NULL,
    14,
    NOW(),
    NOW() + INTERVAL '14 days',
    'paid',
    'trial',
    false
  FROM public.billing_plans bp
  WHERE bp.slug = 'free' AND bp.active = true
  LIMIT 1;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
