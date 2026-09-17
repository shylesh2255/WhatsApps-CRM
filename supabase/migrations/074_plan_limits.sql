-- ============================================================
-- 074_plan_limits.sql — Enforce billing_plans.contact_limit /
-- product_limit at write time.
--
-- Both columns have existed since 042_user_plans.sql and are already
-- surfaced on the account's own billing page, but nothing has ever
-- enforced them — a Free-plan account could create unlimited contacts
-- or products. contacts and products are both created directly from
-- client components via the Supabase client (no API route sits in
-- front of either insert), so the only reliable enforcement point is
-- a BEFORE INSERT trigger, same as any other DB-level invariant in
-- this schema.
--
-- Plan resolution mirrors check_and_increment_chat_usage's fallback
-- (060_subscription_chat_usage.sql): resolve the account owner's
-- latest customer_subscriptions row; no row, or a NULL limit on that
-- plan, both mean unlimited. This keeps the "no subscription yet"
-- and "Unlimited plan" cases behaving exactly like chat usage already
-- does, rather than inventing a second, divergent fallback rule.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_plan_count_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resource TEXT := TG_ARGV[0];
  v_owner_id UUID;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT owner_user_id INTO v_owner_id
  FROM public.accounts
  WHERE id = NEW.account_id;

  SELECT
    CASE v_resource
      WHEN 'contacts' THEN bp.contact_limit
      WHEN 'products' THEN bp.product_limit
    END
  INTO v_limit
  FROM public.customer_subscriptions s
  JOIN public.billing_plans bp ON bp.id = s.plan_id
  WHERE s.account_id = NEW.account_id AND s.user_id = v_owner_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT count(*) FROM public.%I WHERE account_id = $1', v_resource)
    INTO v_count
    USING NEW.account_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'plan_limit_reached: % limit is % on your current plan', v_resource, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_contact_plan_limit ON public.contacts;
CREATE TRIGGER enforce_contact_plan_limit
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_count_limit('contacts');

DROP TRIGGER IF EXISTS enforce_product_plan_limit ON public.products;
CREATE TRIGGER enforce_product_plan_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_count_limit('products');
