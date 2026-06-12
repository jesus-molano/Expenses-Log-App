create extension if not exists pgcrypto;

drop table if exists public.expense_occurrence_overrides cascade;
drop table if exists public.expense_templates cascade;
drop table if exists public.expense_categories cascade;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  currency text not null default 'EUR',
  timezone text not null default 'Atlantic/Canary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create table if not exists public.app_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

truncate table
  public.push_subscriptions,
  public.app_stores,
  public.profiles
restart identity cascade;

alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_stores enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "push own rows" on public.push_subscriptions;
drop policy if exists "app stores own rows" on public.app_stores;

create policy "profiles own rows" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "push own rows" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "app stores own rows" on public.app_stores
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
