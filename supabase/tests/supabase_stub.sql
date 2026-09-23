-- Minimal stand-ins for the Supabase pieces the draft schema depends on (roles,
-- auth.users, auth.uid()). For throwaway test databases only; auth.uid() reads
-- the request.jwt.claim.sub setting that the tests set per simulated user.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
