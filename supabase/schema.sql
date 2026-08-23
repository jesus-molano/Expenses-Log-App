create extension if not exists pgcrypto;

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

create table if not exists public.push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null,
  kind text not null,
  status text not null default 'delivered',
  claimed_at timestamptz,
  claim_token uuid,
  delivered_at timestamptz default now(),
  created_at timestamptz not null default now(),
  constraint push_reminder_deliveries_state_check check (
    (
      status = 'claimed'
      and claimed_at is not null
      and claim_token is not null
      and delivered_at is null
    )
    or (
      status = 'delivered'
      and delivered_at is not null
      and claim_token is null
    )
  ),
  unique (user_id, reminder_key, kind)
);

create index if not exists push_reminder_deliveries_user_id_idx
  on public.push_reminder_deliveries (user_id);

create index if not exists push_reminder_deliveries_latest_idx
  on public.push_reminder_deliveries (user_id, kind, delivered_at desc)
  where status = 'delivered';

grant select, insert, update, delete on table public.push_reminder_deliveries to authenticated;
grant select, insert, update, delete on table public.push_reminder_deliveries to service_role;

create or replace function public.claim_push_reminder_delivery(
  p_user_id uuid,
  p_reminder_key text,
  p_kind text,
  p_lease_seconds integer default 900
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_token uuid := gen_random_uuid();
  claimed_token uuid;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'p_lease_seconds must be between 30 and 3600'
      using errcode = '22023';
  end if;

  insert into public.push_reminder_deliveries (
    user_id,
    reminder_key,
    kind,
    status,
    claimed_at,
    claim_token,
    delivered_at
  ) values (
    p_user_id,
    p_reminder_key,
    p_kind,
    'claimed',
    now(),
    next_token,
    null
  )
  on conflict (user_id, reminder_key, kind) do update
    set status = 'claimed',
        claimed_at = excluded.claimed_at,
        claim_token = excluded.claim_token,
        delivered_at = null
    where public.push_reminder_deliveries.status = 'claimed'
      and public.push_reminder_deliveries.claimed_at
        < now() - make_interval(secs => p_lease_seconds)
  returning claim_token into claimed_token;

  return claimed_token;
end;
$$;

revoke all on function public.claim_push_reminder_delivery(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_push_reminder_delivery(uuid, text, text, integer)
  to service_role;

create table if not exists public.app_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_reminder_deliveries enable row level security;
alter table public.app_stores enable row level security;

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "push own rows" on public.push_subscriptions;
drop policy if exists "push reminder deliveries own rows" on public.push_reminder_deliveries;
drop policy if exists "app stores own rows" on public.app_stores;

create policy "profiles own rows" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "push own rows" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "push reminder deliveries own rows" on public.push_reminder_deliveries
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "app stores own rows" on public.app_stores
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
