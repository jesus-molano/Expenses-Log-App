truncate table
  public.push_subscriptions,
  public.expense_occurrence_overrides,
  public.expense_templates,
  public.expense_categories,
  public.app_stores,
  public.profiles
restart identity cascade;

notify pgrst, 'reload schema';
