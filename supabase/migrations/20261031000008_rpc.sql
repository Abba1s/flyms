-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid())
$$;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.log_admin_action(
  p_action text, p_entity text, p_entity_id uuid, p_before jsonb, p_after jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_before, p_after)
$$;
revoke execute on function public.log_admin_action(text, text, uuid, jsonb, jsonb) from public, anon, authenticated;

-- ─── Public counters ────────────────────────────────────────────────────────

create or replace function public.increment_program_view(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.programs set view_count = view_count + 1
  where id = p_id and state = 'published' and deleted_at is null
$$;

create or replace function public.increment_program_save(p_id uuid, delta int)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.programs set save_count = greatest(0, save_count + sign(delta)::int)
  where id = p_id and state = 'published' and deleted_at is null
$$;

create or replace function public.increment_site_views()
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.site_stats set value = value + 1 where key = 'total_views' returning value
$$;

-- ─── Rate limiting (service role only) ──────────────────────────────────────

create or replace function public.check_rate_limit(p_key text, p_bucket text, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, bucket, day, count)
  values (p_key, p_bucket, public.berlin_today(), 1)
  on conflict (key, bucket, day) do update set count = public.rate_limits.count + 1
  returning count into v_count;

  insert into public.usage_daily (day, bucket, count)
  values (public.berlin_today(), p_bucket, 1)
  on conflict (day, bucket) do update set count = public.usage_daily.count + 1;

  return v_count <= p_max;
end;
$$;
revoke execute on function public.check_rate_limit(text, text, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, int) to service_role;

-- ─── Admin: programs ────────────────────────────────────────────────────────

/**
 * Create or update a program from JSON. Keys absent from the payload keep their current value.
 * Optional arrays replace children when present: intakes, specialization_ids, highlights.
 */
create or replace function public.admin_upsert_program(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.programs;
  v_new public.programs;
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
begin
  perform public.require_admin();

  if v_id is not null then
    select * into v_old from public.programs where id = v_id for update;
    if not found then raise exception 'program % not found', v_id; end if;
  end if;

  v_new := jsonb_populate_record(coalesce(v_old, null::public.programs), payload);

  if v_old.id is null then
    insert into public.programs (
      slug, university_id, field_id, name, degree_type, teaching_language, duration_semesters, ects,
      official_url, application_url, application_portal, tuition_fee_eur, tuition_note,
      semester_contribution_eur, application_fee_eur, ielts_min, toefl_min, english_note,
      moi_accepted, german_level, vpd_required, aps_required, nc_restricted, gre_gmat,
      entrance_exam_interview, portfolio_required, work_experience_years, min_gpa_note, summary,
      letter_note, state, last_verified_at, source_url
    ) values (
      v_new.slug, v_new.university_id, v_new.field_id, v_new.name, v_new.degree_type,
      v_new.teaching_language, v_new.duration_semesters, v_new.ects, v_new.official_url,
      v_new.application_url, v_new.application_portal, v_new.tuition_fee_eur, v_new.tuition_note,
      v_new.semester_contribution_eur, v_new.application_fee_eur, v_new.ielts_min, v_new.toefl_min,
      v_new.english_note, v_new.moi_accepted, v_new.german_level, v_new.vpd_required,
      v_new.aps_required, v_new.nc_restricted, v_new.gre_gmat, v_new.entrance_exam_interview,
      coalesce(v_new.portfolio_required, false), v_new.work_experience_years, v_new.min_gpa_note,
      v_new.summary, v_new.letter_note, coalesce(v_new.state, 'draft'), v_new.last_verified_at,
      v_new.source_url
    ) returning * into v_new;
  else
    update public.programs set
      slug = v_new.slug, university_id = v_new.university_id, field_id = v_new.field_id,
      name = v_new.name, degree_type = v_new.degree_type, teaching_language = v_new.teaching_language,
      duration_semesters = v_new.duration_semesters, ects = v_new.ects,
      official_url = v_new.official_url, application_url = v_new.application_url,
      application_portal = v_new.application_portal, tuition_fee_eur = v_new.tuition_fee_eur,
      tuition_note = v_new.tuition_note, semester_contribution_eur = v_new.semester_contribution_eur,
      application_fee_eur = v_new.application_fee_eur, ielts_min = v_new.ielts_min,
      toefl_min = v_new.toefl_min, english_note = v_new.english_note,
      moi_accepted = v_new.moi_accepted, german_level = v_new.german_level,
      vpd_required = v_new.vpd_required, aps_required = v_new.aps_required,
      nc_restricted = v_new.nc_restricted, gre_gmat = v_new.gre_gmat,
      entrance_exam_interview = v_new.entrance_exam_interview,
      portfolio_required = v_new.portfolio_required,
      work_experience_years = v_new.work_experience_years, min_gpa_note = v_new.min_gpa_note,
      summary = v_new.summary, letter_note = v_new.letter_note, state = v_new.state,
      last_verified_at = v_new.last_verified_at, source_url = v_new.source_url
    where id = v_old.id
    returning * into v_new;
  end if;

  if payload ? 'intakes' then
    delete from public.program_intakes where program_id = v_new.id;
    insert into public.program_intakes
      (program_id, season, academic_year, application_start, application_end, eu_end, note)
    select v_new.id, (i ->> 'season')::public.intake_season, i ->> 'academic_year',
      (i ->> 'application_start')::date, (i ->> 'application_end')::date,
      (i ->> 'eu_end')::date, i ->> 'note'
    from jsonb_array_elements(payload -> 'intakes') i;
  end if;

  if payload ? 'specialization_ids' then
    delete from public.program_specializations where program_id = v_new.id;
    insert into public.program_specializations (program_id, specialization_id)
    select v_new.id, s::uuid from jsonb_array_elements_text(payload -> 'specialization_ids') s;
  end if;

  if payload ? 'highlights' then
    delete from public.program_highlights where program_id = v_new.id;
    insert into public.program_highlights (program_id, kind, text, sort_order)
    select v_new.id, h.value ->> 'kind', h.value ->> 'text', h.ordinality::int
    from jsonb_array_elements(payload -> 'highlights') with ordinality h;
  end if;

  perform public.log_admin_action(
    case when v_old.id is null then 'program.create' else 'program.update' end,
    'programs', v_new.id, to_jsonb(v_old), to_jsonb(v_new)
  );
  return v_new.id;
end;
$$;

create or replace function public.admin_set_program_state(p_id uuid, p_state public.publish_state)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.programs set state = p_state where id = p_id;
  perform public.log_admin_action('program.set_state', 'programs', p_id, null,
    jsonb_build_object('state', p_state));
end;
$$;

create or replace function public.admin_mark_verified(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.programs set last_verified_at = public.berlin_today() where id = p_id;
  perform public.log_admin_action('program.verify', 'programs', p_id, null,
    jsonb_build_object('last_verified_at', public.berlin_today()));
end;
$$;

create or replace function public.admin_soft_delete_program(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.programs set deleted_at = now() where id = p_id and deleted_at is null;
  perform public.log_admin_action('program.delete', 'programs', p_id, null, null);
end;
$$;

create or replace function public.admin_restore_program(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.programs set deleted_at = null where id = p_id;
  perform public.log_admin_action('program.restore', 'programs', p_id, null, null);
end;
$$;

-- ─── Admin: moderation ──────────────────────────────────────────────────────

/** Approve a change request. `p_final_payload` lets the admin correct the proposal first. */
create or replace function public.admin_approve_change_request(p_id uuid, p_final_payload jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.change_requests;
  v_payload jsonb;
  v_program_id uuid;
begin
  perform public.require_admin();
  select * into v_req from public.change_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'pending change request % not found', p_id; end if;

  v_payload := coalesce(p_final_payload, v_req.payload);
  if v_req.type = 'update_program' then
    v_payload := v_payload || jsonb_build_object('id', v_req.program_id);
  else
    v_payload := v_payload - 'id';
  end if;

  v_program_id := public.admin_upsert_program(v_payload);

  update public.change_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), program_id = v_program_id
  where id = p_id;
  perform public.log_admin_action('change_request.approve', 'change_requests', p_id, null, v_payload);
  return v_program_id;
end;
$$;

create or replace function public.admin_reject_change_request(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.change_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), reject_reason = p_reason
  where id = p_id and status = 'pending';
  perform public.log_admin_action('change_request.reject', 'change_requests', p_id, null,
    jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.data_reports set resolved_at = now(), resolved_by = auth.uid()
  where id = p_id and resolved_at is null;
  perform public.log_admin_action('report.resolve', 'data_reports', p_id, null, null);
end;
$$;

create or replace function public.admin_set_review_status(p_id uuid, p_status public.moderation_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.reviews set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  perform public.log_admin_action('review.set_status', 'reviews', p_id, null,
    jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.admin_delete_review(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.reviews;
begin
  perform public.require_admin();
  delete from public.reviews where id = p_id returning * into v_old;
  perform public.log_admin_action('review.delete', 'reviews', p_id, to_jsonb(v_old), null);
end;
$$;

create or replace function public.admin_mark_question_read(p_id uuid, p_read boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.questions set is_read = p_read where id = p_id;
end;
$$;

create or replace function public.admin_delete_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.questions set deleted_at = now() where id = p_id;
  perform public.log_admin_action('question.delete', 'questions', p_id, null, null);
end;
$$;

-- ─── Admin: imports & stats ─────────────────────────────────────────────────

create or replace function public.apply_import_rows(p_batch_id uuid, p_row_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.import_rows;
  v_applied int := 0;
begin
  perform public.require_admin();
  for v_row in
    select * from public.import_rows
    where batch_id = p_batch_id and id = any (p_row_ids)
      and action in ('new', 'update') and applied_at is null and cardinality(errors) = 0
    order by row_number
  loop
    perform public.admin_upsert_program(
      case when v_row.action = 'update'
        then v_row.parsed || jsonb_build_object('id', v_row.target_program_id)
        else v_row.parsed - 'id'
      end
    );
    update public.import_rows set approved = true, applied_at = now() where id = v_row.id;
    v_applied := v_applied + 1;
  end loop;

  if not exists (
    select 1 from public.import_rows
    where batch_id = p_batch_id and action in ('new', 'update') and applied_at is null
  ) then
    update public.import_batches set status = 'applied' where id = p_batch_id;
  end if;
  return v_applied;
end;
$$;

create or replace function public.admin_stats()
returns setof public.mv_admin_stats
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  refresh materialized view public.mv_admin_stats;
  return query select * from public.mv_admin_stats order by field_slug;
end;
$$;
