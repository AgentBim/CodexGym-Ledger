-- Behaviour tests for the draft package schema and RPCs.
-- THROWAWAY DATABASES ONLY. This seeds rows as a superuser and must never run
-- against a Supabase project. Usage (fresh local Postgres 15+):
--   createdb ledger_test
--   psql -d ledger_test -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql
--   psql -d ledger_test -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/draft_initial_schema.sql
--   psql -d ledger_test -f supabase/tests/package_rpcs.sql
-- Ends with "ALL PACKAGE TESTS PASSED"; any failed assertion stops the run.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set s1 '11111111-1111-1111-1111-111111111111'
\set s2 '22222222-2222-2222-2222-222222222222'
\set s3 '33333333-3333-3333-3333-333333333333'
\set sb 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

-- ---------- Test helpers and seed data (as postgres) ----------
create function public.t_hash(text) returns text language sql immutable as $$ select encode(sha256(convert_to($1, 'UTF8')), 'hex') $$;
create function public.t_assert(ok boolean, msg text) returns text language plpgsql as $$
begin if ok is not true then raise exception 'ASSERTION FAILED: %', msg; end if; return 'ok  ' || msg; end $$;
create function public.t_expect_error(p_sql text, p_pattern text, msg text) returns text language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm like p_pattern then return 'ok  ' || msg || ' (' || sqlerrm || ')'; end if;
    raise exception 'ASSERTION FAILED: % — expected error like %, got: %', msg, p_pattern, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED: % — expected error like %, but it succeeded', msg, p_pattern;
end $$;
-- Balance per the documented rule: held charges + package prices - payments.
create function public.t_balance(p_student uuid) returns integer language sql as $$
  select coalesce((select sum(charge_rate_cents) from public.sessions where student_id = p_student and status = 'held' and voided_at is null), 0)
       + coalesce((select sum(price_cents) from public.student_packages where student_id = p_student and voided_at is null), 0)
       - coalesce((select sum(amount_cents) from public.payments where student_id = p_student and voided_at is null), 0) $$;
grant execute on function public.t_hash(text), public.t_assert(boolean, text), public.t_expect_error(text, text, text) to authenticated, anon;

insert into auth.users values (:'A'), (:'B');
insert into public.students (id, owner_id, name, default_rate_cents) values
  (:'s1', :'A', 'Abigail', 3000), (:'s2', :'A', 'Arielle', 3000), (:'s3', :'A', 'Caiden', 3000), (:'sb', :'B', 'Other coach student', 3000);
select timezone('America/Barbados', now())::date as today \gset

-- ---------- Owner A ----------
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false) \g /dev/null

select t_expect_error($$select public.create_package_definition(gen_random_uuid(), t_hash('bad'), 'Bad', null, 'time_based', 5::smallint, 1000, null::smallint)$$, '%invalid_class_count%', 'time-based package with a class count is rejected');
select t_expect_error($$select public.create_package_definition(gen_random_uuid(), t_hash('bad2'), 'Bad', null, 'class_pack', null::smallint, 1000, null::smallint)$$, '%invalid_class_count%', 'class pack without a class count is rejected');

select public.create_package_definition(gen_random_uuid(), t_hash('def1'), '2-Class Pack', ' Two classes ', 'class_pack', 2::smallint, 5000, 4::smallint)->'packageDefinition'->>'id' as def1 \gset
select public.create_package_definition(gen_random_uuid(), t_hash('def2'), 'Unlimited', null, 'time_based', null::smallint, 20000, 8::smallint)->'packageDefinition'->>'id' as def2 \gset
select t_assert((select description = 'Two classes' and archived_at is null and version = 1 from public.package_definitions where id = :'def1'), 'definition trims description and starts active');

-- Assign: price and size come from the definition.
select public.assign_package('aaaaaaaa-0000-0000-0000-000000000001', t_hash('assign1'), :'s1', :'def1', :'today', (:'today'::date + 28))->>'operationId' as assign_op \gset
select id as sp1 from public.student_packages where student_id = :'s1' \gset
select t_assert((select price_cents = 5000 and class_count = 2 and name = '2-Class Pack' and purchased_on = :'today'::date from public.student_packages where id = :'sp1'), 'assignment snapshots price, size, name and purchase date');
select t_expect_error(format($$select public.assign_package(gen_random_uuid(), t_hash('x'), %L, %L, %L, %L)$$, :'s1', :'def1', :'today', (:'today'::date - 1)), '%invalid_dates%', 'end date before start is rejected');

