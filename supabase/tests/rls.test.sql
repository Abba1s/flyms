begin;
select plan(18);

-- Fixtures: one admin, one ordinary signed-in user, one draft program.
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-00000000a001', 'admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b001', 'user@test.local', 'authenticated', 'authenticated');
insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-00000000a001');

update public.programs set state = 'draft'
where id = (select id from public.programs order by slug limit 1);

insert into public.change_requests (type, payload, submitter_name, submitter_email)
values ('new_program', '{"name": "Test"}', 'Tester', 'tester@test.local');
insert into public.questions (name, email, message) values ('Q', 'q@test.local', 'Hello?');

create temp table expected as
select
  (select count(*) from public.programs where state = 'published' and deleted_at is null) as published,
  (select id from public.programs where state = 'draft' limit 1) as draft_id,
  (select id from public.programs where state = 'published' limit 1) as published_id,
  (select count(*) from public.change_requests) as change_requests;
grant select on expected to anon, authenticated;

-- ── Anonymous visitor ───────────────────────────────────────────────────────
set local role anon;

select is((select count(*) from public.v_public_programs), (select published from expected),
  'anon sees exactly the published programs');
select is_empty(
  $$ select 1 from public.v_public_programs where id = (select draft_id from expected) $$,
  'anon cannot see draft programs');
select is_empty(
  $$ select 1 from public.program_intakes where program_id = (select draft_id from expected) $$,
  'anon cannot see intakes of draft programs');
select ok((select count(*) from public.fields) = 12, 'anon can read fields');
select is_empty($$ select 1 from public.change_requests $$, 'anon cannot read change requests');
select is_empty($$ select 1 from public.questions $$, 'anon cannot read questions');
select throws_ok(
  $$ insert into public.questions (name, email, message) values ('x', 'x@x', 'x') $$,
  '42501', null, 'anon cannot insert questions directly');
select throws_ok(
  $$ update public.programs set name = 'hacked' $$,
  '42501', null, 'anon cannot update programs');
select throws_ok(
  $$ select public.admin_soft_delete_program((select published_id from expected)) $$,
  '42501', null, 'anon cannot call admin RPCs');
select throws_ok(
  $$ select public.check_rate_limit('k', 'b', 1) $$,
  '42501', null, 'anon cannot call the rate limiter');
select lives_ok(
  $$ select public.increment_program_view((select published_id from expected)) $$,
  'anon can increment a view counter');

-- ── Signed-in non-admin ─────────────────────────────────────────────────────
reset role;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000b001", "role": "authenticated"}';
set local role authenticated;

select is_empty($$ select 1 from public.change_requests $$, 'non-admin cannot read change requests');
select throws_ok(
  $$ select public.admin_mark_verified((select published_id from expected)) $$,
  '42501', null, 'non-admin cannot call admin RPCs');
select is(
  (select count(*) from public.programs where id = (select draft_id from expected)), 0::bigint,
  'non-admin cannot see draft programs');

-- ── Admin ───────────────────────────────────────────────────────────────────
reset role;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000a001", "role": "authenticated"}';
set local role authenticated;

select is((select count(*) from public.change_requests), (select change_requests from expected),
  'admin can read all change requests');
select lives_ok(
  $$ select public.admin_mark_verified((select published_id from expected)) $$,
  'admin can mark a program verified');
select ok(
  exists (select 1 from public.admin_audit_log
          where action = 'program.verify' and entity_id = (select published_id from expected)
            and actor = '00000000-0000-0000-0000-00000000a001'),
  'admin actions are written to the audit log');

update public.universities set short_name = 'Audit test' where id = (select id from public.universities limit 1);
select ok(
  exists (select 1 from public.admin_audit_log where action = 'universities.update'
          and actor = '00000000-0000-0000-0000-00000000a001'),
  'direct admin edits to universities are audited');

select * from finish();
rollback;
