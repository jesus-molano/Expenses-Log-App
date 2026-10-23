-- Salud de las suscripciones push (M12). Solo añade columnas con valor por
-- defecto: la app y el cron funcionan antes y después de aplicarla.
-- - failure_count: envíos fallidos seguidos (sin contar 404/410, que borran
--   la suscripción al momento). El cron la borra al llegar a 5.
-- - last_failure_at / last_success_at: diagnóstico.
-- El latido de la app (alta de la suscripción) renueva updated_at y pone
-- failure_count a 0, también cuando entra por claim_push_subscription.
alter table public.push_subscriptions
  add column if not exists failure_count integer not null default 0,
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_success_at timestamptz;

-- Reclamar la suscripcion (definida en la migracion de sincronizacion) es el
-- latido de la app: ademas de renovar updated_at pone failure_count a 0.
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
        failure_count = 0,
        updated_at = now()
  returning subscription.id into claimed_id;

  return claimed_id;
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

notify pgrst, 'reload schema';
