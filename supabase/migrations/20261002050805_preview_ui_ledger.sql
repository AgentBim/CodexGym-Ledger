-- Additive UI transition. Apply to an isolated preview first; production requires approval.
alter table public.students add column class_enrolled boolean;
alter table public.sessions add column attendance_mark text check (attendance_mark in ('present','late','absent'));

create table public.class_settings (
  owner_id uuid primary key references auth.users(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  version integer not null default 1
);
create table public.package_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  kind text not null check (kind in ('class_pack','time_based')),
  class_count integer,
  price_cents integer not null check (price_cents between 0 and 100000000),
  validity_weeks integer check (validity_weeks between 1 and 520),
  archived boolean not null default false,
  version integer not null default 1,
  unique(owner_id,id),
  check ((kind = 'class_pack' and class_count is not null and class_count between 1 and 200) or (kind = 'time_based' and class_count is null and validity_weeks is not null))
);
create table public.student_packages (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  student_id uuid not null, package_id uuid not null,
  name text not null, kind text not null, class_count integer, price_cents integer not null,
  start_date date not null, end_date date check (end_date >= start_date),
  created_at timestamptz not null default now(),
  unique(owner_id,id), unique(owner_id,student_id,id),
  foreign key(owner_id,student_id) references public.students(owner_id,id),
  foreign key(owner_id,package_id) references public.package_definitions(owner_id,id)
);
create table public.ledger_adjustments (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  student_id uuid not null, entry_date date not null,
  amount_cents integer not null check (amount_cents between -100000000 and 100000000),
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  created_at timestamptz not null default now(), operation_id uuid not null,
  foreign key(owner_id,student_id) references public.students(owner_id,id),
  foreign key(owner_id,operation_id) references public.mutation_operations(owner_id,id)
);
alter table public.sessions add column student_package_id uuid;
alter table public.sessions add constraint sessions_package_owner_fk foreign key(owner_id,student_id,student_package_id) references public.student_packages(owner_id,student_id,id);
create index sessions_package_usage_idx on public.sessions(owner_id,student_package_id) where voided_at is null and status='held';
create index student_packages_student_idx on public.student_packages(owner_id,student_id);
create index student_packages_definition_idx on public.student_packages(owner_id,package_id);
create index adjustments_student_idx on public.ledger_adjustments(owner_id,student_id,entry_date);
create index adjustments_operation_idx on public.ledger_adjustments(owner_id,operation_id);
alter table public.audit_events drop constraint audit_events_entity_type_check;
alter table public.audit_events add constraint audit_events_entity_type_check check (entity_type in ('student','session','payment','template','daily_review','package','adjustment','class_settings'));

alter table public.class_settings enable row level security;
alter table public.class_settings force row level security;
alter table public.package_definitions enable row level security;
alter table public.package_definitions force row level security;
alter table public.student_packages enable row level security;
alter table public.student_packages force row level security;
alter table public.ledger_adjustments enable row level security;
alter table public.ledger_adjustments force row level security;
create policy settings_owner_read on public.class_settings for select to authenticated using ((select auth.uid())=owner_id);
create policy packages_owner_read on public.package_definitions for select to authenticated using ((select auth.uid())=owner_id);
create policy assigned_owner_read on public.student_packages for select to authenticated using ((select auth.uid())=owner_id);
create policy adjustments_owner_read on public.ledger_adjustments for select to authenticated using ((select auth.uid())=owner_id);
revoke all on public.class_settings,public.package_definitions,public.student_packages,public.ledger_adjustments from public,anon,authenticated;
grant select on public.class_settings,public.package_definitions,public.student_packages,public.ledger_adjustments to authenticated;

