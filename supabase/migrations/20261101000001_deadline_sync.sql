-- Automatic deadline sync from official sources (DAAD), with manual review for anything unverifiable.

create extension if not exists pg_net;

create type public.deadline_source as enum ('daad', 'hochschulkompass');

-- ─── Verification state per intake ──────────────────────────────────────────

alter table public.program_intakes
  add column verified_at timestamptz,
  add column verified_source public.deadline_source,
  add column needs_review boolean not null default false,
  add column review_reason text;

-- ─── Where each program is listed in an external source ─────────────────────

create table public.program_sources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  source public.deadline_source not null,
  external_id text,
  url text,
  auto_sync boolean not null default true,
  matched_by text not null default 'manual' check (matched_by in ('manual', 'auto')),
  last_checked_at timestamptz,
  last_status text check (last_status in ('ok', 'changed', 'flagged', 'unparsed', 'no_deadline', 'missing')),
  last_raw text,
  last_parsed_end date,
  created_at timestamptz not null default now(),
  unique (program_id, source),
  check (external_id is not null or url is not null)
);
create unique index program_sources_external_idx on public.program_sources (source, external_id)
  where external_id is not null;

create table public.deadline_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source public.deadline_source not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  courses_fetched int not null default 0,
  checked int not null default 0,
  verified int not null default 0,
  updated int not null default 0,
  flagged int not null default 0,
  auto_linked int not null default 0,
  error text
);
create index deadline_sync_runs_started_idx on public.deadline_sync_runs (started_at desc);

-- Every change the sync made or proposed. 'flagged' rows stay open until an admin resolves them.
create table public.deadline_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.deadline_sync_runs (id) on delete set null,
  program_id uuid not null references public.programs (id) on delete cascade,
  intake_id uuid references public.program_intakes (id) on delete set null,
  source public.deadline_source not null,
  action text not null check (action in ('applied', 'flagged')),
  old_end date,
  new_end date,
  reason text,
  raw text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index deadline_changes_open_idx on public.deadline_changes (created_at desc)
  where action = 'flagged' and resolved_at is null;
create index deadline_changes_program_idx on public.deadline_changes (program_id);

alter table public.program_sources enable row level security;
alter table public.deadline_sync_runs enable row level security;
alter table public.deadline_changes enable row level security;

create policy "admin all" on public.program_sources for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin read" on public.deadline_sync_runs for select to authenticated
  using ((select public.is_admin()));
create policy "admin read" on public.deadline_changes for select to authenticated
  using ((select public.is_admin()));

-- ─── Status: "closing soon" now covers the last 15 days (3 / 7 / 15-day buckets) ─

create or replace function public.admission_status(p_start date, p_end date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_end is null then 'unknown'
    when (p_start is null or p_start <= p_today) and p_end >= p_today then
      case when p_end - p_today <= 15 then 'closing_soon' else 'open' end
    when p_start is not null and p_start > p_today then
      case when p_start - p_today <= 60 then 'opening_soon' else 'closed' end
    else 'closed'
  end
$$;

-- A deadline counts as verified when a source confirmed it in the last 45 days, or an admin
-- verified the program in the last 180 days — and nothing has flagged it since.
create or replace function public.intake_verified(
  p_needs_review boolean, p_verified_at timestamptz, p_program_verified date
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not p_needs_review and coalesce(
    p_verified_at >= now() - interval '45 days'
    or p_program_verified >= public.berlin_today() - 180,
    false
  )
$$;

create or replace view public.v_public_programs with (security_invoker = true) as
select
  p.id, p.slug, p.name, p.degree_type, p.teaching_language,
  p.tuition_fee_eur::float8 as tuition_fee_eur,
  p.application_fee_eur::float8 as application_fee_eur,
  p.ielts_min::float8 as ielts_min,
  p.moi_accepted, p.german_level, p.vpd_required, p.nc_restricted, p.gre_gmat,
  p.portfolio_required, p.application_portal, p.official_url, p.application_url, p.last_verified_at,
  f.slug as field_slug,
  u.id as university_id, u.slug as university_slug, u.name as university_name,
  u.city, u.state as german_state, u.lat::float8 as lat, u.lng::float8 as lng, u.qs_ranking, u.qs_ranking_sort,
  coalesce((
    select array_agg(s.slug order by s.sort_order)
    from public.program_specializations ps
    join public.specializations s on s.id = ps.specialization_id
    where ps.program_id = p.id
  ), '{}') as specialization_slugs,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'season', i.season, 'year', i.academic_year,
      'start', i.application_start, 'end', i.application_end,
      'verified', public.intake_verified(i.needs_review, i.verified_at, p.last_verified_at)
    ) order by i.application_end nulls last)
    from public.program_intakes i
    where i.program_id = p.id
  ), '[]'::jsonb) as intakes
