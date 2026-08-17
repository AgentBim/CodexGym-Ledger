# Developing ChalkTab

This guide is the day-to-day reference for developing ChalkTab. ChalkTab is a mobile-first Next.js application for managing adult gymnastics attendance, recurring classes, student balances, and BBD payments.

## Technology

- Next.js 16 App Router and React 19
- TypeScript
- Supabase Auth and Postgres
- Zod validation
- Vitest and Testing Library
- Vercel hosting
- pnpm 11.9.0

The GitHub repository is [AgentBim/CodexGym-Ledger](https://github.com/AgentBim/CodexGym-Ledger).

## Local setup

Requirements:

- Node.js 24 or a compatible version satisfying `>=20.9.0`
- Corepack
- pnpm 11.9.0
- A non-production Supabase project for development

Install and start the app:

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Configure `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
APP_TIME_ZONE=America/Barbados
```

Never use a Supabase service-role key in the application runtime or expose one through a `NEXT_PUBLIC_` variable. Preview and local development should use a separate Supabase project where possible.

## Project structure

```text
src/
  actions/          Authenticated server mutations
  app/              Next.js routes, layout, and global styles
  components/       Client UI and component tests
  lib/domain/       Pure ledger calculations and tests
  lib/ledger/       Dashboard loading and UI read-model mapping
  lib/supabase/     Browser/server clients and generated database types
  lib/validation/   Zod mutation and domain validation
supabase/
  migrations/       Additive, reviewed database migrations
docs/               Product, architecture, QA, deployment, and rollback records
```

The main data path is:

```text
Supabase tables → loadLedgerDashboard → toAdultAdminReadModel → AdultAdminApp
```

Client components do not write directly to ledger tables. Mutations pass through validated server actions and owner-scoped, versioned Supabase RPCs.

## Development principles

### Ledger integrity

- Treat payments and corrections as immutable accounting records.
- Correct a payment by voiding it with a reason and optionally creating a replacement.
- Edit sessions through versioned operations with optimistic conflict checks.
- Never delete corrected payments, generated sessions, audit events, or user data.
- Show users the resulting balance before consequential ledger changes.

### Database safety

- Keep every read and write owner-scoped.
- Keep Row Level Security enabled on exposed tables.
- Do not grant authenticated clients direct insert, update, or delete privileges on ledger tables.
- Prefer private `SECURITY DEFINER` mutation functions with public `SECURITY INVOKER` wrappers.
- Make migrations additive and backward-compatible during staged releases.
- Do not remove or rename an existing RPC until all deployed clients have stopped using it.

### UX conventions

- Design mobile-first and verify keyboard operation.
- Keep the most common card action visible; place secondary actions in an accessible overflow menu.
- Keep validation errors inside the form that caused them and retain entered values.
- Use contextual success notices that name the completed action.
- Put shareable navigation state—activity tabs, dates, and filters—in the URL.
- Derive onboarding and operational insights from real ledger data.

### Dates and money

- Business dates use `America/Barbados`.
- Store and compare ledger dates as ISO `YYYY-MM-DD` values.
- Store monetary amounts as integer cents.
- Display currency as BBD.

## Making a change

1. Start from the appropriate verified commit and create a `codex/` feature branch.
2. Inspect the affected read model, validation schema, server action, RPC, UI, and tests.
3. Add or update tests with the implementation.
4. For schema changes, add a timestamped migration under `supabase/migrations/`.
5. Regenerate `src/lib/supabase/database.types.ts` after applying a database migration.
6. Run all quality checks.
7. Create and smoke-test a Vercel preview before production promotion.
8. Record deployment and rollback identifiers in `docs/ux-release-rollbacks.md`.

Do not rewrite shared branch history or hard-reset a shared branch to perform a rollback.

## Quality checks

All checks must pass independently:

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

When changing database behavior, also verify:

- Supabase security advisors
- Supabase performance advisors
- Owner isolation and RLS behavior
- Authenticated clients still lack direct ledger-table writes
- Version conflicts reject the entire operation without partial writes

When changing UI behavior, test:

- Desktop and narrow mobile layouts
- Keyboard navigation and focus behavior
- Empty, loading, success, validation-error, conflict, and retry states
- URL navigation and browser back/forward behavior
- Payment correction and session balance previews

## Supabase migrations

Use a development or preview project first. Apply DDL through the Supabase migration workflow rather than running undocumented dashboard SQL.

After applying a migration:

1. Confirm the migration appears in project history.
2. Regenerate TypeScript database types.
3. Run security and performance advisors.
4. Test owner isolation and function grants.
5. Verify baseline application code can still operate when the migration is intended to be backward-compatible.

Production database rollback normally means disabling use of new additive RPCs and deploying compatible earlier code. Do not reverse legitimate ledger entries. Use a separately reviewed compensating migration only when necessary.

## Vercel previews and production

The Vercel project is `chalktab`. The production alias is [chalktab.vercel.app](https://chalktab.vercel.app).

Before production promotion:

- Ensure the working tree contains only intended changes.
- Run the full quality suite.
- Create a preview deployment.
- Verify authentication routing and the changed user workflow.
- Record the preview deployment ID and immutable URL.
- Confirm the previous production deployment remains available for rollback.

Vercel Deployment Protection may redirect unauthenticated preview checks to Vercel login. Use an authenticated or temporary share URL for full preview verification.

## Rollback

The immutable UX baseline is:

- Commit: `a7c1242`
- Tag: `chalktab-ux-baseline-a7c1242`
- Deployment: `dpl_8CqGT67zGkssQSYq6vZJGfNzccF6`

Rollback order:

1. Reassign the production alias to the previous READY deployment for an isolated UI defect.
2. Reassign it to the immutable baseline deployment for release dissatisfaction.
3. Create a new branch from the desired verified commit for code rollback.
4. Deploy compatible earlier code to stop using additive RPCs if a database feature is defective.

See [docs/ux-release-rollbacks.md](docs/ux-release-rollbacks.md) for deployment identifiers and [docs/deployment-runbook.md](docs/deployment-runbook.md) for detailed operational procedures.

## Related documentation

- [Architecture](docs/architecture.md)
- [Product requirements](docs/product-requirements.md)
- [UX specification](docs/ux-spec.md)
- [QA report](docs/qa-report.md)
- [Development progress](docs/development-progress.md)
- [Deployment runbook](docs/deployment-runbook.md)
- [UX release rollbacks](docs/ux-release-rollbacks.md)
