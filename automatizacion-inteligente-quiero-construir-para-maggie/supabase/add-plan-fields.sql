alter table public.policies
  add column if not exists plan_currency text,
  add column if not exists converted_premium text;
