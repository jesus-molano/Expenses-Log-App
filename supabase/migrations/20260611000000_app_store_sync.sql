create table if not exists public.app_stores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_stores enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_stores'
      and policyname = 'app stores own rows'
  ) then
    create policy "app stores own rows" on public.app_stores
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

notify pgrst, 'reload schema';
