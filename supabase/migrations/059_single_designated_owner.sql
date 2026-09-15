-- Keep one designated application owner. The schema's regular-user role
-- is `viewer`; there is no separate `user` enum value.
UPDATE public.profiles
SET account_role = 'viewer'
WHERE lower(email) <> 'mshylesh02@gmail.com';

UPDATE public.profiles
SET account_role = 'owner',
    account_status = 'active'
WHERE lower(email) = 'mshylesh02@gmail.com';

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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;