-- Attendance draws from the package; the other student is charged the rate.
select public.bulk_mark_attended('bbbbbbbb-0000-0000-0000-000000000001', t_hash('day0'), :'today', array[:'s1', :'s2']::uuid[]) as op1 \gset
select t_assert((:'op1'::jsonb->>'packageUses')::int = 1 and (:'op1'::jsonb->>'created')::int = 2, 'day 0: one package use, two sessions created');
select t_assert((select charge_rate_cents = 0 and student_package_id = :'sp1' from public.sessions where student_id = :'s1' and session_date = :'today'), 'covered session has zero charge and links the package');
select t_assert((select charge_rate_cents = 3000 and student_package_id is null from public.sessions where student_id = :'s2' and session_date = :'today'), 'uncovered student is charged the default rate');

-- Idempotent replay and conflicting reuse.
select t_assert(public.bulk_mark_attended('bbbbbbbb-0000-0000-0000-000000000001', t_hash('day0'), :'today', array[:'s1', :'s2']::uuid[]) = :'op1'::jsonb, 'replay with same key and hash returns the original result');
select t_assert((select count(*) = 1 from public.sessions where student_id = :'s1' and session_date = :'today'), 'replay creates no duplicate session');
select t_expect_error($$select public.bulk_mark_attended('bbbbbbbb-0000-0000-0000-000000000001', t_hash('different'), current_date, array['11111111-1111-1111-1111-111111111111']::uuid[])$$, '%idempotency_conflict%', 'same key with a different request hash conflicts');

select public.bulk_mark_attended(gen_random_uuid(), t_hash('day1'), :'today'::date + 1, array[:'s1']::uuid[]) as op2 \gset
select t_assert((:'op2'::jsonb->>'packageUses')::int = 1, 'day 1: second class drawn from the pack');
select public.bulk_mark_attended(gen_random_uuid(), t_hash('day2'), :'today'::date + 2, array[:'s1']::uuid[]) as op3 \gset
select t_assert((:'op3'::jsonb->>'packageUses')::int = 0, 'day 2: pack used up');
select t_assert((select charge_rate_cents = 3000 and student_package_id is null from public.sessions where student_id = :'s1' and session_date = :'today'::date + 2), 'used-up pack falls back to the rate');

-- Undo rules.
select t_expect_error(format($$select public.undo_operation(gen_random_uuid(), t_hash('u1'), %L)$$, :'assign_op'), '%stale_operation%', 'undoing an assignment with drawn classes is refused');
select public.undo_operation(gen_random_uuid(), t_hash('undo-day1'), (:'op2'::jsonb->>'operationId')::uuid) \g /dev/null
select t_assert((select voided_at is not null from public.sessions where student_id = :'s1' and session_date = :'today'::date + 1), 'undo voids the day-1 session');
select public.bulk_mark_attended(gen_random_uuid(), t_hash('day3'), :'today'::date + 3, array[:'s1']::uuid[]) as op4 \gset
select t_assert((:'op4'::jsonb->>'packageUses')::int = 1, 'the class freed by undo is drawn again');
select public.bulk_mark_attended(gen_random_uuid(), t_hash('day40'), :'today'::date + 40, array[:'s1']::uuid[]) as op5 \gset
select t_assert((:'op5'::jsonb->>'packageUses')::int = 0, 'a date after the package ends is charged the rate');
-- Package 5000 + day 2 (3000) + day 40 (3000).
select t_assert(t_balance(:'s1') = 11000, 'balance = package price + uncovered session charges');

-- Soonest-expiring package first.
select public.assign_package(gen_random_uuid(), t_hash('long'), :'s2', :'def1', :'today', (:'today'::date + 60)) \g /dev/null
select public.assign_package(gen_random_uuid(), t_hash('short'), :'s2', :'def1', :'today', (:'today'::date + 10))->'studentPackage'->>'id' as short_pkg \gset
select public.bulk_mark_attended(gen_random_uuid(), t_hash('s2-day5'), :'today'::date + 5, array[:'s2']::uuid[]) \g /dev/null
select t_assert((select student_package_id = :'short_pkg' from public.sessions where student_id = :'s2' and session_date = :'today'::date + 5), 'the soonest-expiring package is used first');

-- Time-based pass: unlimited within validity, none after.
select public.assign_package(gen_random_uuid(), t_hash('tb'), :'s3', :'def2', :'today', (:'today'::date + 56)) \g /dev/null
select sum((public.bulk_mark_attended(gen_random_uuid(), t_hash('tb' || d), :'today'::date + d, array[:'s3']::uuid[])->>'packageUses')::int) as tb_uses from generate_series(0, 4) d \gset
select t_assert(:tb_uses = 5, 'time-based pass covers every session within validity');
select t_assert((public.bulk_mark_attended(gen_random_uuid(), t_hash('tb-late'), :'today'::date + 57, array[:'s3']::uuid[])->>'packageUses')::int = 0, 'time-based pass stops after its end date');

