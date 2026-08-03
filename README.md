# Adult Gym Admin

Mobile-first Next.js app for adult gymnastics attendance and per-session BBD payments, backed by Supabase and intended for Vercel.

## Current status

This repository is **not release-ready**. The UI still uses an in-memory demo adapter, several audited mutation RPCs are incomplete, the SQL is an unapplied draft, and the executable QA suite is blocked until dependencies are repaired. Do not enter real student/payment data or deploy this build.

## Local setup

Prerequisites: Node.js 24, Corepack, and pnpm 11.9.0.

1. Copy `.env.example` to `.env.local` and replace its placeholders with a non-production Supabase project URL and publishable key. Never add a service-role/secret key.
2. Run `corepack enable`, then `corepack prepare pnpm@11.9.0 --activate` if that pnpm version is unavailable.
3. Run `pnpm install --frozen-lockfile`. Package scripts are denied by `pnpm-workspace.yaml`; do not approve native scripts without a reviewed, narrowly scoped reason.
4. Run `pnpm dev`.

If the current partial `node_modules` cannot link packages, follow the dependency-repair procedure in [docs/deployment-runbook.md](docs/deployment-runbook.md) rather than modifying the lockfile ad hoc.

## Quality checks

Run these independently and require all to pass:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI performs the same checks with a frozen lockfile. It never applies migrations or deploys.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL; public by design.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key protected by RLS; never substitute a service-role/secret key.
- `APP_TIME_ZONE`: `America/Barbados`.

Use separate Supabase projects/keys for preview and production. `.env.local`, `.vercel`, and Supabase CLI temporary state are ignored.

## Release controls

No database migration has been approved or applied. The proposal at `supabase/migrations/draft_initial_schema.sql` is deliberately non-timestamped. Database migration, preview deployment, and production promotion each require separate explicit confirmation. See [docs/deployment-runbook.md](docs/deployment-runbook.md) for evidence and rollback requirements.
