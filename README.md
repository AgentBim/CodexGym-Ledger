# ChalkTab

Mobile-first Next.js app for adult gymnastics attendance and per-session BBD payments, backed by Supabase and intended for Vercel.

For the complete implementation history, current status, verified evidence, known issues, and next actions, see [docs/development-progress.md](docs/development-progress.md).

## Current status

The Supabase schema and audited mutation contract are applied, and the UI reads and mutates centrally stored data through authenticated server code. Hardcoded demo people have been removed; a new account starts with an empty ledger. The production app is live at [chalktab.vercel.app](https://chalktab.vercel.app).

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

The approved database migrations are timestamped under `supabase/migrations/` and recorded in the target project. Future schema changes and production promotions require explicit review. See [docs/deployment-runbook.md](docs/deployment-runbook.md) for evidence and rollback requirements.
