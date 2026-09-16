ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_company_name TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_client_user ON public.tasks(client_user_id);