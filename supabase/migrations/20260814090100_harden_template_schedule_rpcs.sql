-- Keep elevated mutation logic outside the exposed public API schema.
alter function public.preview_template_schedule(uuid, smallint, date, date, integer) security invoker;

alter function public.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text)
  set schema app_private;

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
language sql
security invoker
set search_path = ''
as $$
  select app_private.save_template_schedule(
    p_idempotency_key, p_request_hash, p_template_id, p_student_id, p_weekday,
    p_starts_on, p_ends_on, p_paused, p_archived, p_expected_version, p_future_mode
  )
$$;

revoke all on function app_private.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text) from public, anon;
revoke all on function public.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text) from public, anon;
grant execute on function app_private.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text) to authenticated;
grant execute on function public.save_template_schedule(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer, text) to authenticated;