-- Archive with optimistic concurrency, then undo it.
select t_expect_error(format($$select public.set_package_archived(gen_random_uuid(), t_hash('arch-bad'), %L, 99, true)$$, :'def1'), '%stale_operation%', 'archive with a stale version is refused');
select public.set_package_archived(gen_random_uuid(), t_hash('arch'), :'def1', 1, true)->>'operationId' as arch_op \gset
select t_expect_error(format($$select public.assign_package(gen_random_uuid(), t_hash('after-arch'), %L, %L, %L)$$, :'s3', :'def1', :'today'), '%package_not_found%', 'archived packages cannot be assigned');
select t_assert((select count(*) = 3 from public.student_packages where package_definition_id = :'def1' and voided_at is null), 'archiving keeps existing assignments');
select public.undo_operation(gen_random_uuid(), t_hash('undo-arch'), :'arch_op') \g /dev/null
select t_assert((select archived_at is null from public.package_definitions where id = :'def1'), 'undo restores an archived package');

-- Undo a create (archives, never deletes) and an assignment with nothing drawn.
select public.create_package_definition(gen_random_uuid(), t_hash('def3'), 'Temp', null, 'class_pack', 1::smallint, 100, null::smallint)->>'operationId' as def3_op \gset
select public.undo_operation(gen_random_uuid(), t_hash('undo-def3'), :'def3_op') \g /dev/null
select t_assert((select archived_at is not null from public.package_definitions where name = 'Temp'), 'undoing a package create archives it');
select public.assign_package(gen_random_uuid(), t_hash('assign-s3'), :'s3', :'def1', :'today')->>'operationId' as assign_s3 \gset
select t_balance(:'s3') as s3_before \gset
select public.undo_operation(gen_random_uuid(), t_hash('undo-assign-s3'), :'assign_s3') \g /dev/null
select t_assert(t_balance(:'s3') = :s3_before - 5000, 'undoing an unused assignment voids it and removes its charge');

-- Clients cannot bypass the RPCs.
select t_expect_error($$insert into public.package_definitions (owner_id, name, kind, class_count, price_cents) values ('00000000-0000-0000-0000-00000000000a', 'x', 'class_pack', 1, 0)$$, '%permission denied%', 'direct insert into package_definitions is denied');
select t_expect_error($$update public.student_packages set price_cents = 0$$, '%permission denied%', 'direct update of student_packages is denied');
select t_expect_error($$update public.sessions set student_package_id = null$$, '%permission denied%', 'direct update of sessions is denied');
select t_expect_error(format($$select app_private.claim_student_package(%L, %L, current_date)$$, :'A', :'s1'), '%permission denied%', 'internal claim helper is not callable by clients');

-- ---------- Owner B ----------
select set_config('request.jwt.claim.sub', :'B', false) \g /dev/null
select t_assert((select count(*) = 0 from public.package_definitions) and (select count(*) = 0 from public.student_packages), 'another owner sees none of A''s packages');
select t_expect_error(format($$select public.assign_package(gen_random_uuid(), t_hash('b1'), %L, %L, %L)$$, :'s1', :'def1', :'today'), '%student_not_found%', 'another owner cannot assign to A''s student');
select t_expect_error(format($$select public.assign_package(gen_random_uuid(), t_hash('b2'), %L, %L, %L)$$, :'sb', :'def1', :'today'), '%package_not_found%', 'another owner cannot assign A''s package');
select t_expect_error(format($$select public.set_package_archived(gen_random_uuid(), t_hash('b3'), %L, 1, true)$$, :'def1'), '%package_not_found%', 'another owner cannot archive A''s package');
select t_expect_error(format($$select public.undo_operation(gen_random_uuid(), t_hash('b4'), %L)$$, :'arch_op'), '%operation_not_found%', 'another owner cannot undo A''s operation');
select t_assert((public.bulk_mark_attended(gen_random_uuid(), t_hash('b5'), :'today', array[:'s1']::uuid[])->>'created')::int = 0, 'another owner cannot mark A''s student attended');

-- ---------- No identity / anon ----------
select set_config('request.jwt.claim.sub', '', false) \g /dev/null
select t_expect_error(format($$select public.assign_package(gen_random_uuid(), t_hash('n1'), %L, %L, %L)$$, :'s1', :'def1', :'today'), '%auth_required%', 'a request without a user is rejected');
reset role;
set role anon;
select t_expect_error(format($$select public.assign_package(gen_random_uuid(), t_hash('anon'), %L, %L, %L)$$, :'s1', :'def1', :'today'), '%permission denied%', 'anon cannot execute package RPCs');
select t_expect_error($$select count(*) from public.package_definitions$$, '%permission denied%', 'anon cannot read package tables');
reset role;
select 'ALL PACKAGE TESTS PASSED';
