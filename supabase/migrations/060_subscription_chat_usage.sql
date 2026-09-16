-- Subscription plan names, lifecycle states, and server-side chat usage.
UPDATE public.billing_plans
SET name = 'Free', monthly_price = 0, currency = 'INR', chat_limit = NULL
WHERE slug = 'free';

UPDATE public.billing_plans
SET name = 'Basic', monthly_price = 150, currency = 'INR', chat_limit = 1000
WHERE slug = 'starter';

UPDATE public.billing_plans
SET name = 'Professional', monthly_price = 350, currency = 'INR', chat_limit = 5000
WHERE slug = 'growth';

UPDATE public.billing_plans
SET name = 'Unlimited', monthly_price = 500, currency = 'INR', chat_limit = NULL
WHERE slug = 'unlimited';

ALTER TABLE public.customer_subscriptions
  ALTER COLUMN expiry_date DROP NOT NULL;

ALTER TABLE public.subscription_usage
  ADD COLUMN IF NOT EXISTS period_end DATE;

ALTER TABLE public.customer_subscriptions
  DROP CONSTRAINT IF EXISTS customer_subscriptions_status_check;

ALTER TABLE public.customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_status_check CHECK (
    status IN ('active', 'trial', 'expiring_soon', 'expired', 'payment_pending',
      'payment_failed', 'cancelled', 'suspended')
  );

CREATE OR REPLACE FUNCTION public.check_and_increment_chat_usage(
  p_account_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  chats_used INTEGER,
  chat_limit INTEGER,
  period_start DATE,
  period_end DATE,
  plan_name TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_subscription RECORD;
  v_plan RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_used INTEGER;
  v_allowed BOOLEAN := true;
  v_reason TEXT := NULL;
BEGIN
  IF p_user_id IS NULL THEN
    SELECT owner_user_id INTO p_user_id
    FROM public.accounts
    WHERE id = p_account_id;
  END IF;

  SELECT account_role, account_status
    INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id AND account_id = p_account_id;

  IF v_profile.account_role = 'owner' THEN
    RETURN QUERY SELECT true, NULL::TEXT, 0, NULL::INTEGER, NULL::DATE,
      NULL::DATE, 'Unlimited', 'active';
    RETURN;
  END IF;

  SELECT s.*, bp.name AS resolved_plan_name, bp.chat_limit AS resolved_chat_limit
    INTO v_subscription
  FROM public.customer_subscriptions s
  LEFT JOIN public.billing_plans bp ON bp.id = s.plan_id
  WHERE s.user_id = p_user_id AND s.account_id = p_account_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_subscription IS NULL THEN
    RETURN QUERY SELECT true, NULL::TEXT, 0, NULL::INTEGER, NULL::DATE,
      NULL::DATE, 'Free', 'active';
    RETURN;
  END IF;

  IF v_subscription.status NOT IN ('active', 'trial', 'expiring_soon')
     OR (v_subscription.expiry_date IS NOT NULL AND v_subscription.expiry_date <= NOW())
     OR (v_subscription.status <> 'trial' AND v_subscription.payment_status <> 'paid') THEN
    RETURN QUERY SELECT false, 'subscription_inactive'::TEXT, 0,
      NULL::INTEGER, NULL::DATE, NULL::DATE,
      COALESCE(v_subscription.resolved_plan_name, v_subscription.plan_name),
      v_subscription.status;
    RETURN;
  END IF;

  v_period_start := COALESCE(v_subscription.start_date::DATE, CURRENT_DATE);
  IF v_subscription.duration_days IS NULL OR v_subscription.duration_days <= 0 THEN
    v_subscription.duration_days := 30;
  END IF;
  WHILE v_period_start + v_subscription.duration_days <= CURRENT_DATE LOOP
    v_period_start := v_period_start + v_subscription.duration_days;
  END LOOP;
  v_period_end := v_period_start + v_subscription.duration_days;

  INSERT INTO public.subscription_usage (account_id, period_start, period_end)
  VALUES (p_account_id, v_period_start, v_period_end)
  ON CONFLICT (account_id, period_start) DO UPDATE
  SET period_end = EXCLUDED.period_end;

  SELECT whatsapp_messages_count
    INTO v_used
  FROM public.subscription_usage
  WHERE account_id = p_account_id AND period_start = v_period_start
  FOR UPDATE;

  IF v_subscription.resolved_chat_limit IS NOT NULL
     AND v_used >= v_subscription.resolved_chat_limit THEN
    v_allowed := false;
    v_reason := 'chat_limit_reached';
  ELSE
    UPDATE public.subscription_usage
    SET whatsapp_messages_count = whatsapp_messages_count + 1
    WHERE account_id = p_account_id AND period_start = v_period_start;
    v_used := v_used + 1;
  END IF;

  RETURN QUERY SELECT v_allowed, v_reason, v_used,
    v_subscription.resolved_chat_limit, v_period_start, v_period_end,
    COALESCE(v_subscription.resolved_plan_name, v_subscription.plan_name),
    v_subscription.status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_chat_usage(UUID, UUID)
  TO authenticated, service_role;
-- 6. Update signup trigger: assign 14-day Free trial to every new user.
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
  v_role := CASE
    WHEN lower(NEW.email) = 'mshylesh02@gmail.com' THEN 'owner'::account_role_enum
    ELSE 'viewer'::account_role_enum
  END;

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
