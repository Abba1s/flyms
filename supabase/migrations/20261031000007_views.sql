-- Public views run with the caller's permissions, so RLS on base tables decides visibility.

create view public.v_public_programs with (security_invoker = true) as
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
      'start', i.application_start, 'end', i.application_end
    ) order by i.application_end nulls last)
    from public.program_intakes i
    where i.program_id = p.id
  ), '[]'::jsonb) as intakes
from public.programs p
join public.universities u on u.id = p.university_id and u.deleted_at is null
join public.fields f on f.id = p.field_id
where p.state = 'published' and p.deleted_at is null;

create view public.v_public_reviews with (security_invoker = true) as
select id, program_id, rating, comment, relation, display_name, created_at
from public.reviews
where status = 'approved';

create view public.v_public_program_detail with (security_invoker = true) as
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
      'end', i.application_end, 'eu_end', i.eu_end, 'note', i.note
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

-- Per-intake status for admin dashboards and counts.
create view public.v_program_status with (security_invoker = true) as
select i.program_id, i.id as intake_id, i.season, i.academic_year,
  public.admission_status(i.application_start, i.application_end, public.berlin_today()) as status
from public.program_intakes i;

create materialized view public.mv_admin_stats as
select
  f.slug as field_slug,
  count(distinct p.id) filter (where p.state = 'published' and p.deleted_at is null) as published,
  count(distinct p.id) filter (where p.state = 'draft' and p.deleted_at is null) as drafts,
  count(distinct p.id) filter (
    where p.state = 'published' and p.deleted_at is null
      and public.admission_status(i.application_start, i.application_end, public.berlin_today())
          in ('open', 'closing_soon')
  ) as open_now,
  count(distinct p.id) filter (
    where p.deleted_at is null
      and (p.last_verified_at is null or p.last_verified_at < public.berlin_today() - 180)
  ) as stale,
  now() as refreshed_at
from public.fields f
left join public.programs p on p.field_id = f.id
left join public.program_intakes i on i.program_id = p.id
group by f.slug;
revoke all on public.mv_admin_stats from anon, authenticated;
