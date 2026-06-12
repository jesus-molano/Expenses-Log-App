drop table if exists public.expense_occurrence_overrides cascade;
drop table if exists public.expense_templates cascade;
drop table if exists public.expense_categories cascade;

truncate table
  public.push_subscriptions,
  public.app_stores,
  public.profiles
restart identity cascade;

notify pgrst, 'reload schema';
