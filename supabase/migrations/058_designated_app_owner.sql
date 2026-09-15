-- Grant the designated application owner full access without a customer
-- subscription or payment record.
--
-- This is intentionally keyed by the immutable auth user id, not email.
-- The email check prevents applying the ownership grant to the wrong
-- account if this migration is copied into another Supabase project.
DO $$
DECLARE
  designated_user_id CONSTANT UUID := '0147e2a1-eaa3-48d6-9169-3d2e378a7798';
  designated_email CONSTANT TEXT := 'mshylesh02@gmail.com';
  designated_name TEXT;
  designated_account_id UUID;
BEGIN
  SELECT COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), designated_email)
    INTO designated_name
  FROM auth.users AS u
  WHERE u.id = designated_user_id
    AND lower(u.email) = designated_email;

  IF designated_name IS NULL THEN
    RAISE NOTICE
      'Designated auth user % was not found with email %; no ownership changes applied',
      designated_user_id,
      designated_email;
    RETURN;
  END IF;

  SELECT a.id
    INTO designated_account_id
  FROM public.accounts AS a
  WHERE a.owner_user_id = designated_user_id;

  IF designated_account_id IS NULL THEN
    INSERT INTO public.accounts (name, owner_user_id)
    VALUES (designated_name || '''s account', designated_user_id)
    RETURNING id INTO designated_account_id;
  END IF;

  INSERT INTO public.profiles (
    user_id, full_name, email, account_id, account_role, account_status
  )
  VALUES (
    designated_user_id, designated_name, designated_email,
    designated_account_id, 'owner', 'active'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      account_id = EXCLUDED.account_id,
      account_role = 'owner',
      account_status = 'active';

  UPDATE public.profiles
  SET account_role = 'admin'
  WHERE account_id = designated_account_id
    AND user_id <> designated_user_id
    AND account_role = 'owner';

  UPDATE public.accounts
  SET owner_user_id = designated_user_id
  WHERE id = designated_account_id;
END
$$;