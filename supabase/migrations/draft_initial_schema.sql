-- DRAFT ONLY — NOT APPLIED, NOT APPROVED, NOT A TIMESTAMPED MIGRATION.
-- This proposal intentionally omits mutation RPCs pending review. Do not run it
-- against any local, preview, or production database without explicit approval.

create type public.session_status as enum ('scheduled', 'held', 'canceled', 'no_show');
create type public.payment_method as enum ('cash', 'transfer', 'other');
create type public.session_source as enum ('manual', 'bulk_attendance', 'recurrence');
create type public.operation_state as enum ('started', 'completed', 'failed');
create type public.package_kind as enum ('class_pack', 'time_based');

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

-- A term, class pack, or time-based pass the coach sells.
create table public.package_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 200),
  kind public.package_kind not null,
  class_count smallint check (class_count between 1 and 200),
  price_cents integer not null check (price_cents between 0 and 10000000),
  validity_weeks smallint check (validity_weeks between 1 and 104),
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'class_pack') = (class_count is not null)),
  unique (owner_id, id)
);

-- A package assigned to one student. Name, size, and price are snapshots so
-- later definition edits never rewrite history. Usage is derived by counting
-- live held sessions that reference the row.
create table public.student_packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null,
  package_definition_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind public.package_kind not null,
  class_count smallint check (class_count between 1 and 200),
  price_cents integer not null check (price_cents between 0 and 10000000),
  purchased_on date not null,
  starts_on date not null,
  ends_on date,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 500),
  created_operation_id uuid not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'class_pack') = (class_count is not null)),
  check (ends_on is null or ends_on >= starts_on),
  check ((voided_at is null and void_reason is null) or voided_at is not null),
  unique (owner_id, id),
  unique (owner_id, student_id, id),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, package_definition_id) references public.package_definitions(owner_id, id) on delete restrict,
  foreign key (owner_id, created_operation_id) references public.mutation_operations(owner_id, id) on delete restrict
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null,
  template_id uuid,
  session_date date not null,
  status public.session_status not null,
  charge_rate_cents integer check (charge_rate_cents between 0 and 10000000),
  -- Set when a held session draws a class from a package instead of charging the rate.
  student_package_id uuid,
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
  check (student_package_id is null or (status = 'held' and charge_rate_cents = 0)),
  check ((voided_at is null and void_reason is null) or voided_at is not null),
  unique (owner_id, id),
  foreign key (owner_id, student_id) references public.students(owner_id, id) on delete restrict,
  foreign key (owner_id, template_id) references public.recurring_session_templates(owner_id, id) on delete restrict,
  foreign key (owner_id, student_id, student_package_id) references public.student_packages(owner_id, student_id, id) on delete restrict,
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
  entity_type text not null check (entity_type in ('student', 'session', 'payment', 'template', 'daily_review', 'package_definition', 'student_package')),
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
create index sessions_student_package_id_idx on public.sessions (student_package_id) where student_package_id is not null;
create index package_definitions_owner_active_idx on public.package_definitions (owner_id, lower(name)) where archived_at is null;
create index student_packages_student_id_idx on public.student_packages (student_id);
create index student_packages_definition_id_idx on public.student_packages (package_definition_id);
create index student_packages_created_operation_id_idx on public.student_packages (created_operation_id);
create index student_packages_owner_student_live_idx on public.student_packages (owner_id, student_id, starts_on) where voided_at is null;
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
alter table public.package_definitions enable row level security;
alter table public.package_definitions force row level security;
alter table public.student_packages enable row level security;
alter table public.student_packages force row level security;
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
create policy package_definitions_select on public.package_definitions for select to authenticated using ((select auth.uid()) = owner_id);
create policy student_packages_select on public.student_packages for select to authenticated using ((select auth.uid()) = owner_id);
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
-- Package tables are read-only to clients; all writes go through the audited RPCs.
grant select on public.package_definitions to authenticated;
grant select on public.student_packages to authenticated;
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

