-- Default deny: RLS on every table; anonymous users only read published data.
alter table public.fields enable row level security;
alter table public.specializations enable row level security;
alter table public.universities enable row level security;
alter table public.programs enable row level security;
alter table public.program_intakes enable row level security;
alter table public.program_specializations enable row level security;
alter table public.program_highlights enable row level security;
alter table public.change_requests enable row level security;
alter table public.data_reports enable row level security;
alter table public.questions enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
alter table public.link_checks enable row level security;
alter table public.rate_limits enable row level security;
alter table public.usage_daily enable row level security;
alter table public.site_stats enable row level security;

-- Reference data
create policy "public read" on public.fields for select to anon, authenticated using (true);
create policy "admin write" on public.fields for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read" on public.specializations for select to anon, authenticated using (true);
create policy "admin write" on public.specializations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read live" on public.universities for select to anon, authenticated
  using (deleted_at is null or (select public.is_admin()));
create policy "admin write" on public.universities for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Programs and children: published, non-deleted only (admins see everything)
create policy "public read published" on public.programs for select to anon, authenticated
  using ((state = 'published' and deleted_at is null) or (select public.is_admin()));
create policy "admin write" on public.programs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read published" on public.program_intakes for select to anon, authenticated
  using (exists (select 1 from public.programs p where p.id = program_id));
create policy "admin write" on public.program_intakes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read published" on public.program_specializations for select to anon, authenticated
  using (exists (select 1 from public.programs p where p.id = program_id));
create policy "admin write" on public.program_specializations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public read published" on public.program_highlights for select to anon, authenticated
  using (exists (select 1 from public.programs p where p.id = program_id));
create policy "admin write" on public.program_highlights for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Reviews: approved ones are public
create policy "public read approved" on public.reviews for select to anon, authenticated
  using (status = 'approved' or (select public.is_admin()));

-- Moderation & admin tables: admins only (public inserts go through Edge Functions)
create policy "admin read" on public.change_requests for select to authenticated using ((select public.is_admin()));
create policy "admin read" on public.data_reports for select to authenticated using ((select public.is_admin()));
create policy "admin read" on public.questions for select to authenticated using ((select public.is_admin()));
create policy "admin read" on public.admin_users for select to authenticated using ((select public.is_admin()));
create policy "admin read" on public.admin_audit_log for select to authenticated using ((select public.is_admin()));
create policy "admin all" on public.import_batches for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.import_rows for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin read" on public.link_checks for select to authenticated using ((select public.is_admin()));

create policy "public read" on public.site_stats for select to anon, authenticated using (true);

-- rate_limits, usage_daily: no policies → service role only.

-- Writes from anon/authenticated happen only through RLS-guarded admin policies or RPCs.
revoke insert, update, delete, truncate on all tables in schema public from anon;

-- Storage: private bucket for admin CSV imports
insert into storage.buckets (id, name, public) values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "admin imports read" on storage.objects for select to authenticated
  using (bucket_id = 'imports' and (select public.is_admin()));
create policy "admin imports write" on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and (select public.is_admin()));
create policy "admin imports delete" on storage.objects for delete to authenticated
  using (bucket_id = 'imports' and (select public.is_admin()));
