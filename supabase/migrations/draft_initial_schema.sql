-- DRAFT ONLY — NOT APPLIED, NOT APPROVED, NOT A TIMESTAMPED MIGRATION.
-- This proposal intentionally omits mutation RPCs pending review. Do not run it
-- against any local, preview, or production database without explicit approval.

create type public.session_status as enum ('scheduled', 'held', 'canceled', 'no_show');
create type public.payment_method as enum ('cash', 'transfer', 'other');
create type public.session_source as enum ('manual', 'bulk_attendance', 'recurrence');
create type public.operation_state as enum ('started', 'completed', 'failed');

create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  default_rate_cents integer not null default 3000 check (default_rate_cents between 0 and 10000000),
  notes text check (notes is null or char_length(notes) <= 5000),
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create table public.recurring_session_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  starts_on date not null,
  ends_on date,
  paused_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  unique (owner_id, id),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict
);

create table public.mutation_operations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  operation_kind text not null check (char_length(operation_kind) between 1 and 80),
  request_hash text not null check (char_length(request_hash) = 64),
  state public.operation_state not null default 'started',
  result jsonb,
  undo_expires_at timestamptz,
  undone_at timestamptz,
  undo_operation_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (owner_id, idempotency_key),
  unique (owner_id, id),
  foreign key (owner_id, undo_operation_id) references public.mutation_operations(owner_id, id) on delete restrict,
  check (undo_expires_at is null or undo_expires_at <= created_at + interval '10 minutes'),
  check (undone_at is null or undone_at >= created_at)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null,
  template_id uuid,
  session_date date not null,
  status public.session_status not null,
  charge_rate_cents integer check (charge_rate_cents between 0 and 10000000),
  occurrence_number smallint not null default 1 check (occurrence_number > 0),
  source public.session_source not null default 'manual',
  manually_edited_at timestamptz,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  created_operation_id uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'held' or charge_rate_cents is not null),
  check ((voided_at is null and void_reason is null) or voided_at is not null),
  unique (owner_id, id),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, template_id) references public.recurring_session_templates(owner_id, id) on delete restrict,
  foreign key (owner_id, created_operation_id) references public.mutation_operations(owner_id, id) on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null,
  payment_date date not null,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  method public.payment_method not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  replacement_payment_id uuid,
  created_operation_id uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((voided_at is null and void_reason is null) or voided_at is not null),
  unique (owner_id, id),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, replacement_payment_id) references public.payments(owner_id, id) on delete restrict,
  foreign key (owner_id, created_operation_id) references public.mutation_operations(owner_id, id) on delete restrict
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  operation_id uuid not null,
  entity_type text not null check (entity_type in ('student', 'session', 'payment', 'template', 'daily_review')),
  entity_id uuid not null,
  action text not null check (char_length(action) between 1 and 80),
  before_state jsonb,
  after_state jsonb,
  entity_version integer check (entity_version is null or entity_version > 0),
  occurred_at timestamptz not null default now(),
  check (before_state is not null or after_state is not null),
  foreign key (owner_id, operation_id) references public.mutation_operations(owner_id, id) on delete restrict
);

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  review_date date not null,
  reviewed_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  created_operation_id uuid not null,
  unique (owner_id, review_date),
  foreign key (owner_id, created_operation_id) references public.mutation_operations(owner_id, id) on delete restrict
);

create index students_owner_id_idx on public.students (owner_id);
create index students_active_name_idx on public.students (owner_id, lower(name)) where archived_at is null;
create index templates_student_id_idx on public.recurring_session_templates (student_id);
create index templates_active_generation_idx on public.recurring_session_templates (owner_id, weekday, starts_on) where archived_at is null and paused_at is null;
create index operations_owner_created_idx on public.mutation_operations (owner_id, created_at desc);
create index operations_undo_operation_id_idx on public.mutation_operations (undo_operation_id) where undo_operation_id is not null;
create index sessions_student_id_idx on public.sessions (student_id);
create index sessions_template_id_idx on public.sessions (template_id) where template_id is not null;
create index sessions_created_operation_id_idx on public.sessions (created_operation_id);
create index sessions_owner_student_date_idx on public.sessions (owner_id, student_id, session_date desc) where voided_at is null;
create index sessions_owner_date_status_idx on public.sessions (owner_id, session_date, status) where voided_at is null;
create unique index sessions_live_occurrence_uidx on public.sessions (owner_id, student_id, session_date, occurrence_number) where voided_at is null;
create unique index sessions_live_template_date_uidx on public.sessions (owner_id, template_id, session_date) where template_id is not null and voided_at is null;
create index payments_student_id_idx on public.payments (student_id);
create index payments_replacement_payment_id_idx on public.payments (replacement_payment_id) where replacement_payment_id is not null;
create index payments_created_operation_id_idx on public.payments (created_operation_id);
create index payments_owner_student_date_idx on public.payments (owner_id, student_id, payment_date desc) where voided_at is null;
create index payments_owner_date_idx on public.payments (owner_id, payment_date) where voided_at is null;
create index audit_operation_id_idx on public.audit_events (operation_id);
create index audit_owner_occurred_idx on public.audit_events (owner_id, occurred_at desc);
create index audit_entity_idx on public.audit_events (owner_id, entity_type, entity_id, occurred_at desc);
create index daily_reviews_operation_id_idx on public.daily_reviews (created_operation_id);

