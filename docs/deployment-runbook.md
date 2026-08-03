# Deployment runbook

## Release status

**Status: NOT READY / DO NOT DEPLOY.** As of 2026-07-31:

- The UI is an unauthenticated in-memory prototype and is not connected to the server/Supabase contract (SEC-001).
- Audited RPC coverage is incomplete for student, individual session, correction/void, template, and daily-review mutations (SEC-002).
- The draft SQL, RLS, privileged functions, and concurrency behavior have never been executed or verified (SEC-003).
- Sign-in, enrollment restriction, and protected-route behavior are incomplete (SEC-004).
- Dependency links are damaged/partial, so lint, typecheck, tests, and production build have not passed.

Passing CI alone does not clear the product, security, database, accessibility, or deployment gates.

## Confirmation gates

The coach must give three separate explicit confirmations. Approval of one does not imply another:

1. **Database migration gate:** “Approve creating and applying the reviewed migration to `<local/preview project name>`.” This permits creating a timestamped migration through the Supabase CLI and applying it only to the named target. Production requires its own target-specific approval.
2. **Preview deployment gate:** “Approve deploying this reviewed commit to Vercel Preview using `<preview Supabase project>`.” This permits linking/configuring the named Vercel project and creating one preview deployment; it does not permit production promotion.
3. **Production promotion gate:** “Approve promoting validated preview `<deployment URL/ID>` to production.” This is allowed only after the migration, smoke, security, E2E/accessibility, backup, and rollback evidence below is green.

Any schema revision after approval returns to gate 1. Any code/config/environment change after preview validation requires a new preview or documented revalidation before gate 3.

## 1. Repair dependencies and establish a green build

Use Node.js 24 and pnpm 11.9.0 (declared in `package.json`). The current virtual store is incomplete. In a network-enabled environment:

