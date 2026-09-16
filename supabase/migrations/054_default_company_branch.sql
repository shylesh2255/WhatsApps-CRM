CREATE OR REPLACE FUNCTION public.create_default_company_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.branches (account_id, name, code)
  VALUES (NEW.id, 'Main Branch', 'MAIN')
  ON CONFLICT (account_id, code) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_default_branch ON public.accounts;
CREATE TRIGGER accounts_default_branch
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_default_company_branch();

INSERT INTO public.branches (account_id, name, code)
SELECT id, 'Main Branch', 'MAIN'
FROM public.accounts
ON CONFLICT (account_id, code) DO NOTHING;