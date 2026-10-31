select cron.schedule(
  'purge-rate-limits',
  '15 * * * *',
  $$ delete from public.rate_limits where created_at < now() - interval '48 hours' $$
);

select cron.schedule(
  'refresh-admin-stats',
  '30 2 * * *',
  $$ refresh materialized view public.mv_admin_stats $$
);

-- The weekly link checker (Phase 3) will be scheduled here once its Edge Function exists.