-- Every session write path (including the existing correction and undo RPCs)
-- shares package accounting. Usage is derived from live held rows, never a counter.
create function app_private.apply_session_package() returns trigger language plpgsql security definer set search_path='' as $$
declare v_package uuid;
begin
  perform 1 from public.students where owner_id=new.owner_id and id=new.student_id for update;
  if new.voided_at is not null or new.status <> 'held' then
    new.student_package_id := null;
    new.attendance_mark := case when new.status='no_show' then 'absent' else null end;
    return new;
  end if;
  if tg_op='UPDATE' and old.status='held' and old.voided_at is null and old.session_date=new.session_date then
    new.student_package_id := old.student_package_id;
    new.charge_rate_cents := old.charge_rate_cents;
    new.attendance_mark := coalesce(new.attendance_mark,'present');
    return new;
  end if;
  select p.id into v_package from public.student_packages p
    where p.owner_id=new.owner_id and p.student_id=new.student_id and p.start_date<=new.session_date
      and (p.end_date is null or p.end_date>=new.session_date)
      and (p.class_count is null or p.class_count > (select count(*) from public.sessions s where s.owner_id=p.owner_id and s.student_package_id=p.id and s.status='held' and s.voided_at is null and s.id<>new.id))
    order by p.end_date nulls last,p.start_date,p.id limit 1;
  new.student_package_id := v_package;
  if v_package is not null then new.charge_rate_cents := 0;
  elsif tg_op='UPDATE' and old.student_package_id is not null then
    select default_rate_cents into new.charge_rate_cents from public.students where owner_id=new.owner_id and id=new.student_id;
  end if;
  new.attendance_mark := case when new.attendance_mark='late' then 'late' else 'present' end;
  return new;
end $$;
revoke all on function app_private.apply_session_package() from public,anon,authenticated;
create trigger session_package before insert or update on public.sessions for each row execute function app_private.apply_session_package();

