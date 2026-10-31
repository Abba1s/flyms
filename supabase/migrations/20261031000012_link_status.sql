-- Latest link-check result per program link (admins only, via RLS on link_checks).
create view public.v_link_status with (security_invoker = true) as
select distinct on (lc.program_id, lc.url)
  lc.program_id, lc.url, lc.http_status, lc.ok, lc.checked_at,
  p.name as program_name, p.slug as program_slug
from public.link_checks lc
join public.programs p on p.id = lc.program_id
order by lc.program_id, lc.url, lc.checked_at desc;

-- Keep 90 days of history.
select cron.schedule(
  'purge-link-checks',
  '0 3 * * 0',
  $$ delete from public.link_checks where checked_at < now() - interval '90 days' $$
);

-- The weekly run itself is scheduled per environment (it needs the function URL and secret):
--   select cron.schedule('weekly-link-check', '0 4 * * 1', $job$
--     select net.http_post(
--       url := '<SUPABASE_URL>/functions/v1/link-checker',
--       headers := jsonb_build_object('x-cron-secret', '<LINK_CHECK_SECRET>', 'Content-Type', 'application/json'),
--       body := '{}'::jsonb)
--   $job$);
