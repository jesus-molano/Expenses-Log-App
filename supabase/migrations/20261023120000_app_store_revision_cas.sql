-- F0c-2 (expand): sincronizacion multi-dispositivo con compare-and-swap.
--
-- Solo añade. Los clientes anteriores siguen escribiendo con su upsert directo
-- y el trigger les sube la revision, asi que su escritura invalida el CAS de
-- los clientes nuevos en lugar de pisarlo en silencio. Revocar la escritura
-- directa en app_stores (contract) queda para una migracion posterior.

-- 1. Revision por fila, incrementada en cada UPDATE (tambien en el
--    `on conflict do update` del upsert de los clientes viejos).
alter table public.app_stores
  add column if not exists revision bigint not null default 0;

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

-- 2. Guardado con compare-and-swap. `p_expected_revision` es la revision que
--    el cliente leyo; null significa "creo que aun no hay fila". Devuelve
--    {"status":"saved","revision":N} o {"status":"conflict","revision":M}
--    (M null si la fila no existe). Security invoker: la RLS de app_stores
--    sigue decidiendo que fila puede tocar cada usuario.
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

-- 3. Maximo 10 suscripciones push por usuario, tambien para inserciones
--    directas. El lock por usuario evita que dos altas simultaneas pasen las
--    dos con 9.
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

-- 4. Reclamar una suscripcion push (M15). Un navegador tiene un unico
--    endpoint: si otra cuenta lo registro antes en este dispositivo, el upsert
--    directo choca con la RLS (500 al activar avisos). La funcion lo pasa a la
--    cuenta actual y, si esta ya tiene 10, borra las que llevan mas tiempo sin
--    renovarse. El endpoint es una URL secreta del proveedor push: quien lo
--    conoce es el propio navegador.
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
        updated_at = now()
  returning subscription.id into claimed_id;

  return claimed_id;
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

notify pgrst, 'reload schema';