alter table public.students enable row level security;
alter table public.students force row level security;
alter table public.recurring_session_templates enable row level security;
alter table public.recurring_session_templates force row level security;
alter table public.mutation_operations enable row level security;
alter table public.mutation_operations force row level security;
alter table public.sessions enable row level security;
alter table public.sessions force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.daily_reviews enable row level security;
alter table public.daily_reviews force row level security;

create policy students_select on public.students for select to authenticated using ((select auth.uid()) = owner_id);
create policy students_insert on public.students for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy students_update on public.students for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy templates_select on public.recurring_session_templates for select to authenticated using ((select auth.uid()) = owner_id);
create policy templates_insert on public.recurring_session_templates for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy templates_update on public.recurring_session_templates for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy operations_select on public.mutation_operations for select to authenticated using ((select auth.uid()) = owner_id);
create policy operations_insert on public.mutation_operations for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy operations_update on public.mutation_operations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy sessions_select on public.sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy sessions_insert on public.sessions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy sessions_update on public.sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy payments_select on public.payments for select to authenticated using ((select auth.uid()) = owner_id);
create policy payments_insert on public.payments for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy payments_update on public.payments for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy audit_select on public.audit_events for select to authenticated using ((select auth.uid()) = owner_id);
create policy audit_insert on public.audit_events for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy reviews_select on public.daily_reviews for select to authenticated using ((select auth.uid()) = owner_id);
create policy reviews_insert on public.daily_reviews for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy reviews_update on public.daily_reviews for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.recurring_session_templates to authenticated;
grant select, insert, update on public.mutation_operations to authenticated;
grant select, insert, update on public.sessions to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert on public.audit_events to authenticated;
grant select, insert, update on public.daily_reviews to authenticated;

-- There are deliberately no DELETE policies or DELETE grants.
-- The audited RPCs below are part of this draft and have not been applied.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;

