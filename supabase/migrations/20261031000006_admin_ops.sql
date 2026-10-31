create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_path text not null,
  uploaded_by uuid references auth.users (id),
  row_count int not null default 0,
  status text not null default 'parsed' check (status in ('parsed', 'applied', 'discarded')),
  created_at timestamptz not null default now()
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  row_number int not null,
  raw jsonb not null,
  parsed jsonb,
  action public.import_row_action not null,
  target_program_id uuid references public.programs (id) on delete set null,
  errors text[] not null default '{}',
  approved boolean not null default false,
  applied_at timestamptz
);
create index import_rows_batch_idx on public.import_rows (batch_id, row_number);

create table public.link_checks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  url text not null,
  http_status int,
  ok boolean not null,
  checked_at timestamptz not null default now()
);
create index link_checks_program_idx on public.link_checks (program_id, checked_at desc);

-- Keys are hashes of (IP, daily salt) computed in Edge Functions; raw IPs are never stored.
create table public.rate_limits (
  key text not null,
  bucket text not null,
  day date not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  primary key (key, bucket, day)
);

create table public.usage_daily (
  day date not null,
  bucket text not null,
  count int not null default 0,
  primary key (day, bucket)
);

create table public.site_stats (
  key text primary key,
  value bigint not null default 0
);
insert into public.site_stats (key, value) values ('total_views', 0);