create function app_private.ui_command(p_key uuid,p_hash text,p_command jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=auth.uid(); v_op public.mutation_operations%rowtype;
  v_type text:=p_command->>'type'; v_id uuid; v_before jsonb; v_after jsonb;
  v_entity text; v_student public.students%rowtype; v_def public.package_definitions%rowtype;
  v_session public.sessions%rowtype; v_item jsonb; v_date date; v_status public.session_status;
  v_result jsonb; v_amount integer; v_count integer:=0;
begin
  v_op:=app_private.begin_operation(p_key,p_hash,'ui_'||coalesce(v_type,''),false);
  if v_op.state='completed' then return v_op.result; end if;
  if v_type in ('assignPackage','adjustBalance','toggleEnrolled') then
    select * into v_student from public.students where owner_id=v_owner and id=(p_command->>'studentId')::uuid for update;
    if not found or v_student.archived_at is not null then raise exception 'student_not_found'; end if;
  end if;
  if v_type='createPackage' then
    insert into public.package_definitions(owner_id,name,description,kind,class_count,price_cents,validity_weeks,archived)
      values(v_owner,p_command#>>'{definition,name}',coalesce(p_command#>>'{definition,description}',''),p_command#>>'{definition,kind}',(p_command#>>'{definition,classCount}')::integer,(p_command#>>'{definition,priceCents}')::integer,(p_command#>>'{definition,validityWeeks}')::integer,(p_command#>>'{definition,archived}')::boolean)
      returning id,to_jsonb(package_definitions.*) into v_id,v_after;
    v_entity:='package';
  elsif v_type='setPackageArchived' then
    select * into v_def from public.package_definitions where owner_id=v_owner and id=(p_command->>'packageId')::uuid for update;
    if not found then raise exception 'package_not_found'; end if;
    v_before:=to_jsonb(v_def);
    update public.package_definitions set archived=(p_command->>'archived')::boolean,version=version+1 where id=v_def.id
      returning id,to_jsonb(package_definitions.*) into v_id,v_after;
    v_entity:='package';
  elsif v_type='assignPackage' then
    select * into v_def from public.package_definitions where owner_id=v_owner and id=(p_command->>'packageId')::uuid and not archived for share;
    if not found then raise exception 'package_not_found'; end if;
    insert into public.student_packages(owner_id,student_id,package_id,name,kind,class_count,price_cents,start_date,end_date)
      values(v_owner,v_student.id,v_def.id,v_def.name,v_def.kind,v_def.class_count,v_def.price_cents,(p_command->>'startDate')::date,(p_command->>'endDate')::date)
      returning id,to_jsonb(student_packages.*) into v_id,v_after;
    if v_def.kind='time_based' and p_command->>'endDate' is null then raise exception 'invalid_expiry'; end if;
    insert into public.ledger_adjustments(owner_id,student_id,entry_date,amount_cents,reason,operation_id)
      values(v_owner,v_student.id,timezone('America/Barbados',now())::date,v_def.price_cents,'Package: '||v_def.name,v_op.id);
    v_entity:='package';
  elsif v_type='adjustBalance' then
    v_amount:=(p_command->>'deltaCents')::integer;
    if v_amount=0 then raise exception 'invalid_amount'; end if;
    insert into public.ledger_adjustments(owner_id,student_id,entry_date,amount_cents,reason,operation_id)
      values(v_owner,v_student.id,timezone('America/Barbados',now())::date,v_amount,p_command->>'reason',v_op.id)
      returning id,to_jsonb(ledger_adjustments.*) into v_id,v_after;
    v_entity:='adjustment';
  elsif v_type='toggleEnrolled' then
    if v_student.version<>(p_command->>'expectedVersion')::integer or p_command->>'expectedVersion' is null then raise exception 'stale_operation'; end if;
    v_before:=to_jsonb(v_student);
    update public.students set class_enrolled=(p_command->>'enrolled')::boolean,version=version+1,updated_at=now() where id=v_student.id
      returning id,to_jsonb(students.*) into v_id,v_after;
    v_entity:='student';
  elsif v_type='saveSchedule' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class_settings:'||v_owner::text,0));
    select to_jsonb(s.*) into v_before from public.class_settings s where owner_id=v_owner;
    if coalesce((v_before->>'version')::integer,0)<>coalesce((p_command->>'expectedVersion')::integer,-1) then raise exception 'stale_operation'; end if;
    insert into public.class_settings(owner_id,title,weekday,start_time,end_time) values(v_owner,p_command->>'title',(p_command->>'weekday')::integer,(p_command->>'start')::time,(p_command->>'end')::time)
      on conflict(owner_id) do update set title=excluded.title,weekday=excluded.weekday,start_time=excluded.start_time,end_time=excluded.end_time,version=public.class_settings.version+1
      returning owner_id,to_jsonb(class_settings.*) into v_id,v_after;
    v_entity:='class_settings';
  elsif v_type='attendance' then
    v_date:=(p_command->>'date')::date;
    if v_date is null or jsonb_typeof(p_command->'entries')<>'array' or jsonb_array_length(p_command->'entries') not between 1 and 250 then raise exception 'invalid_attendance'; end if;
    if (select count(distinct e->>'studentId') from jsonb_array_elements(p_command->'entries') e)<>jsonb_array_length(p_command->'entries') then raise exception 'duplicate_students'; end if;
    for v_item in select e from jsonb_array_elements(p_command->'entries') e order by e->>'studentId' loop
      select * into v_student from public.students where owner_id=v_owner and id=(v_item->>'studentId')::uuid and archived_at is null for update;
      if not found then raise exception 'student_not_found'; end if;
      if coalesce(v_item->>'mark','') not in ('present','late','absent') then raise exception 'invalid_mark'; end if;
      v_status:=case when v_item->>'mark'='absent' then 'no_show'::public.session_status else 'held'::public.session_status end;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':'||v_student.id::text||':'||v_date::text,0));
      select * into v_session from public.sessions where owner_id=v_owner and student_id=v_student.id and session_date=v_date and occurrence_number=1 and voided_at is null for update;
      v_before:=null;
      if found then
        if v_session.id is distinct from (v_item->>'sessionId')::uuid or v_session.version is distinct from (v_item->>'expectedVersion')::integer then raise exception 'stale_operation'; end if;
        v_before:=to_jsonb(v_session);
        update public.sessions set status=v_status,attendance_mark=v_item->>'mark',charge_rate_cents=case when v_status='held' then v_student.default_rate_cents end,version=version+1,updated_at=now(),manually_edited_at=now() where id=v_session.id returning * into v_session;
      else
        if v_item->>'sessionId' is not null then raise exception 'stale_operation'; end if;
        insert into public.sessions(owner_id,student_id,session_date,status,attendance_mark,charge_rate_cents,source,created_operation_id,manually_edited_at)
          values(v_owner,v_student.id,v_date,v_status,v_item->>'mark',case when v_status='held' then v_student.default_rate_cents end,'manual',v_op.id,now()) returning * into v_session;
      end if;
      insert into public.audit_events(owner_id,operation_id,entity_type,entity_id,action,before_state,after_state,entity_version)
        values(v_owner,v_op.id,'session',v_session.id,'attendance_recorded',v_before,to_jsonb(v_session),v_session.version);
      v_count:=v_count+1;
    end loop;
  else raise exception 'invalid_command';
  end if;
  if v_entity is not null then
    insert into public.audit_events(owner_id,operation_id,entity_type,entity_id,action,before_state,after_state,entity_version)
      values(v_owner,v_op.id,v_entity,v_id,v_type,v_before,v_after,(v_after->>'version')::integer);
  end if;
  v_result:=jsonb_build_object('operationId',v_op.id,'count',v_count,'committedAt',now());
  update public.mutation_operations set state='completed',result=v_result,completed_at=now() where id=v_op.id;
  return v_result;