create or replace function app_private.log_payment(
  p_idempotency_key uuid,
  p_request_hash text,
  p_student_id uuid,
  p_payment_date date,
  p_amount_cents integer,
  p_method public.payment_method,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_payment public.payments%rowtype;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if p_amount_cents <= 0 or p_amount_cents > 100000000 then raise exception 'invalid_amount'; end if;
  if not exists (select 1 from public.students where owner_id = v_owner and id = p_student_id) then raise exception 'student_not_found'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'log_payment', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  insert into public.payments (owner_id, student_id, payment_date, amount_cents, method, notes, created_operation_id)
  values (v_owner, p_student_id, p_payment_date, p_amount_cents, p_method, nullif(btrim(p_notes), ''), v_operation.id)
  returning * into v_payment;
  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
  values (v_owner, v_operation.id, 'payment', v_payment.id, 'created', to_jsonb(v_payment), v_payment.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'payment', to_jsonb(v_payment), 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.bulk_mark_attended(
  p_idempotency_key uuid,
  p_request_hash text,
  p_session_date date,
  p_student_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_student public.students%rowtype;
  v_session public.sessions%rowtype;
  v_before jsonb;
  v_created integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_conflicts jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if coalesce(array_length(p_student_ids, 1), 0) < 1 or array_length(p_student_ids, 1) > 250 then raise exception 'invalid_students'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'bulk_attendance', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  for v_student in
    select s.* from public.students s
    where s.owner_id = v_owner and s.id = any(p_student_ids) and s.archived_at is null
    order by s.id for update
  loop
    v_before := null;
    select * into v_session from public.sessions
      where owner_id = v_owner and student_id = v_student.id and session_date = p_session_date
        and occurrence_number = 1 and voided_at is null
      for update;
    if not found then
      insert into public.sessions (owner_id, student_id, session_date, status, charge_rate_cents, source, created_operation_id)
      values (v_owner, v_student.id, p_session_date, 'held', v_student.default_rate_cents, 'bulk_attendance', v_operation.id)
      returning * into v_session;
      v_created := v_created + 1;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
      values (v_owner, v_operation.id, 'session', v_session.id, 'created', to_jsonb(v_session), v_session.version);
    elsif v_session.status = 'held' then
      v_unchanged := v_unchanged + 1;
    elsif v_session.status = 'scheduled' and v_session.manually_edited_at is null then
      v_before := to_jsonb(v_session);
      update public.sessions set status = 'held', charge_rate_cents = v_student.default_rate_cents,
        source = 'bulk_attendance', version = version + 1, updated_at = now()
      where id = v_session.id returning * into v_session;
      v_updated := v_updated + 1;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      values (v_owner, v_operation.id, 'session', v_session.id, 'marked_held', v_before, to_jsonb(v_session), v_session.version);
    else
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('studentId', v_student.id, 'sessionId', v_session.id, 'status', v_session.status));
    end if;
  end loop;

  v_result := jsonb_build_object('operationId', v_operation.id, 'created', v_created, 'updated', v_updated, 'unchanged', v_unchanged, 'conflicts', v_conflicts, 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.materialize_recurring_sessions(
  p_idempotency_key uuid,
  p_request_hash text,
  p_through_date date default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_today date := timezone('America/Barbados', now())::date;
  v_through date := least(coalesce(p_through_date, timezone('America/Barbados', now())::date + 84), timezone('America/Barbados', now())::date + 84);
  v_operation public.mutation_operations%rowtype;
  v_session public.sessions%rowtype;
  v_row record;
  v_created integer := 0;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if v_through < v_today then raise exception 'invalid_horizon'; end if;
  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'materialize_recurrence', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  for v_row in
    select t.id template_id, t.student_id, d::date session_date
    from public.recurring_session_templates t
    join public.students st on st.owner_id = t.owner_id and st.id = t.student_id and st.archived_at is null
    cross join lateral generate_series(greatest(t.starts_on, v_today)::timestamp, least(coalesce(t.ends_on, v_through), v_through)::timestamp, interval '1 day') d
    where t.owner_id = v_owner and t.archived_at is null and t.paused_at is null
      and extract(isodow from d)::smallint = t.weekday
    order by t.id, d
  loop
    insert into public.sessions (owner_id, student_id, template_id, session_date, status, source, created_operation_id)
    values (v_owner, v_row.student_id, v_row.template_id, v_row.session_date, 'scheduled', 'recurrence', v_operation.id)
    on conflict do nothing returning * into v_session;
    if found then
      v_created := v_created + 1;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
      values (v_owner, v_operation.id, 'session', v_session.id, 'created', to_jsonb(v_session), v_session.version);
    end if;
  end loop;
  v_result := jsonb_build_object('operationId', v_operation.id, 'created', v_created, 'throughDate', v_through, 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.undo_operation(
  p_idempotency_key uuid,
  p_request_hash text,
  p_operation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_original public.mutation_operations%rowtype;
  v_undo public.mutation_operations%rowtype;
  v_event public.audit_events%rowtype;
  v_current_version integer;
  v_result jsonb;
  v_count integer := 0;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  select * into v_original from public.mutation_operations where owner_id = v_owner and id = p_operation_id for update;
  if not found then raise exception 'operation_not_found'; end if;
  if v_original.state <> 'completed' then raise exception 'stale_operation'; end if;
  if v_original.undone_at is not null then return jsonb_build_object('operationId', v_original.undo_operation_id, 'undoneOperationId', v_original.id, 'alreadyUndone', true); end if;
  if v_original.undo_expires_at is null or v_original.undo_expires_at < now() then raise exception 'undo_expired'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash)
  values (v_owner, p_idempotency_key, 'undo', p_request_hash)
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_undo from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_undo.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_undo.state = 'completed' then return v_undo.result; end if;

  for v_event in select * from public.audit_events where owner_id = v_owner and operation_id = v_original.id order by entity_id for update
  loop
    if v_event.entity_type = 'payment' then
      select version into v_current_version from public.payments where owner_id = v_owner and id = v_event.entity_id and voided_at is null for update;
      if not found or v_current_version <> v_event.entity_version then raise exception 'stale_operation'; end if;
      update public.payments set voided_at = now(), void_reason = 'Undo', version = version + 1, updated_at = now() where owner_id = v_owner and id = v_event.entity_id;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'payment', id, 'undo_voided', v_event.after_state, to_jsonb(p), p.version from public.payments p where p.id = v_event.entity_id;
    elsif v_event.entity_type = 'session' then
      select version into v_current_version from public.sessions where owner_id = v_owner and id = v_event.entity_id and voided_at is null for update;
      if not found or v_current_version <> v_event.entity_version then raise exception 'stale_operation'; end if;
      if v_event.before_state is null then
        update public.sessions set voided_at = now(), void_reason = 'Undo', version = version + 1, updated_at = now() where owner_id = v_owner and id = v_event.entity_id;
      else
        update public.sessions set status = (v_event.before_state->>'status')::public.session_status,
          charge_rate_cents = (v_event.before_state->>'charge_rate_cents')::integer,
          source = (v_event.before_state->>'source')::public.session_source,
          manually_edited_at = (v_event.before_state->>'manually_edited_at')::timestamptz,
          version = version + 1, updated_at = now()
        where owner_id = v_owner and id = v_event.entity_id;
      end if;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'session', id, 'undone', v_event.after_state, to_jsonb(s), s.version from public.sessions s where s.id = v_event.entity_id;
    else
      raise exception 'undo_not_supported';
    end if;
    v_count := v_count + 1;
  end loop;
  v_result := jsonb_build_object('operationId', v_undo.id, 'undoneOperationId', v_original.id, 'affected', v_count);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_undo.id;
  update public.mutation_operations set undone_at = now(), undo_operation_id = v_undo.id where id = v_original.id;
  return v_result;
end;
$$;

create or replace function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.log_payment($1, $2, $3, $4, $5, $6, $7) $$;
create or replace function public.bulk_mark_attended(uuid, text, date, uuid[])
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.bulk_mark_attended($1, $2, $3, $4) $$;
create or replace function public.materialize_recurring_sessions(uuid, text, date default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.materialize_recurring_sessions($1, $2, $3) $$;
create or replace function public.undo_operation(uuid, text, uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.undo_operation($1, $2, $3) $$;

revoke all on function app_private.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) from public, anon;
revoke all on function app_private.bulk_mark_attended(uuid, text, date, uuid[]) from public, anon;
revoke all on function app_private.materialize_recurring_sessions(uuid, text, date) from public, anon;
revoke all on function app_private.undo_operation(uuid, text, uuid) from public, anon;
revoke all on function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) from public, anon;
revoke all on function public.bulk_mark_attended(uuid, text, date, uuid[]) from public, anon;
revoke all on function public.materialize_recurring_sessions(uuid, text, date) from public, anon;
revoke all on function public.undo_operation(uuid, text, uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) to authenticated;
grant execute on function app_private.bulk_mark_attended(uuid, text, date, uuid[]) to authenticated;
grant execute on function app_private.materialize_recurring_sessions(uuid, text, date) to authenticated;
grant execute on function app_private.undo_operation(uuid, text, uuid) to authenticated;
grant execute on function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) to authenticated;
grant execute on function public.bulk_mark_attended(uuid, text, date, uuid[]) to authenticated;
grant execute on function public.materialize_recurring_sessions(uuid, text, date) to authenticated;
grant execute on function public.undo_operation(uuid, text, uuid) to authenticated;

-- Authenticated clients read through RLS but cannot bypass the audited mutation
-- functions by writing tables through the Data API. SECURITY DEFINER functions
-- above retain the narrowly scoped ability to perform their atomic changes.
revoke insert, update, delete on public.students from authenticated;
revoke insert, update, delete on public.recurring_session_templates from authenticated;
revoke insert, update, delete on public.mutation_operations from authenticated;
revoke insert, update, delete on public.sessions from authenticated;
revoke insert, update, delete on public.payments from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;
revoke insert, update, delete on public.daily_reviews from authenticated;

-- SECURITY DEFINER is narrowly used in the unexposed app_private schema because
-- these RPCs must append immutable audit records atomically. Public entry points
-- are SECURITY INVOKER wrappers. Each internal function pins an empty search_path,
-- requires auth.uid(), scopes every row to that owner, revokes PUBLIC/anon execute,
-- and accepts no owner ID.
-- Before approval/application: run database advisors and integration-test cross-owner
-- denial with real authenticated JWTs. Add audited RPCs for student, template,
-- session correction/void, payment correction/void, and daily-review mutations
-- before this draft can satisfy the complete product contract.