-- Returns the package a held session on p_session_date should draw from, or null
-- to charge the student's rate: live, valid on that date, not used up, soonest
-- expiry first. Candidate rows are locked before usage is counted so concurrent
-- attendance cannot overdraw a class pack. Internal only; not granted to clients.
create or replace function app_private.claim_student_package(p_owner uuid, p_student_id uuid, p_session_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.student_packages%rowtype;
  v_used integer;
begin
  for v_package in
    select * from public.student_packages
    where owner_id = p_owner and student_id = p_student_id and voided_at is null
      and starts_on <= p_session_date and (ends_on is null or p_session_date <= ends_on)
    order by ends_on nulls last, starts_on, id
    for update
  loop
    if v_package.class_count is null then return v_package.id; end if;
    select count(*) into v_used from public.sessions
      where owner_id = p_owner and student_package_id = v_package.id and status = 'held' and voided_at is null;
    if v_used < v_package.class_count then return v_package.id; end if;
  end loop;
  return null;
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
  v_package_id uuid;
  v_package_uses integer := 0;
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
      v_package_id := app_private.claim_student_package(v_owner, v_student.id, p_session_date);
      insert into public.sessions (owner_id, student_id, session_date, status, charge_rate_cents, student_package_id, source, created_operation_id)
      values (v_owner, v_student.id, p_session_date, 'held', case when v_package_id is null then v_student.default_rate_cents else 0 end, v_package_id, 'bulk_attendance', v_operation.id)
      returning * into v_session;
      if v_package_id is not null then v_package_uses := v_package_uses + 1; end if;
      v_created := v_created + 1;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
      values (v_owner, v_operation.id, 'session', v_session.id, 'created', to_jsonb(v_session), v_session.version);
    elsif v_session.status = 'held' then
      v_unchanged := v_unchanged + 1;
    elsif v_session.status = 'scheduled' and v_session.manually_edited_at is null then
      v_before := to_jsonb(v_session);
      v_package_id := app_private.claim_student_package(v_owner, v_student.id, p_session_date);
      update public.sessions set status = 'held',
        charge_rate_cents = case when v_package_id is null then v_student.default_rate_cents else 0 end,
        student_package_id = v_package_id,
        source = 'bulk_attendance', version = version + 1, updated_at = now()
      where id = v_session.id returning * into v_session;
      if v_package_id is not null then v_package_uses := v_package_uses + 1; end if;
      v_updated := v_updated + 1;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      values (v_owner, v_operation.id, 'session', v_session.id, 'marked_held', v_before, to_jsonb(v_session), v_session.version);
    else
      v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('studentId', v_student.id, 'sessionId', v_session.id, 'status', v_session.status));
    end if;
  end loop;

  v_result := jsonb_build_object('operationId', v_operation.id, 'created', v_created, 'updated', v_updated, 'unchanged', v_unchanged, 'packageUses', v_package_uses, 'conflicts', v_conflicts, 'undoExpiresAt', v_operation.undo_expires_at);
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
          student_package_id = (v_event.before_state->>'student_package_id')::uuid,
          source = (v_event.before_state->>'source')::public.session_source,
          manually_edited_at = (v_event.before_state->>'manually_edited_at')::timestamptz,
          version = version + 1, updated_at = now()
        where owner_id = v_owner and id = v_event.entity_id;
      end if;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'session', id, 'undone', v_event.after_state, to_jsonb(s), s.version from public.sessions s where s.id = v_event.entity_id;
    elsif v_event.entity_type = 'student_package' then
      select version into v_current_version from public.student_packages where owner_id = v_owner and id = v_event.entity_id and voided_at is null for update;
      if not found or v_current_version <> v_event.entity_version then raise exception 'stale_operation'; end if;
      -- Classes already drawn from the package must be corrected first.
      if exists (select 1 from public.sessions where owner_id = v_owner and student_package_id = v_event.entity_id and voided_at is null) then raise exception 'stale_operation'; end if;
      update public.student_packages set voided_at = now(), void_reason = 'Undo', version = version + 1, updated_at = now() where owner_id = v_owner and id = v_event.entity_id;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'student_package', id, 'undo_voided', v_event.after_state, to_jsonb(sp), sp.version from public.student_packages sp where sp.id = v_event.entity_id;
    elsif v_event.entity_type = 'package_definition' then
      select version into v_current_version from public.package_definitions where owner_id = v_owner and id = v_event.entity_id for update;
      if not found or v_current_version <> v_event.entity_version then raise exception 'stale_operation'; end if;
      -- Definitions are never deleted: undoing a create archives it, undoing an archive toggle restores the prior state.
      update public.package_definitions
        set archived_at = case when v_event.before_state is null then now() else (v_event.before_state->>'archived_at')::timestamptz end,
          version = version + 1, updated_at = now()
      where owner_id = v_owner and id = v_event.entity_id;
      insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
      select v_owner, v_undo.id, 'package_definition', id, 'undone', v_event.after_state, to_jsonb(d), d.version from public.package_definitions d where d.id = v_event.entity_id;
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

