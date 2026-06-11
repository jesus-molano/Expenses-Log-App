create index if not exists expense_categories_user_id_idx
  on public.expense_categories (user_id);

create index if not exists expense_templates_user_id_idx
  on public.expense_templates (user_id);

create index if not exists expense_templates_category_id_idx
  on public.expense_templates (category_id);

create index if not exists expense_occurrence_overrides_user_id_idx
  on public.expense_occurrence_overrides (user_id);

create index if not exists expense_occurrence_overrides_template_id_idx
  on public.expense_occurrence_overrides (template_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

drop policy if exists "profiles own rows" on public.profiles;
drop policy if exists "categories own rows" on public.expense_categories;
drop policy if exists "templates own rows" on public.expense_templates;
drop policy if exists "overrides own rows" on public.expense_occurrence_overrides;
drop policy if exists "push own rows" on public.push_subscriptions;
drop policy if exists "app stores own rows" on public.app_stores;

create policy "profiles own rows" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "categories own rows" on public.expense_categories
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "templates own rows" on public.expense_templates
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "overrides own rows" on public.expense_occurrence_overrides
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "push own rows" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "app stores own rows" on public.app_stores
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
