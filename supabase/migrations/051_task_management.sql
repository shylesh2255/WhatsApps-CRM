CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  task_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  due_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (task_id)
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_account_access ON public.tasks FOR ALL TO authenticated
  USING (is_account_member(account_id)) WITH CHECK (is_account_member(account_id));
CREATE POLICY task_status_history_account_access ON public.task_status_history FOR ALL TO authenticated
  USING (is_account_member(account_id)) WITH CHECK (is_account_member(account_id));
CREATE POLICY task_feedback_account_access ON public.task_feedback FOR ALL TO authenticated
  USING (is_account_member(account_id)) WITH CHECK (is_account_member(account_id));

CREATE INDEX IF NOT EXISTS idx_tasks_account_status ON public.tasks(account_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_account_due_date ON public.tasks(account_id, due_date);
CREATE INDEX IF NOT EXISTS idx_task_history_task ON public.task_status_history(task_id, created_at DESC);