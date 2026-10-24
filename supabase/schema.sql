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
  updated_at timestamptz not null default now(),
  failure_count integer not null default 0,
  last_failure_at timestamptz,
  last_success_at timestamptz
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
  revision bigint not null default 0,
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

-- Sincronizacion multi-dispositivo (F0c-2, migracion
-- 20261023120000_app_store_revision_cas.sql).
create or replace function public.bump_app_store_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_stores_bump_revision on public.app_stores;
create trigger app_stores_bump_revision
  before update on public.app_stores
  for each row execute function public.bump_app_store_revision();

-- Guardado con compare-and-swap. `p_expected_revision` es la revision que
-- el cliente leyo; null significa "creo que aun no hay fila". Devuelve
-- {"status":"saved","revision":N} o {"status":"conflict","revision":M}
-- (M null si la fila no existe). Security invoker: la RLS de app_stores
-- sigue decidiendo que fila puede tocar cada usuario.
create or replace function public.save_app_store(
  p_store jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved_revision bigint;
  current_revision bigint;
begin
  if current_user_id is null then
    raise exception 'save_app_store requires an authenticated user'
      using errcode = '42501';
  end if;

  if p_store is null or jsonb_typeof(p_store) <> 'object' then
    raise exception 'p_store must be a JSON object'
      using errcode = '22023';
  end if;

  if p_expected_revision is null then
    insert into public.app_stores (user_id, store)
    values (current_user_id, p_store)
    on conflict (user_id) do nothing
    returning revision into saved_revision;
  else
    update public.app_stores
       set store = p_store
     where user_id = current_user_id
       and revision = p_expected_revision
    returning revision into saved_revision;
  end if;

  if saved_revision is not null then
    return jsonb_build_object('status', 'saved', 'revision', saved_revision);
  end if;

  select revision
    into current_revision
    from public.app_stores
   where user_id = current_user_id;

  return jsonb_build_object('status', 'conflict', 'revision', current_revision);
end;
$$;

revoke all on function public.save_app_store(jsonb, bigint) from public, anon;
grant execute on function public.save_app_store(jsonb, bigint) to authenticated;

-- Maximo 10 suscripciones push por usuario, tambien para inserciones
-- directas. El lock por usuario evita que dos altas simultaneas pasen las
-- dos con 9.
create or replace function public.enforce_push_subscription_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscription_count integer;
begin
  if tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('push_subscriptions:' || new.user_id::text, 0)
  );

  -- En un upsert, el trigger de INSERT salta antes de detectar el conflicto:
  -- la fila con el mismo endpoint es la que se va a actualizar, no otra.
  select count(*)
    into subscription_count
    from public.push_subscriptions
   where user_id = new.user_id
     and id <> new.id
     and endpoint <> new.endpoint;

  if subscription_count >= 10 then
    raise exception 'push_subscription_limit: max 10 push subscriptions per user'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists push_subscriptions_limit on public.push_subscriptions;
create trigger push_subscriptions_limit
  before insert or update of user_id on public.push_subscriptions
  for each row execute function public.enforce_push_subscription_limit();

-- Reclamar una suscripcion push (M15). Un navegador tiene un unico
-- endpoint: si otra cuenta lo registro antes en este dispositivo, el upsert
-- directo choca con la RLS (500 al activar avisos). La funcion lo pasa a la
-- cuenta actual y, si esta ya tiene 10, borra las que llevan mas tiempo sin
-- renovarse. El endpoint es una URL secreta del proveedor push: quien lo
-- conoce es el propio navegador.
create or replace function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  claimed_id uuid;
begin
  if current_user_id is null then
    raise exception 'claim_push_subscription requires an authenticated user'
      using errcode = '42501';
  end if;

  if p_endpoint is null
     or p_endpoint !~ '^https://'
     or length(p_endpoint) > 2048
     or coalesce(length(p_p256dh), 0) = 0
     or length(p_p256dh) > 512
     or coalesce(length(p_auth), 0) = 0
     or length(p_auth) > 512 then
    raise exception 'invalid push subscription'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('push_subscriptions:' || current_user_id::text, 0)
  );

  delete from public.push_subscriptions
   where id in (
     select id
       from public.push_subscriptions
      where user_id = current_user_id
        and endpoint <> p_endpoint
      order by updated_at desc, created_at desc
      offset 9
   );

  insert into public.push_subscriptions as subscription (
    user_id,
    endpoint,
    p256dh,
    auth
  ) values (
    current_user_id,
    p_endpoint,
    p_p256dh,
    p_auth
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        -- Reclamar es el latido de la app (migracion
        -- 20261023220000_push_subscription_health.sql): olvida los fallos.
        failure_count = 0,
        updated_at = now()
  returning subscription.id into claimed_id;

  return claimed_id;
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;