1. Preserve `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`; do not regenerate or loosen versions to bypass the failure.
2. Inspect `pnpm-workspace.yaml`. Native scripts are denied. Do not broadly run `pnpm approve-builds` or enable all scripts.
3. Run `pnpm install --frozen-lockfile` to reconstruct links from the exact lockfile. If a package proves it needs an install script for build/runtime, review that package/version and approve only that named package in a separate change.
4. Run, and retain logs for, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` independently.
5. Require the GitHub Quality workflow to pass on the exact release commit. It installs frozen dependencies and performs checks only; it cannot migrate or deploy.

Failure of any command returns to engineering/QA. Do not waive or replace a missing build with source inspection.

## 2. Environment configuration

Required application variables in Development, Preview, and Production:

| Variable | Scope | Rule |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server | Environment-specific Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server | Matching publishable key; RLS is mandatory |
| `APP_TIME_ZONE` | Server | Exactly `America/Barbados` |

Never configure `SUPABASE_SERVICE_ROLE_KEY`, a Supabase secret key, database password/URL, or Vercel CLI token in the app runtime. `NEXT_PUBLIC_*` values are included in browser bundles and must never contain secrets.

Use a separate Supabase project for preview so preview builds cannot read production students or financial records. Scope Vercel variables per environment; use branch overrides if necessary. Local values belong in `.env.local`, which is ignored. `vercel env pull` overwrites its destination, so preserve custom local-only values separately before pulling.

Before each deploy, compare variable names (not secret values) with `.env.example`, verify project URL/key pairing, confirm no production URL appears in Preview, and scan build output/client bundles for forbidden secret names.

## 3. Database migration approval procedure

Do not run this section without gate-1 confirmation naming the target.

1. Review `supabase/migrations/draft_initial_schema.sql` with backend/security owners. Complete all missing audited RPCs and revoke direct writes so every mutation fails closed outside its contract.
2. Confirm the target is local/preview, record its project reference, current schema version, backup/PITR capability, and a pre-change restore point.
3. Check the installed Supabase CLI with `supabase --version` and discover exact commands with `supabase --help` / subgroup `--help`; do not assume flags.
4. Create the real migration with `supabase migration new <descriptive_name>`. Copy the reviewed SQL into the CLI-created timestamped file; never rename the draft into an invented timestamp.
5. Apply locally first. Verify schema objects, constraints, grants, indexes, function ownership/search paths, and the migration list. Never test authorization as `postgres` or service role alone.
6. Run Supabase database and security advisors. Resolve every security error and document any accepted performance warning before remote application.
7. Execute integration tests with two distinct genuine authenticated JWT users plus an unauthenticated client:
   - anon denial and cross-owner denial for select/insert/update/delete and every RPC;
   - owner ID cannot be reassigned; direct ledger/audit writes fail;
   - only active held sessions charge; rate snapshots remain historical; voids preserve history;
   - same idempotency key/hash replays the original result; a different hash conflicts;
   - concurrent bulk/recurrence calls do not duplicate sessions; locks are acquired deterministically;
   - undo succeeds once within ten minutes, replays safely, and rejects expiry or later-version changes;
   - recurrence boundaries/year changes, Barbados dates, report reconciliation, archived students, owed and credit totals.
8. Review test/advisor evidence and the generated migration diff. Request separate approval before applying to a remote preview or production database.

Schema rollback is forward-only and data-preserving. After real ledger data exists, never roll back by dropping students, sessions, payments, operations, or audit tables. Prepare a compensating migration and preserve compatible application behavior.

## 4. Preview deployment

Do not run this section without gate-2 confirmation.

1. Require a green exact-commit CI result and closure of SEC-001 through SEC-004.
2. Confirm Preview uses the migrated preview Supabase project and contains no production credentials/data.
3. Link the intended Vercel project, inspect settings, and pull Preview environment metadata. Do not commit `.vercel` or pulled `.env.local`.
4. Prefer an immutable preview artifact. Build with pinned tooling, inspect the result, then create a Preview deployment. Record deployment URL/ID, commit SHA, build duration, framework/runtime, and environment target.
5. Do not promote automatically. Git integration, if enabled, must still leave production promotion manual while these gates apply.

## 5. Preview smoke, security, and UX tests

Test from a phone-sized viewport (including 320px), desktop, and two real devices/accounts where relevant:

- Signed-out routes reveal no app/student data; invalid login fails; public signup is disabled; sign-out/revocation works.
- Add/edit/archive student; past/future session statuses; only held accrues; payment and correction; balance/credit/overdue labels.
- Bulk attendance mixed-status conflicts and retry idempotency; recurring generation; search/filter; summary reconciliation; end-of-day review.
- Confirmation appears before archive/void/destructive scope changes; Undo is server-authorized, expires, rejects stale edits, and survives cross-device refresh.
- Network failure retains form values and retry does not duplicate; phone/laptop concurrent edits surface conflict.
- Keyboard navigation, focus trap/restore, Escape behavior, screen-reader labels, non-color status, 200% zoom, safe-area layout, and no horizontal scroll.
- CSP has a per-request nonce, authenticated responses are private/no-store, browser console has no CSP/auth errors, and response security headers are present.
- No service-role/secret/database credential appears in HTML, JavaScript, source maps, network responses, or logs.

Run a final Supabase advisor scan after the preview test data/actions and inspect Vercel function/build logs for errors. Remove or clearly isolate test data without destroying audit evidence.

## 6. Production promotion

Do not run this section without gate-3 confirmation naming the validated preview URL/ID.

1. Freeze the release commit and preview artifact. Confirm no changes occurred after smoke testing.
2. Verify a production backup/restore point, production migration approval/evidence, environment-variable pairing, custom-domain/TLS settings, and an available known-good Vercel deployment.
3. Apply the approved production migration before promotion only when the new application remains backward-compatible during the interval. Verify migrations/advisors and a minimal read/write/undo check with a controlled account.
4. Promote the already validated preview artifact rather than rebuilding different code.
5. Immediately repeat sign-in, protected-route, student read, one controlled mutation/undo, balance, and recap smoke tests.

Record a deployment result containing URL, production target, READY/ERROR status, commit SHA, framework, build duration, migration version, approver, and timestamps.

## 7. Rollback

Application rollback and database remediation are separate:

- **Application:** if authentication, integrity, or availability smoke tests fail, immediately repoint production to the last known-good Vercel deployment. Record the failed deployment ID and preserve logs.
- **Database:** do not down-migrate by dropping financial/audit data. Disable affected writes if necessary, deploy compatible application code, then use a reviewed forward-only compensating migration. Restore from backup only for confirmed corruption and only under a documented incident decision.
- Re-run smoke tests after rollback. A rollback does not erase the incident; reconcile any operations accepted during the affected interval.

## 8. Observability and first-day watch

- Keep application logs structured and redacted: operation ID, route/RPC, result code, duration, and request correlation only. Do not log names, notes, payment details, JWTs, cookies, keys, or raw request bodies.
- Monitor Vercel build/function failures, elevated 4xx/5xx, latency, and CSP violations; inspect Supabase Auth/database logs, advisor findings, connection pressure, slow queries, lock waits, deadlocks, and failed RPCs.
- Alert on repeated idempotency conflicts, partial bulk results, undo failures, unauthorized access attempts, and summary reconciliation differences without including student data in alert payloads.
- During the first production day, review logs immediately after promotion, after the first real class entry, and at end-of-day recap. Confirm backups and document restore ownership/contact.

## Release evidence checklist

- [ ] SEC-001 through SEC-004 closed and re-reviewed.
- [ ] Frozen install, lint, typecheck, tests, and production build green on exact commit.
- [ ] Frontend uses authenticated persisted server actions; no mock adapter in production paths.
- [ ] All mutations are audited/owner-scoped/idempotent; direct writes fail closed.
- [ ] Migration explicitly approved for named target, generated by CLI, reviewed, and recorded.
- [ ] RLS/RPC tests with distinct JWT users and advisors green.
- [ ] Preview explicitly approved, deployed against isolated preview data, and smoke/E2E/accessibility tests green.
- [ ] Backup, forward-only database recovery, Vercel rollback, and observability verified.
- [ ] Production promotion explicitly approved for the exact validated preview artifact.
