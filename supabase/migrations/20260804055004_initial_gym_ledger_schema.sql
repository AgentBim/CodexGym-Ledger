-- Applied to Supabase project mevsairosejypqqtfnum after explicit approval.
-- Migration history version: 20260804055004.

-- Supabase's RLS event-trigger helper must remain internal. Revoking external
-- execution does not disable the event trigger itself.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

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
create policy templates_select on public.recurring_session_templates for select to authenticated using ((select auth.uid()) = owner_id);
create policy operations_select on public.mutation_operations for select to authenticated using ((select auth.uid()) = owner_id);
create policy sessions_select on public.sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy payments_select on public.payments for select to authenticated using ((select auth.uid()) = owner_id);
create policy audit_select on public.audit_events for select to authenticated using ((select auth.uid()) = owner_id);
create policy reviews_select on public.daily_reviews for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on public.students to authenticated;
grant select on public.recurring_session_templates to authenticated;
grant select on public.mutation_operations to authenticated;
grant select on public.sessions to authenticated;
grant select on public.payments to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.daily_reviews to authenticated;

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
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request_hash'; end if;
  if p_payment_date is null then raise exception 'invalid_payment_date'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then raise exception 'invalid_amount'; end if;
  if p_method is null then raise exception 'invalid_method'; end if;
  if not exists (select 1 from public.students where owner_id = v_owner and id = p_student_id) then raise exception 'student_not_found'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'log_payment', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash or v_operation.operation_kind <> 'log_payment' then raise exception 'idempotency_conflict'; end if;
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
  v_requested_count integer;
  v_matched_count integer;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request_hash'; end if;
  if p_session_date is null then raise exception 'invalid_session_date'; end if;
  if coalesce(array_ndims(p_student_ids), 0) <> 1 or cardinality(p_student_ids) not between 1 and 250 then raise exception 'invalid_students'; end if;
  select count(distinct requested_id)::integer into v_requested_count from unnest(p_student_ids) requested_id;
  if v_requested_count <> cardinality(p_student_ids) then raise exception 'duplicate_students'; end if;
  select count(*)::integer into v_matched_count from public.students
  where owner_id = v_owner and id = any(p_student_ids) and archived_at is null;
  if v_matched_count <> v_requested_count then raise exception 'invalid_students'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'bulk_attendance', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash or v_operation.operation_kind <> 'bulk_attendance' then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  for v_student in
    select s.* from public.students s
    where s.owner_id = v_owner and s.id = any(p_student_ids) and s.archived_at is null
    order by s.id for update
  loop
    v_before := null;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || v_student.id::text || ':' || p_session_date::text, 0));
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
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request_hash'; end if;
  if v_through < v_today then raise exception 'invalid_horizon'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('recurrence:' || v_owner::text, 0));
  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'materialize_recurrence', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash or v_operation.operation_kind <> 'materialize_recurrence' then raise exception 'idempotency_conflict'; end if;
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
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || v_row.student_id::text || ':' || v_row.session_date::text, 0));
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
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request_hash'; end if;
  select * into v_original from public.mutation_operations where owner_id = v_owner and id = p_operation_id for update;
  if not found then raise exception 'operation_not_found'; end if;
  if v_original.state <> 'completed' then raise exception 'stale_operation'; end if;
  if v_original.undone_at is not null then return jsonb_build_object('operationId', v_original.undo_operation_id, 'undoneOperationId', v_original.id, 'alreadyUndone', true); end if;
  if v_original.undo_expires_at is null or v_original.undo_expires_at < now() then raise exception 'undo_expired'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash)
  values (v_owner, p_idempotency_key, 'undo', p_request_hash)
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_undo from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_undo.request_hash <> p_request_hash or v_undo.operation_kind <> 'undo' then raise exception 'idempotency_conflict'; end if;
  if v_undo.state = 'completed' then return v_undo.result; end if;

  for v_event in select * from public.audit_events where owner_id = v_owner and operation_id = v_original.id order by entity_id for update
  loop
    if v_event.entity_type = 'payment' then
      select version into v_current_version from public.payments where owner_id = v_owner and id = v_event.entity_id for update;
      if not found or v_current_version <> v_event.entity_version then raise exception 'stale_operation'; end if;
      if v_event.action in ('created', 'created_replacement') then
        if (v_event.after_state->>'voided_at') is not null then raise exception 'undo_not_supported'; end if;
        update public.payments set
          voided_at = now(),
          void_reason = 'Undo',
          version = version + 1,
          updated_at = now()
        where owner_id = v_owner and id = v_event.entity_id;
      elsif v_event.action = 'voided' and v_event.before_state is not null then
        update public.payments set
          payment_date = (v_event.before_state->>'payment_date')::date,
          amount_cents = (v_event.before_state->>'amount_cents')::integer,
          method = (v_event.before_state->>'method')::public.payment_method,
          notes = v_event.before_state->>'notes',
          voided_at = (v_event.before_state->>'voided_at')::timestamptz,
          void_reason = v_event.before_state->>'void_reason',
          replacement_payment_id = (v_event.before_state->>'replacement_payment_id')::uuid,
          version = version + 1,
          updated_at = now()
        where owner_id = v_owner and id = v_event.entity_id;
      else
        raise exception 'undo_not_supported';
      end if;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'payment', id, 'undone', v_event.after_state, to_jsonb(p), p.version
      from public.payments p where p.owner_id = v_owner and p.id = v_event.entity_id;
    elsif v_event.entity_type = 'session' then
      select version into v_current_version from public.sessions where owner_id = v_owner and id = v_event.entity_id for update;
      if not found or v_current_version <> v_event.entity_version then raise exception 'stale_operation'; end if;
      if v_event.before_state is null then
        update public.sessions set voided_at = now(), void_reason = 'Undo', version = version + 1, updated_at = now() where owner_id = v_owner and id = v_event.entity_id;
      else
        update public.sessions set
          session_date = (v_event.before_state->>'session_date')::date,
          status = (v_event.before_state->>'status')::public.session_status,
          charge_rate_cents = (v_event.before_state->>'charge_rate_cents')::integer,
          source = (v_event.before_state->>'source')::public.session_source,
          manually_edited_at = (v_event.before_state->>'manually_edited_at')::timestamptz,
          voided_at = (v_event.before_state->>'voided_at')::timestamptz,
          void_reason = v_event.before_state->>'void_reason',
          version = version + 1, updated_at = now()
        where owner_id = v_owner and id = v_event.entity_id;
      end if;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'session', id, 'undone', v_event.after_state, to_jsonb(s), s.version
      from public.sessions s where s.owner_id = v_owner and s.id = v_event.entity_id;
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

