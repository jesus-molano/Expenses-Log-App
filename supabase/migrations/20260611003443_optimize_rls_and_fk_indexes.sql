create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

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
