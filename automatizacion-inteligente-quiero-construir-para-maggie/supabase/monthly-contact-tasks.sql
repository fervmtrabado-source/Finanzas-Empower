create table if not exists public.monthly_contact_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  period text not null,
  payment_date text not null,
  policy_number text not null,
  holder text not null,
  plan_name text,
  contacted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists monthly_contact_tasks_period_idx on public.monthly_contact_tasks(period);
create index if not exists monthly_contact_tasks_task_key_idx on public.monthly_contact_tasks(task_key);

alter table public.monthly_contact_tasks enable row level security;
