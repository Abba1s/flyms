create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  isced_code text,
  icon text not null default 'book',
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sop_template public.sop_template not null,
  sort_order int not null default 0
);

create table public.specializations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  slug text not null,
  name text not null,
  isced_code text,
  sort_order int not null default 0,
  unique (field_id, slug)
);
create index specializations_field_idx on public.specializations (field_id);

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  type public.university_type not null default 'university',
  city text not null,
  state text not null,
  lat numeric(9, 6) not null check (lat between 47 and 56),
  lng numeric(9, 6) not null check (lng between 5 and 16),
  website text,
  qs_ranking text,
  qs_ranking_sort int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger universities_updated_at before update on public.universities
  for each row execute function public.set_updated_at();
