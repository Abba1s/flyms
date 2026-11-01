-- Resolving a flagged deadline is an admin check of that program, so it counts as verified
-- for 180 days (like "Mark verified"), whether the admin applied DAAD's date or kept ours.

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
      set application_end = v.new_end, verified_at = now(), verified_source = v.source
      where id = v_intake and program_id = v.program_id;
    if not found then raise exception 'intake does not belong to this program'; end if;
  end if;

  -- The admin has looked at this program: clear its review flags and record the check.
  update public.program_intakes set needs_review = false, review_reason = null
    where program_id = v.program_id and needs_review;
  update public.programs set last_verified_at = public.berlin_today() where id = v.program_id;

  update public.deadline_changes
    set resolved_at = now(), resolved_by = auth.uid(), intake_id = v_intake
    where id = p_id;
  perform public.log_admin_action(
    case when p_accept then 'deadline.accept' else 'deadline.dismiss' end,
    'deadline_changes', p_id, to_jsonb(v), null
  );
end;
$$;

-- Backfill flags already resolved under the old behaviour (programs with no flag still open).
with reviewed as (
  select program_id, max(resolved_at) as at
  from public.deadline_changes
  where action = 'flagged' and resolved_at is not null
  group by program_id
)
update public.programs p
  set last_verified_at = greatest(coalesce(p.last_verified_at, '-infinity'::date),
                                  (r.at at time zone 'Europe/Berlin')::date)
  from reviewed r
  where p.id = r.program_id
    and not exists (
      select 1 from public.deadline_changes o
      where o.program_id = p.id and o.action = 'flagged' and o.resolved_at is null
    );

update public.program_intakes i set needs_review = false, review_reason = null
  where needs_review
    and not exists (
      select 1 from public.deadline_changes o
      where o.program_id = i.program_id and o.action = 'flagged' and o.resolved_at is null
    )
    and exists (
      select 1 from public.deadline_changes c
      where c.program_id = i.program_id and c.action = 'flagged' and c.resolved_at is not null
    );
