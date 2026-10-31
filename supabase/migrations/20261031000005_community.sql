create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  type public.change_request_type not null,
  program_id uuid references public.programs (id) on delete set null,
  payload jsonb not null,
  submitter_name text not null check (length(submitter_name) <= 120),
  submitter_email text not null check (length(submitter_email) <= 254),
  submitter_phone text check (length(submitter_phone) <= 40),
  note text check (length(note) <= 2000),
  status public.moderation_status not null default 'pending',
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  check (type = 'new_program' or program_id is not null)
);
create index change_requests_status_idx on public.change_requests (status, created_at desc);

create table public.data_reports (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  kind public.report_kind not null,
  message text check (length(message) <= 1000),
  reporter_email text check (length(reporter_email) <= 254),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index data_reports_open_idx on public.data_reports (created_at desc) where resolved_at is null;

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) <= 120),
  email text not null check (length(email) <= 254),
  message text not null check (length(message) <= 2000),
  is_read boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (length(comment) <= 2000),
  relation text not null check (relation in ('current_student', 'alumni', 'admitted', 'applicant')),
  display_name text not null check (length(display_name) <= 80),
  status public.moderation_status not null default 'pending',
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index reviews_program_idx on public.reviews (program_id) where status = 'approved';
