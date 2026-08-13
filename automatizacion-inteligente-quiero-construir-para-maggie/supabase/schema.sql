create extension if not exists pgcrypto;

create table if not exists public.csv_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  row_count integer not null default 0,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.csv_uploads(id) on delete cascade,
  status text,
  plan_name text,
  advisor_key text,
  advisor_name text,
  policy_number text,
  issue_date text,
  payment_date text,
  payment_method text,
  insurance_type text,
  frequency text,
  holder text,
  insured text,
  next_birthday text,
  annual_premium text,
  email text,
  phone text,
  birth_date text,
  contract_end_date text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists policies_upload_id_idx on public.policies(upload_id);
create index if not exists policies_status_idx on public.policies(status);
create index if not exists policies_policy_number_idx on public.policies(policy_number);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  channel text not null,
  recipient text not null,
  subject text,
  payload jsonb not null default '{}'::jsonb,
  provider_id text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

alter table public.csv_uploads enable row level security;
alter table public.policies enable row level security;
alter table public.notification_log enable row level security;