create or replace function app_private.create_package_definition(
  p_idempotency_key uuid,
  p_request_hash text,
  p_name text,
  p_description text,
  p_kind public.package_kind,
  p_class_count smallint,
  p_price_cents integer,
  p_validity_weeks smallint,
  p_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_definition public.package_definitions%rowtype;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if (p_kind = 'class_pack') <> (p_class_count is not null) then raise exception 'invalid_class_count'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'create_package_definition', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  insert into public.package_definitions (owner_id, name, description, kind, class_count, price_cents, validity_weeks, archived_at)
  values (v_owner, btrim(p_name), nullif(btrim(p_description), ''), p_kind, p_class_count, p_price_cents, p_validity_weeks, case when p_active then null else now() end)
  returning * into v_definition;
  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
  values (v_owner, v_operation.id, 'package_definition', v_definition.id, 'created', to_jsonb(v_definition), v_definition.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'packageDefinition', to_jsonb(v_definition), 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.set_package_archived(
  p_idempotency_key uuid,
  p_request_hash text,
  p_package_definition_id uuid,
  p_expected_version integer,
  p_archived boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_definition public.package_definitions%rowtype;
  v_before jsonb;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'set_package_archived', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  select * into v_definition from public.package_definitions where owner_id = v_owner and id = p_package_definition_id for update;
  if not found then raise exception 'package_not_found'; end if;
  if v_definition.version <> p_expected_version then raise exception 'stale_operation'; end if;
  -- Archiving only stops new assignments; students keep what they already hold.
  v_before := to_jsonb(v_definition);
  update public.package_definitions
    set archived_at = case when p_archived then coalesce(archived_at, now()) else null end, version = version + 1, updated_at = now()
  where id = v_definition.id returning * into v_definition;
  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, before_state, after_state, entity_version)
  values (v_owner, v_operation.id, 'package_definition', v_definition.id, case when p_archived then 'archived' else 'restored' end, v_before, to_jsonb(v_definition), v_definition.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'packageDefinition', to_jsonb(v_definition), 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
  return v_result;
end;
$$;

create or replace function app_private.assign_package(
  p_idempotency_key uuid,
  p_request_hash text,
  p_student_id uuid,
  p_package_definition_id uuid,
  p_starts_on date,
  p_ends_on date default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_operation public.mutation_operations%rowtype;
  v_definition public.package_definitions%rowtype;
  v_package public.student_packages%rowtype;
  v_result jsonb;
begin
  if v_owner is null then raise exception 'auth_required'; end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then raise exception 'invalid_dates'; end if;
  if not exists (select 1 from public.students where owner_id = v_owner and id = p_student_id and archived_at is null) then raise exception 'student_not_found'; end if;

  insert into public.mutation_operations (owner_id, idempotency_key, operation_kind, request_hash, undo_expires_at)
  values (v_owner, p_idempotency_key, 'assign_package', p_request_hash, now() + interval '10 minutes')
  on conflict (owner_id, idempotency_key) do nothing;
  select * into v_operation from public.mutation_operations where owner_id = v_owner and idempotency_key = p_idempotency_key for update;
  if v_operation.request_hash <> p_request_hash then raise exception 'idempotency_conflict'; end if;
  if v_operation.state = 'completed' then return v_operation.result; end if;

  select * into v_definition from public.package_definitions where owner_id = v_owner and id = p_package_definition_id and archived_at is null for share;
  if not found then raise exception 'package_not_found'; end if;
  -- Price and size come from the definition, never from the client.
  insert into public.student_packages (owner_id, student_id, package_definition_id, name, kind, class_count, price_cents, purchased_on, starts_on, ends_on, created_operation_id)
  values (v_owner, p_student_id, v_definition.id, v_definition.name, v_definition.kind, v_definition.class_count, v_definition.price_cents,
    timezone('America/Barbados', now())::date, p_starts_on, p_ends_on, v_operation.id)
  returning * into v_package;
  insert into public.audit_events (owner_id, operation_id, entity_type, entity_id, action, after_state, entity_version)
  values (v_owner, v_operation.id, 'student_package', v_package.id, 'created', to_jsonb(v_package), v_package.version);
  v_result := jsonb_build_object('operationId', v_operation.id, 'studentPackage', to_jsonb(v_package), 'undoExpiresAt', v_operation.undo_expires_at);
  update public.mutation_operations set state = 'completed', result = v_result, completed_at = now() where id = v_operation.id;
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
create or replace function public.create_package_definition(uuid, text, text, text, public.package_kind, smallint, integer, smallint, boolean default true)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.create_package_definition($1, $2, $3, $4, $5, $6, $7, $8, $9) $$;
create or replace function public.set_package_archived(uuid, text, uuid, integer, boolean)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.set_package_archived($1, $2, $3, $4, $5) $$;
create or replace function public.assign_package(uuid, text, uuid, uuid, date, date default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.assign_package($1, $2, $3, $4, $5, $6) $$;

revoke all on function app_private.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) from public, anon;
revoke all on function app_private.bulk_mark_attended(uuid, text, date, uuid[]) from public, anon;
revoke all on function app_private.materialize_recurring_sessions(uuid, text, date) from public, anon;
revoke all on function app_private.undo_operation(uuid, text, uuid) from public, anon;
revoke all on function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) from public, anon;
revoke all on function public.bulk_mark_attended(uuid, text, date, uuid[]) from public, anon;
revoke all on function public.materialize_recurring_sessions(uuid, text, date) from public, anon;
revoke all on function public.undo_operation(uuid, text, uuid) from public, anon;
revoke all on function app_private.claim_student_package(uuid, uuid, date) from public, anon, authenticated;
revoke all on function app_private.create_package_definition(uuid, text, text, text, public.package_kind, smallint, integer, smallint, boolean) from public, anon;
revoke all on function app_private.set_package_archived(uuid, text, uuid, integer, boolean) from public, anon;
revoke all on function app_private.assign_package(uuid, text, uuid, uuid, date, date) from public, anon;
revoke all on function public.create_package_definition(uuid, text, text, text, public.package_kind, smallint, integer, smallint, boolean) from public, anon;
revoke all on function public.set_package_archived(uuid, text, uuid, integer, boolean) from public, anon;
revoke all on function public.assign_package(uuid, text, uuid, uuid, date, date) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) to authenticated;
grant execute on function app_private.bulk_mark_attended(uuid, text, date, uuid[]) to authenticated;
grant execute on function app_private.materialize_recurring_sessions(uuid, text, date) to authenticated;
grant execute on function app_private.undo_operation(uuid, text, uuid) to authenticated;
grant execute on function public.log_payment(uuid, text, uuid, date, integer, public.payment_method, text) to authenticated;
grant execute on function public.bulk_mark_attended(uuid, text, date, uuid[]) to authenticated;
grant execute on function public.materialize_recurring_sessions(uuid, text, date) to authenticated;
grant execute on function public.undo_operation(uuid, text, uuid) to authenticated;
grant execute on function app_private.create_package_definition(uuid, text, text, text, public.package_kind, smallint, integer, smallint, boolean) to authenticated;
grant execute on function app_private.set_package_archived(uuid, text, uuid, integer, boolean) to authenticated;
grant execute on function app_private.assign_package(uuid, text, uuid, uuid, date, date) to authenticated;
grant execute on function public.create_package_definition(uuid, text, text, text, public.package_kind, smallint, integer, smallint, boolean) to authenticated;
grant execute on function public.set_package_archived(uuid, text, uuid, integer, boolean) to authenticated;
grant execute on function public.assign_package(uuid, text, uuid, uuid, date, date) to authenticated;

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
revoke insert, update, delete on public.package_definitions from authenticated;
revoke insert, update, delete on public.student_packages from authenticated;

-- SECURITY DEFINER is narrowly used in the unexposed app_private schema because
-- these RPCs must append immutable audit records atomically. Public entry points
-- are SECURITY INVOKER wrappers. Each internal function pins an empty search_path,
-- requires auth.uid(), scopes every row to that owner, revokes PUBLIC/anon execute,
-- and accepts no owner ID.
-- Before approval/application: run database advisors and integration-test cross-owner
-- denial with real authenticated JWTs, including package claims under concurrent
-- bulk attendance and undo of assignments with drawn classes. Add audited RPCs for student, template,
-- session correction/void, payment correction/void, and daily-review mutations
-- before this draft can satisfy the complete product contract.
