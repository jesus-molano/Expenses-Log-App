-- Salud de las suscripciones push (M12). Solo añade columnas con valor por
-- defecto: la app y el cron funcionan antes y después de aplicarla.
-- - failure_count: envíos fallidos seguidos (sin contar 404/410, que borran
--   la suscripción al momento). El cron la borra al llegar a 5.
-- - last_failure_at / last_success_at: diagnóstico.
-- El latido de la app (alta de la suscripción) renueva updated_at y pone
-- failure_count a 0.
alter table public.push_subscriptions
  add column if not exists failure_count integer not null default 0,
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_success_at timestamptz;

notify pgrst, 'reload schema';
