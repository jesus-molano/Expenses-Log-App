create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  currency text not null default 'EUR',
  timezone text not null default 'Atlantic/Canary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'WalletCards',
  tone text not null default 'slate',
  created_at timestamptz not null default now()
);

create unique index if not exists expense_categories_user_name_idx
  on public.expense_categories (user_id, lower(name));

create table if not exists public.expense_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  name text not null,
  description text not null default '',
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  tags text[] not null default '{}',
  start_date date not null,
  due_day integer not null check (due_day between 1 and 31),
  recurrence jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.expense_templates(id) on delete cascade,
  occurrence_date date not null,
  due_date date,
  sort_order numeric(12, 4),
  status text not null check (status in ('due', 'paid', 'skipped')),
  paid_at timestamptz,
  amount_paid numeric(12, 2),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, occurrence_date)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expense_templates enable row level security;
alter table public.expense_occurrence_overrides enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "profiles own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "categories own rows" on public.expense_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "templates own rows" on public.expense_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "overrides own rows" on public.expense_occurrence_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "push own rows" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
