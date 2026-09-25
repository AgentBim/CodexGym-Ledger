-- Additive, backward-compatible template schedule preview and atomic update RPCs.
-- Existing save_template and all ledger tables remain unchanged.

create or replace function public.preview_template_schedule(
  p_template_id uuid,
  p_weekday smallint,
  p_starts_on date,
  p_ends_on date,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_template public.recurring_session_templates%rowtype;
  v_today date := (now() at time zone 'America/Barbados')::date;
  v_first date;
  v_eligible integer;
  v_excluded integer;
  v_conflicts integer;
  v_changes jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'invalid_weekday'; end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on < p_starts_on) then raise exception 'invalid_date_range'; end if;

  select * into v_template
  from public.recurring_session_templates
  where owner_id = v_owner and id = p_template_id;
  if not found then raise exception 'template_not_found'; end if;
  if p_expected_version is null or v_template.version <> p_expected_version then raise exception 'stale_operation'; end if;

  v_first := greatest(p_starts_on, v_today);
  v_first := v_first + ((p_weekday - extract(isodow from v_first)::integer + 7) % 7);

  with eligible as (
    select s.*, row_number() over (order by s.session_date, s.id) - 1 as sequence
    from public.sessions s
    where s.owner_id = v_owner and s.template_id = p_template_id
      and s.session_date >= v_today and s.source = 'recurrence'
      and s.manually_edited_at is null and s.status = 'scheduled' and s.voided_at is null
  ), planned as (
    select e.id, e.session_date as old_date, v_first + (e.sequence::integer * 7) as new_date
    from eligible e
  ), affected as (
    select * from planned where p_ends_on is null or new_date <= p_ends_on
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object('sessionId', id, 'oldDate', old_date, 'newDate', new_date) order by old_date), '[]'::jsonb)
  into v_eligible, v_changes from affected;

  select count(*) into v_excluded
  from public.sessions s
  where s.owner_id = v_owner and s.template_id = p_template_id and s.session_date >= v_today and s.voided_at is null
    and not (s.source = 'recurrence' and s.manually_edited_at is null and s.status = 'scheduled') ;

  select count(*) into v_conflicts
  from jsonb_array_elements(v_changes) change
  where exists (
    select 1 from public.sessions other
    where other.owner_id = v_owner and other.student_id = v_template.student_id
      and other.session_date = (change->>'newDate')::date and other.voided_at is null
      and other.id <> (change->>'sessionId')::uuid
      and not exists (select 1 from jsonb_array_elements(v_changes) moved where (moved->>'sessionId')::uuid = other.id)
  );

  return jsonb_build_object(
    'templateId', v_template.id,
    'expectedVersion', v_template.version,
    'oldSchedule', jsonb_build_object('weekday', v_template.weekday, 'startsOn', v_template.starts_on, 'endsOn', v_template.ends_on),
    'newSchedule', jsonb_build_object('weekday', p_weekday, 'startsOn', p_starts_on, 'endsOn', p_ends_on),
    'affectedCount', v_eligible,
    'excludedCount', v_excluded,
    'conflictCount', v_conflicts,
    'changes', v_changes
  );
end;
$$;