end $$;
create function public.ui_command(p_key uuid,p_hash text,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.ui_command(p_key,p_hash,p_command) $$;
revoke all on function public.ui_command(uuid,text,jsonb),app_private.ui_command(uuid,text,jsonb) from public,anon;
grant execute on function public.ui_command(uuid,text,jsonb),app_private.ui_command(uuid,text,jsonb) to authenticated;

create function public.ui_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'packages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'kind',kind,'classCount',class_count,'priceCents',price_cents,'validityWeeks',validity_weeks,'archived',archived) order by name,id) from public.package_definitions),'[]'::jsonb),
 'studentPackages',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'studentId',p.student_id,'packageId',p.package_id,'name',p.name,'kind',p.kind,'classCount',p.class_count,'priceCents',p.price_cents,'startDate',p.start_date,'endDate',p.end_date,'used',(select count(*) from public.sessions s where s.student_package_id=p.id and s.status='held' and s.voided_at is null))) from public.student_packages p),'[]'::jsonb),
 'adjustments',coalesce((select jsonb_agg(to_jsonb(a)-'owner_id'-'operation_id') from public.ledger_adjustments a),'[]'::jsonb),
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'enrolled',class_enrolled,'version',version)) from public.students),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',id,'mark',attendance_mark,'packageId',student_package_id)) from public.sessions where voided_at is null),'[]'::jsonb),
 'schedule',(select jsonb_build_object('title',title,'weekday',weekday,'start',to_char(start_time,'HH24:MI'),'end',to_char(end_time,'HH24:MI'),'version',version) from public.class_settings)
) $$;
revoke all on function public.ui_snapshot() from public,anon;
grant execute on function public.ui_snapshot() to authenticated;

-- The original undo function predates package accounting. Prevent it from
-- reinterpreting old charges against a newly assigned package. These sessions
-- remain correctable through the versioned session editor with full audit.
alter function app_private.undo_operation(uuid,text,uuid) rename to undo_operation_before_packages;
revoke all on function app_private.undo_operation_before_packages(uuid,text,uuid) from public,anon,authenticated;
create function app_private.undo_operation(p_idempotency_key uuid,p_request_hash text,p_operation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if exists (
    select 1 from public.audit_events e where e.owner_id=auth.uid() and e.operation_id=p_operation_id and e.entity_type='session'
      and (e.before_state->>'attendance_mark'='late' or e.after_state->>'attendance_mark'='late' or exists(
        select 1 from public.student_packages p where p.owner_id=e.owner_id and p.student_id=coalesce((e.after_state->>'student_id')::uuid,(e.before_state->>'student_id')::uuid)
      ))
  ) then raise exception 'package_undo_requires_correction'; end if;
  return app_private.undo_operation_before_packages(p_idempotency_key,p_request_hash,p_operation_id);
end $$;
revoke all on function app_private.undo_operation(uuid,text,uuid) from public,anon;
grant execute on function app_private.undo_operation(uuid,text,uuid) to authenticated;
-- Rebind the SQL wrapper after the private implementation was renamed.
create or replace function public.undo_operation(p_idempotency_key uuid,p_request_hash text,p_operation_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app_private.undo_operation(p_idempotency_key,p_request_hash,p_operation_id) $$;