create or replace function app_private.begin_operation(
  p_idempotency_key uuid,
  p_request_hash text,
  p_operation_kind text,
  p_undoable boolean default false
) returns public.mutation_operations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request_hash'; end if;

  insert into public.mutation_operations (
    owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at
  ) values (
    v_owner, p_idempotency_key, p_operation_kind, p_request_hash,
    case when p_undoable then now() + interval '10 minutes' end
  ) on conflict (owner_id, idempotency_key) do nothing;

  select * into v_operation
  from public.mutation_operations
  where owner_id = v_owner and idempotency_key = p_idempotency_key
  for update;

  if v_operation.request_hash <> p_request_hash or v_operation.operation_kind <> p_operation_kind then raise exception 'idempotency_conflict'; end if;
  return v_operation;
end;
$$;

create or replace function app_private.save_student(
  p_idempotency_key uuid,
  p_request_hash text,
  p_student_id uuid,
  p_name text,
  p_default_rate_cents integer,
  p_notes text,
  p_archived boolean,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_student public.students%rowtype;
  v_before jsonb;
  v_action text;
  v_result jsonb;
begin
  if p_archived is null then raise exception 'invalid_archived'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'invalid_name'; end if;
  if p_default_rate_cents is null or p_default_rate_cents not between 0 and 10000000 then raise exception 'invalid_rate'; end if;
  if p_notes is not null and char_length(p_notes) > 5000 then raise exception 'invalid_notes'; end if;
  if v_owner is null then raise exception 'auth_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('recurrence:' || v_owner::text, 0));
  v_operation := app_private.begin_operation(p_idempotency_key, p_request_hash, 'save_student', false);
  if v_operation.state = 'completed' then return v_operation.result; end if;

  if p_student_id is null then
    insert into public.students (owner_id, name, default_rate_cents, notes, archived_at)
    values (v_owner, btrim(p_name), p_default_rate_cents, nullif(btrim(p_notes), ''), case when p_archived then now() end)
    returning * into v_student;
    v_action := 'created';
  else
    select * into v_student from public.students
    where owner_id = v_owner and id = p_student_id for update;
    if not found then raise exception 'student_not_found'; end if;
    if p_expected_version is null or v_student.version <> p_expected_version then raise exception 'stale_operation'; end if;
    v_before := to_jsonb(v_student);
    v_action := case
      when v_student.archived_at is null and p_archived then 'archived'
      when v_student.archived_at is not null and not p_archived then 'restored'
      else 'updated'
    end;
    update public.students set
      name = btrim(p_name),
      default_rate_cents = p_default_rate_cents,
      notes = nullif(btrim(p_notes), ''),
      archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
      version = version + 1,
      updated_at = now()
    where owner_id = v_owner and id = p_student_id
    returning * into v_student;
  end if;

  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'student', v_student.id, v_action, v_before, to_jsonb(v_student), v_student.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'student', to_jsonb(v_student));
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.save_template(
  p_idempotency_key uuid,
  p_request_hash text,
  p_template_id uuid,
  p_student_id uuid,
  p_weekday smallint,
  p_starts_on date,
  p_ends_on date,
  p_paused boolean,
  p_archived boolean,
  p_expected_version integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_template public.recurring_session_templates%rowtype;
  v_student public.students%rowtype;
  v_before jsonb;
  v_action text;
  v_result jsonb;
begin
  if p_paused is null or p_archived is null then raise exception 'invalid_template_state'; end if;
  if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'invalid_weekday'; end if;
  if p_starts_on is null then raise exception 'invalid_start_date'; end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then raise exception 'invalid_date_range'; end if;
  if v_owner is null then raise exception 'auth_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('recurrence:' || v_owner::text, 0));
  v_operation := app_private.begin_operation(p_idempotency_key, p_request_hash, 'save_template', false);
  if v_operation.state = 'completed' then return v_operation.result; end if;
  select * into v_student from public.students where owner_id = v_owner and id = p_student_id;
  if not found then raise exception 'student_not_found'; end if;

  if p_template_id is null then
    if v_student.archived_at is not null then raise exception 'student_archived'; end if;
    insert into public.recurring_session_templates (owner_id, student_id, weekday, starts_on, ends_on, paused_at, archived_at)
    values (v_owner, p_student_id, p_weekday, p_starts_on, p_ends_on, case when p_paused then now() end, case when p_archived then now() end)
    returning * into v_template;
    v_action := 'created';
  else
    select * into v_template from public.recurring_session_templates
    where owner_id = v_owner and id = p_template_id for update;
    if not found then raise exception 'template_not_found'; end if;
    if p_expected_version is null or v_template.version <> p_expected_version then raise exception 'stale_operation'; end if;
    if v_student.archived_at is not null
      and (p_student_id <> v_template.student_id or (not p_paused and not p_archived))
    then raise exception 'student_archived'; end if;
    v_before := to_jsonb(v_template);
    v_action := case
      when v_template.archived_at is null and p_archived then 'archived'
      when v_template.archived_at is not null and not p_archived then 'restored'
      when v_template.paused_at is null and p_paused then 'paused'
      when v_template.paused_at is not null and not p_paused then 'resumed'
      else 'updated'
    end;
    update public.recurring_session_templates set
      student_id = p_student_id,
      weekday = p_weekday,
      starts_on = p_starts_on,
      ends_on = p_ends_on,
      paused_at = case when p_paused then coalesce(paused_at, now()) else null end,
      archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
      version = version + 1,
      updated_at = now()
    where owner_id = v_owner and id = p_template_id
    returning * into v_template;
  end if;

  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'template', v_template.id, v_action, v_before, to_jsonb(v_template), v_template.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'template', to_jsonb(v_template));
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.save_session(
  p_idempotency_key uuid,
  p_request_hash text,
  p_session_id uuid,
  p_student_id uuid,
  p_session_date date,
  p_status public.session_status,
  p_void boolean,
  p_void_reason text,
  p_expected_version integer
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
  v_action text;
  v_result jsonb;
begin
  select * into v_student from public.students
  where owner_id = v_owner and id = p_student_id;
  if not found then raise exception 'student_not_found'; end if;
  if p_session_id is null and v_student.archived_at is not null then raise exception 'student_archived'; end if;
  if p_void is null then raise exception 'invalid_void'; end if;
  if p_session_date is null then raise exception 'invalid_session_date'; end if;
  if p_status is null then raise exception 'invalid_status'; end if;
  if p_void and (p_void_reason is null or char_length(btrim(p_void_reason)) not between 1 and 500) then raise exception 'invalid_void_reason'; end if;
  v_operation := app_private.begin_operation(p_idempotency_key, p_request_hash, 'save_session', true);
  if v_operation.state = 'completed' then return v_operation.result; end if;

  if p_session_id is null then
    if p_void then raise exception 'invalid_void'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text || ':' || p_student_id::text || ':' || p_session_date::text, 0));
    if exists (
      select 1 from public.sessions
      where owner_id = v_owner and student_id = p_student_id and session_date = p_session_date
        and occurrence_number = 1 and voided_at is null
    ) then raise exception 'session_exists'; end if;
    insert into public.sessions (owner_id, student_id, session_date, status, charge_rate_cents, source, manually_edited_at, created_operation_id)
    values (v_owner, p_student_id, p_session_date, p_status, case when p_status = 'held' then v_student.default_rate_cents end, 'manual', now(), v_operation.id)
    returning * into v_session;
    v_action := 'created';
  else
    select * into v_session from public.sessions
    where owner_id = v_owner and id = p_session_id and voided_at is null for update;
    if not found then raise exception 'session_not_found'; end if;
    if p_expected_version is null or v_session.version <> p_expected_version then raise exception 'stale_operation'; end if;
    if v_session.student_id <> p_student_id then raise exception 'student_mismatch'; end if;
    v_before := to_jsonb(v_session);
    v_action := case when p_void then 'voided' else 'corrected' end;
    if p_void then
      update public.sessions set
        voided_at = now(),
        void_reason = btrim(p_void_reason),
        version = version + 1,
        updated_at = now()
      where owner_id = v_owner and id = p_session_id
      returning * into v_session;
    else
      update public.sessions set
        session_date = p_session_date,
        status = p_status,
        charge_rate_cents = case
          when p_status <> 'held' then null
          when v_session.status = 'held' and v_session.charge_rate_cents is not null then v_session.charge_rate_cents
          else v_student.default_rate_cents
        end,
        source = 'manual',
        manually_edited_at = now(),
        version = version + 1,
        updated_at = now()
      where owner_id = v_owner and id = p_session_id
      returning * into v_session;
    end if;
  end if;

  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'session', v_session.id, v_action, v_before, to_jsonb(v_session), v_session.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'session', to_jsonb(v_session), 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.correct_payment(
  p_idempotency_key uuid,
  p_request_hash text,
  p_payment_id uuid,
  p_expected_version integer,
  p_void_reason text,
  p_replacement_date date,
  p_replacement_amount_cents integer,
  p_replacement_method public.payment_method,
  p_replacement_notes text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_original public.payments%rowtype;
  v_replacement public.payments%rowtype;
  v_before jsonb;
  v_result jsonb;
begin
  if p_void_reason is null or char_length(btrim(p_void_reason)) not between 1 and 500 then raise exception 'invalid_void_reason'; end if;
  if p_replacement_amount_cents is not null and p_replacement_amount_cents not between 1 and 100000000 then raise exception 'invalid_amount'; end if;
  if (p_replacement_amount_cents is null) <> (p_replacement_date is null) then raise exception 'invalid_replacement'; end if;
  if p_replacement_amount_cents is not null and p_replacement_method is null then raise exception 'invalid_replacement'; end if;
  v_operation := app_private.begin_operation(p_idempotency_key, p_request_hash, 'correct_payment', true);
  if v_operation.state = 'completed' then return v_operation.result; end if;

  select * into v_original from public.payments
  where owner_id = v_owner and id = p_payment_id and voided_at is null for update;
  if not found then raise exception 'payment_not_found'; end if;
  if p_expected_version is null or v_original.version <> p_expected_version then raise exception 'stale_operation'; end if;
  v_before := to_jsonb(v_original);

  if p_replacement_amount_cents is not null then
    insert into public.payments (owner_id, student_id, payment_date, amount_cents, method, notes, created_operation_id)
    values (v_owner, v_original.student_id, p_replacement_date, p_replacement_amount_cents, p_replacement_method, nullif(btrim(p_replacement_notes), ''), v_operation.id)
    returning * into v_replacement;
  end if;

  update public.payments set
    voided_at = now(),
    void_reason = btrim(p_void_reason),
    replacement_payment_id = v_replacement.id,
    version = version + 1,
    updated_at = now()
  where owner_id = v_owner and id = p_payment_id
  returning * into v_original;

  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'payment', v_original.id, 'voided', v_before, to_jsonb(v_original), v_original.version);
  if v_replacement.id is not null then
    insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
    values (v_owner, v_operation.id, 'payment', v_replacement.id, 'created_replacement', to_jsonb(v_replacement), v_replacement.version);
  end if;

  v_result := jsonb_build_object(
    'operationId', v_operation.id,
    'voidedPayment', to_jsonb(v_original),
    'replacementPayment', case when v_replacement.id is null then 'null'::jsonb else to_jsonb(v_replacement) end,
    'undoExpiresAt', v_operation.undo_expires_at
  );
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.mark_daily_reviewed(
  p_idempotency_key uuid,
  p_request_hash text,
  p_review_date date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_review public.daily_reviews%rowtype;
  v_before jsonb;
  v_result jsonb;
begin
  if p_review_date is null then raise exception 'invalid_review_date'; end if;
  v_operation := app_private.begin_operation(p_idempotency_key, p_request_hash, 'mark_daily_reviewed', false);
  if v_operation.state = 'completed' then return v_operation.result; end if;

  select * into v_review from public.daily_reviews
  where owner_id = v_owner and review_date = p_review_date for update;
  if found then v_before := to_jsonb(v_review); end if;

  insert into public.daily_reviews (owner_id, review_date, reviewed_at, created_operation_id)
  values (v_owner, p_review_date, now(), v_operation.id)
  on conflict (owner_id, review_date) do update set
    reviewed_at = excluded.reviewed_at,
    created_operation_id = excluded.created_operation_id,
    version = public.daily_reviews.version + 1
  returning * into v_review;

  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'daily_review', v_review.id, 'reviewed', v_before, to_jsonb(v_review), v_review.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'review', to_jsonb(v_review));
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function public.log_payment(
  p_idempotency_key uuid,
  p_request_hash text,
  p_student_id uuid,
  p_payment_date date,
  p_amount_cents integer,
  p_method public.payment_method,
  p_notes text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.log_payment(p_idempotency_key, p_request_hash, p_student_id, p_payment_date, p_amount_cents, p_method, p_notes) $$;
create or replace function public.bulk_mark_attended(
  p_idempotency_key uuid,
  p_request_hash text,
  p_session_date date,
  p_student_ids uuid[]
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.bulk_mark_attended(p_idempotency_key, p_request_hash, p_session_date, p_student_ids) $$;
create or replace function public.materialize_recurring_sessions(
  p_idempotency_key uuid,
  p_request_hash text,
  p_through_date date default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.materialize_recurring_sessions(p_idempotency_key, p_request_hash, p_through_date) $$;
create or replace function public.undo_operation(
  p_idempotency_key uuid,
  p_request_hash text,
  p_operation_id uuid
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.undo_operation(p_idempotency_key, p_request_hash, p_operation_id) $$;

create or replace function public.save_student(
  p_idempotency_key uuid,
  p_request_hash text,
  p_student_id uuid,
  p_name text,
  p_default_rate_cents integer,
  p_notes text,
  p_archived boolean,
  p_expected_version integer
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.save_student(p_idempotency_key, p_request_hash, p_student_id, p_name, p_default_rate_cents, p_notes, p_archived, p_expected_version) $$;
create or replace function public.save_template(
  p_idempotency_key uuid,
  p_request_hash text,
  p_template_id uuid,
  p_student_id uuid,
  p_weekday smallint,
  p_starts_on date,
  p_ends_on date,
  p_paused boolean,
  p_archived boolean,
  p_expected_version integer
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.save_template(p_idempotency_key, p_request_hash, p_template_id, p_student_id, p_weekday, p_starts_on, p_ends_on, p_paused, p_archived, p_expected_version) $$;
create or replace function public.save_session(
  p_idempotency_key uuid,
  p_request_hash text,
  p_session_id uuid,
  p_student_id uuid,
  p_session_date date,
  p_status public.session_status,
  p_void boolean,
  p_void_reason text,
  p_expected_version integer
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.save_session(p_idempotency_key, p_request_hash, p_session_id, p_student_id, p_session_date, p_status, p_void, p_void_reason, p_expected_version) $$;
create or replace function public.correct_payment(
  p_idempotency_key uuid,
  p_request_hash text,
  p_payment_id uuid,
  p_expected_version integer,
  p_void_reason text,
  p_replacement_date date,
  p_replacement_amount_cents integer,
  p_replacement_method public.payment_method,
  p_replacement_notes text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.correct_payment(p_idempotency_key, p_request_hash, p_payment_id, p_expected_version, p_void_reason, p_replacement_date, p_replacement_amount_cents, p_replacement_method, p_replacement_notes) $$;
create or replace function public.mark_daily_reviewed(
  p_idempotency_key uuid,
  p_request_hash text,
  p_review_date date
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.mark_daily_reviewed(p_idempotency_key, p_request_hash, p_review_date) $$;

revoke all on function app_private.begin_operation(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function app_private.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) from public, anon;
revoke all on function app_private.bulk_mark_attended(uuid, text, date, uuid[]) from public, anon;
revoke all on function app_private.materialize_recurring_sessions(uuid, text, date) from public, anon;
revoke all on function app_private.undo_operation(uuid, text, uuid) from public, anon;
revoke all on function app_private.save_student(uuid, text, uuid, text, integer, text, boolean, integer) from public, anon;
revoke all on function app_private.save_template(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer) from public, anon;
revoke all on function app_private.save_session(uuid, text, uuid, uuid, date, public.session_status, boolean, text, integer) from public, anon;
revoke all on function app_private.correct_payment(uuid, text, uuid, integer, text, date, integer, public.payment_method, text) from public, anon;
revoke all on function app_private.mark_daily_reviewed(uuid, text, date) from public, anon;
revoke all on function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) from public, anon;
revoke all on function public.bulk_mark_attended(uuid, text, date, uuid[]) from public, anon;
revoke all on function public.materialize_recurring_sessions(uuid, text, date) from public, anon;
revoke all on function public.undo_operation(uuid, text, uuid) from public, anon;
revoke all on function public.save_student(uuid, text, uuid, text, integer, text, boolean, integer) from public, anon;
revoke all on function public.save_template(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer) from public, anon;
revoke all on function public.save_session(uuid, text, uuid, uuid, date, public.session_status, boolean, text, integer) from public, anon;
revoke all on function public.correct_payment(uuid, text, uuid, integer, text, date, integer, public.payment_method, text) from public, anon;
revoke all on function public.mark_daily_reviewed(uuid, text, date) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) to authenticated;
grant execute on function app_private.bulk_mark_attended(uuid, text, date, uuid[]) to authenticated;
grant execute on function app_private.materialize_recurring_sessions(uuid, text, date) to authenticated;
grant execute on function app_private.undo_operation(uuid, text, uuid) to authenticated;
grant execute on function app_private.save_student(uuid, text, uuid, text, integer, text, boolean, integer) to authenticated;
grant execute on function app_private.save_template(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer) to authenticated;
grant execute on function app_private.save_session(uuid, text, uuid, uuid, date, public.session_status, boolean, text, integer) to authenticated;
grant execute on function app_private.correct_payment(uuid, text, uuid, integer, text, date, integer, public.payment_method, text) to authenticated;
grant execute on function app_private.mark_daily_reviewed(uuid, text, date) to authenticated;
grant execute on function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) to authenticated;
grant execute on function public.bulk_mark_attended(uuid, text, date, uuid[]) to authenticated;
grant execute on function public.materialize_recurring_sessions(uuid, text, date) to authenticated;
grant execute on function public.undo_operation(uuid, text, uuid) to authenticated;
grant execute on function public.save_student(uuid, text, uuid, text, integer, text, boolean, integer) to authenticated;
grant execute on function public.save_template(uuid, text, uuid, uuid, smallint, date, date, boolean, boolean, integer) to authenticated;
grant execute on function public.save_session(uuid, text, uuid, uuid, date, public.session_status, boolean, text, integer) to authenticated;
grant execute on function public.correct_payment(uuid, text, uuid, integer, text, date, integer, public.payment_method, text) to authenticated;
grant execute on function public.mark_daily_reviewed(uuid, text, date) to authenticated;

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
-- denial with real authenticated JWTs.
