create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  university_id uuid not null references public.universities (id),
  field_id uuid not null references public.fields (id),
  name text not null,
  degree_type public.degree_type not null,
  teaching_language public.teaching_language not null,
  duration_semesters smallint check (duration_semesters between 1 and 8),
  ects smallint check (ects between 30 and 180),
  official_url text not null,
  application_url text,
  application_portal public.application_portal,
  tuition_fee_eur numeric(8, 2) check (tuition_fee_eur >= 0),
  tuition_note text,
  semester_contribution_eur numeric(8, 2) check (semester_contribution_eur >= 0),
  application_fee_eur numeric(8, 2) check (application_fee_eur >= 0),
  ielts_min numeric(2, 1) check (ielts_min between 0 and 9),
  toefl_min smallint check (toefl_min between 0 and 120),
  english_note text,
  moi_accepted boolean,
  german_level text,
  vpd_required boolean,
  aps_required boolean,
  nc_restricted boolean,
  gre_gmat text,
  entrance_exam_interview text,
  portfolio_required boolean not null default false,
  work_experience_years smallint check (work_experience_years between 0 and 20),
  min_gpa_note text,
  summary text,
  letter_note text,
  state public.publish_state not null default 'draft',
  last_verified_at date,
  source_url text,
  view_count int not null default 0,
  save_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index programs_field_idx on public.programs (field_id);
create index programs_university_idx on public.programs (university_id);
create index programs_public_idx on public.programs (state, deleted_at);
create index programs_name_trgm_idx on public.programs using gin (name extensions.gin_trgm_ops);
create trigger programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();

create table public.program_intakes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  season public.intake_season not null,
  academic_year text not null,
  application_start date,
  application_end date,
  eu_end date,
  note text,
  unique (program_id, season, academic_year),
  check (application_start is null or application_end is null or application_start <= application_end)
);
create index program_intakes_program_idx on public.program_intakes (program_id);

create table public.program_specializations (
  program_id uuid not null references public.programs (id) on delete cascade,
  specialization_id uuid not null references public.specializations (id) on delete cascade,
  primary key (program_id, specialization_id)
);
create index program_specializations_spec_idx on public.program_specializations (specialization_id);

create table public.program_highlights (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  kind text not null check (kind in ('module', 'lab', 'research_group', 'feature')),
  text text not null,
  sort_order int not null default 0
);
create index program_highlights_program_idx on public.program_highlights (program_id);

-- Admission status — mirrors packages/shared/src/status.ts (kept in sync by status-vectors.json).
create or replace function public.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Berlin')::date $$;

create or replace function public.admission_status(p_start date, p_end date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_end is null then 'unknown'
    when (p_start is null or p_start <= p_today) and p_end >= p_today then
      case when p_end - p_today <= 14 then 'closing_soon' else 'open' end
    when p_start is not null and p_start > p_today then
      case when p_start - p_today <= 60 then 'opening_soon' else 'closed' end
    else 'closed'
  end
$$;