from public.programs p
join public.universities u on u.id = p.university_id and u.deleted_at is null
join public.fields f on f.id = p.field_id
where p.state = 'published' and p.deleted_at is null;

create or replace view public.v_public_program_detail with (security_invoker = true) as
select
  p.*,
  f.slug as field_slug, f.name as field_name,
  u.slug as university_slug, u.name as university_name, u.city, u.state as german_state,
  u.lat::float8 as lat, u.lng::float8 as lng, u.qs_ranking, u.website as university_website,
  coalesce((
    select jsonb_agg(jsonb_build_object('kind', h.kind, 'text', h.text) order by h.sort_order)
    from public.program_highlights h where h.program_id = p.id
  ), '[]'::jsonb) as highlights,
  coalesce((
    select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name) order by s.sort_order)
    from public.program_specializations ps
    join public.specializations s on s.id = ps.specialization_id
    where ps.program_id = p.id
  ), '[]'::jsonb) as specializations,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'season', i.season, 'year', i.academic_year, 'start', i.application_start,
      'end', i.application_end, 'eu_end', i.eu_end, 'note', i.note,
      'verified', public.intake_verified(i.needs_review, i.verified_at, p.last_verified_at),
      'verified_at', i.verified_at, 'verified_source', i.verified_source
    ) order by i.application_end nulls last)
    from public.program_intakes i where i.program_id = p.id
  ), '[]'::jsonb) as intakes,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r
    where r.program_id = p.id and r.status = 'approved') as review_avg,
  (select count(*) from public.reviews r
    where r.program_id = p.id and r.status = 'approved') as review_count
from public.programs p
join public.universities u on u.id = p.university_id and u.deleted_at is null
join public.fields f on f.id = p.field_id
where p.state = 'published' and p.deleted_at is null;

-- ─── Admin: resolve a flagged deadline ──────────────────────────────────────

/**
 * Accept applies the proposed deadline to the chosen intake (p_intake_id overrides the
 * flagged one) and marks it verified. Dismiss just closes the flag. Either way the intake's
 * review flag clears.
 */
create or replace function public.admin_resolve_deadline_change(
  p_id uuid, p_accept boolean, p_intake_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.deadline_changes;
  v_intake uuid;
begin
  perform public.require_admin();
  select * into v from public.deadline_changes where id = p_id for update;
  if v.id is null then raise exception 'not found'; end if;
  v_intake := coalesce(p_intake_id, v.intake_id);

  if p_accept then
    if v_intake is null or v.new_end is null then
      raise exception 'choose an intake to apply this deadline to';
    end if;
    update public.program_intakes
      set application_end = v.new_end, verified_at = now(), verified_source = v.source,
          needs_review = false, review_reason = null
      where id = v_intake and program_id = v.program_id;
    if not found then raise exception 'intake does not belong to this program'; end if;
  elsif v_intake is not null then
    update public.program_intakes set needs_review = false, review_reason = null
      where id = v_intake and program_id = v.program_id;
  end if;

  update public.deadline_changes
    set resolved_at = now(), resolved_by = auth.uid(), intake_id = v_intake
    where id = p_id;
  perform public.log_admin_action(
    case when p_accept then 'deadline.accept' else 'deadline.dismiss' end,
    'deadline_changes', p_id, to_jsonb(v), null
  );
end;
$$;

-- ─── Schedule: every 12 hours ───────────────────────────────────────────────
-- Reads the function URL and secret from Vault so no secret lives in this file. Set once per env:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random>', 'deadline_sync_secret');
-- and give the Edge Function the same value as DEADLINE_SYNC_SECRET.
select cron.schedule(
  'deadline-sync',
  '0 */12 * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/deadline-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'deadline_sync_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
    where exists (select 1 from vault.decrypted_secrets where name = 'deadline_sync_secret')
  $job$
);

select cron.schedule(
  'purge-deadline-sync-runs',
  '20 3 * * 0',
  $$ delete from public.deadline_sync_runs where started_at < now() - interval '180 days' $$
);
