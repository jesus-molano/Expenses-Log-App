alter table public.push_reminder_deliveries
  add column if not exists status text not null default 'delivered',
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_token uuid;

alter table public.push_reminder_deliveries
  alter column delivered_at drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_reminder_deliveries_state_check'
      and conrelid = 'public.push_reminder_deliveries'::regclass
  ) then
    alter table public.push_reminder_deliveries
      add constraint push_reminder_deliveries_state_check check (
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
      );
  end if;
end;
$$;

create index if not exists push_reminder_deliveries_latest_idx
  on public.push_reminder_deliveries (user_id, kind, delivered_at desc)
  where status = 'delivered';

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

notify pgrst, 'reload schema';
