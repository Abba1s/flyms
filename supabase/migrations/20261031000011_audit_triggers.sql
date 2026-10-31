-- Audit direct admin edits to reference tables (programs are audited inside their RPCs).
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only edits made by a signed-in user (admins via RLS); seeds and migrations are not logged.
  if auth.uid() is not null then
    insert into public.admin_audit_log (actor, action, entity, entity_id, before, after)
    values (
      auth.uid(),
      tg_table_name || '.' || lower(tg_op),
      tg_table_name,
      coalesce(new.id, old.id),
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end
    );
  end if;
  return coalesce(new, old);
end;
$$;

create trigger universities_audit after insert or update or delete on public.universities
  for each row execute function public.audit_row_change();
create trigger fields_audit after insert or update or delete on public.fields
  for each row execute function public.audit_row_change();
create trigger specializations_audit after insert or update or delete on public.specializations
  for each row execute function public.audit_row_change();