create or replace function public.save_template_schedule(
  p_idempotency_key uuid,
  p_request_hash text,
  p_template_id uuid,
  p_student_id uuid,
  p_weekday smallint,
  p_starts_on date,
  p_ends_on date,
  p_paused boolean,
  p_archived boolean,
  p_expected_version integer,
  p_future_mode text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_template public.recurring_session_templates%rowtype;
  v_before jsonb;
  v_preview jsonb;
  v_today date := (now() at time zone 'America/Barbados')::date;
  v_first date;
  v_result jsonb;
  v_row record;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if p_future_mode not in ('keep', 'update') then raise exception 'invalid_future_mode'; end if;
  if p_template_id is null then raise exception 'template_not_found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('recurrence:' || v_owner::text, 0));
  v_operation := app_private.begin_operation(p_idempotency_key, p_request_hash, 'save_template_schedule', false);
  if v_operation.state = 'completed' then return v_operation.result; end if;

  select * into v_template from public.recurring_session_templates
  where owner_id = v_owner and id = p_template_id for update;
  if not found then raise exception 'template_not_found'; end if;
  if p_expected_version is null or v_template.version <> p_expected_version then raise exception 'stale_operation'; end if;
  if v_template.student_id <> p_student_id then raise exception 'student_mismatch'; end if;
  perform 1 from public.students where owner_id = v_owner and id = p_student_id;
  if not found then raise exception 'student_not_found'; end if;

  v_preview := public.preview_template_schedule(p_template_id, p_weekday, p_starts_on, p_ends_on, p_expected_version);
  if p_future_mode = 'update' and (v_preview->>'conflictCount')::integer > 0 then raise exception 'session_exists'; end if;
  v_before := to_jsonb(v_template);

  update public.recurring_session_templates set weekday = p_weekday, starts_on = p_starts_on, ends_on = p_ends_on,
    paused_at = case when p_paused then coalesce(paused_at, now()) else null end,
    archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
    version = version + 1, updated_at = now()
  where owner_id = v_owner and id = p_template_id returning * into v_template;

  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'template', v_template.id, 'schedule_updated', v_before, to_jsonb(v_template), v_template.version);

  if p_future_mode = 'update' then
    v_first := greatest(p_starts_on, v_today);
    v_first := v_first + ((p_weekday - extract(isodow from v_first)::integer + 7) % 7);
    -- Lock and temporarily remove affected rows from the live partial unique
    -- indexes. The transaction is atomic, so this state is never observable.
    perform 1 from public.sessions s
    where s.owner_id = v_owner and s.template_id = p_template_id
      and s.session_date >= v_today and s.source = 'recurrence' and s.manually_edited_at is null
      and s.status = 'scheduled' and s.voided_at is null
    for update;
    with ranked as (
      select s.id, row_number() over (order by s.session_date, s.id) - 1 as sequence
      from public.sessions s where s.owner_id = v_owner and s.template_id = p_template_id
        and s.session_date >= v_today and s.source = 'recurrence' and s.manually_edited_at is null
        and s.status = 'scheduled' and s.voided_at is null
    )
    update public.sessions s set voided_at = now() from ranked r
    where s.owner_id = v_owner and s.id = r.id
      and (p_ends_on is null or v_first + (r.sequence::integer * 7) <= p_ends_on);
    for v_row in
      with eligible as (
        select s.*, row_number() over (order by s.session_date, s.id) - 1 as sequence
        from public.sessions s where s.owner_id = v_owner and s.template_id = p_template_id
          and s.session_date >= v_today and s.source = 'recurrence' and s.manually_edited_at is null
          and s.status = 'scheduled' and s.void_reason is null and s.voided_at is not null
          and exists (select 1 from jsonb_array_elements(v_preview->'changes') c where (c->>'sessionId')::uuid = s.id)
      )
      select *, v_first + (sequence::integer * 7) as new_date from eligible
      where p_ends_on is null or v_first + (sequence::integer * 7) <= p_ends_on
    loop
      if v_row.session_date <> v_row.new_date then
        update public.sessions set session_date = v_row.new_date, voided_at = null, version = version + 1, updated_at = now()
        where owner_id = v_owner and id = v_row.id;
        insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
        select v_owner, v_operation.id, 'session', s.id, 'template_rescheduled', to_jsonb(v_row), to_jsonb(s), s.version
        from public.sessions s where s.owner_id = v_owner and s.id = v_row.id;
      end if;
      if v_row.session_date = v_row.new_date then
        update public.sessions set voided_at = null where owner_id = v_owner and id = v_row.id;
      end if;
    end loop;
  end if;

  v_result := jsonb_build_object('operationId', v_operation.id, 'template', to_jsonb(v_template), 'preview', v_preview, 'futureMode', p_future_mode);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

revoke all on function public.preview_template_schedule(uuid, smallint, date, date, integer) from public, anon;
revoke all on function public.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text) from public, anon;
grant execute on function public.preview_template_schedule(uuid, smallint, date, date, integer) to authenticated;
grant execute on function public.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text) to authenticated;
