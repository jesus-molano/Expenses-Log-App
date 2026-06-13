create table if not exists public.push_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_key text not null,
  kind text not null,
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, reminder_key, kind)
);

create index if not exists push_reminder_deliveries_user_id_idx
  on public.push_reminder_deliveries (user_id);

grant select, insert, update, delete on table public.push_reminder_deliveries to authenticated;
grant select, insert, update, delete on table public.push_reminder_deliveries to service_role;

alter table public.push_reminder_deliveries enable row level security;

drop policy if exists "push reminder deliveries own rows" on public.push_reminder_deliveries;

create policy "push reminder deliveries own rows" on public.push_reminder_deliveries
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
