# CodexGym Ledger — Development Progress Record

Last updated: 2026-08-05  
Repository: [AgentBim/CodexGym-Ledger](https://github.com/AgentBim/CodexGym-Ledger)  
Local workspace: `C:\Users\jahb2\OneDrive\Documents\Adult Gym Admin`  
Application version: `0.1.0`

## 1. Executive status

CodexGym Ledger has progressed from an artifact-style, device-local prototype to a real Next.js application backed by an approved Supabase database. The current working tree contains authenticated server-side reads, audited database mutations, a mobile-first ledger interface, recurring scheduling, balances, summaries, confirmation flows, and database-backed Undo.

The application is not deployed to Vercel. Deployment remains behind the coach's explicit approval gate.

Current release state:

| Area | Status | Notes |
| --- | --- | --- |
| Product requirements | Complete for MVP definition | Detailed in `docs/product-requirements.md` |
| Architecture and UX | Complete for current MVP | Standalone app selected; mobile-first workflow documented |
| Supabase schema | Applied | Two approved migrations are live |
| RLS and database security | Verified | RLS forced; anonymous access denied; direct writes revoked |
| Live frontend integration | Implemented | Production paths no longer use demo/mock data |
| Local quality gates | Passing | TypeScript, ESLint, 19 tests, and production build |
| Coach Auth account | Created and confirmed | Email/password provider and password hash are present |
| Authenticated browser E2E | Blocked | Supabase currently returns invalid credentials during the manual login attempt |
| Vercel Preview | Not approved or deployed | Requires separate explicit approval |
| Production deployment | Not approved or deployed | Requires validated Preview and separate promotion approval |
| Git publication | Incomplete | The current implementation is uncommitted; repository HEAD still contains only the initial commit |

## 2. Product purpose

The app supports adult gymnastics classes in Barbados where students pay per session, normally BBD $30.00. It is intentionally separate from the regular gymnast roster.

The app must answer four operational questions quickly:

1. Who attended a class?
2. Which sessions actually count as held sessions?
3. Who has paid, and by which method?
4. Who owes money or has a credit?

The primary operating context is one-handed phone use during class, followed by laptop review at the end of the day.

## 3. Core business rules implemented

### Students

- Name is required.
- The default rate is 3,000 BBD cents and supports per-student overrides.
- Notes are optional.
- Students are archived rather than permanently deleted.
- Archiving requires explicit confirmation.
- Archived students keep their sessions, payments, balances, operations, and audit history.

### Sessions

- Status is one of `scheduled`, `held`, `canceled`, or `no_show`.
- Past, current, and future Barbados dates are accepted.
- Only active `held` sessions contribute a charge.
- A held session snapshots its rate so later student-rate changes do not rewrite history.
- Voiding removes an entry from active calculations without destroying the row.

### Payments

- Amounts are stored as positive integer cents.
- Methods are `cash`, `transfer`, or `other`.
- Payments support past, current, and future dates.
- Corrections use void/replacement semantics rather than rewriting financial history.

### Balances

```text
balance = sum(active held-session charges) - sum(active payments)
```

- Positive: the student owes money.
- Zero: settled.
- Negative: credit.
- Overdue: a positive balance includes an unpaid held charge before today in Barbados.
- Credits are shown separately and are not invisibly netted against another student's debt.

### Recurrence

- Weekly templates generate bounded future `scheduled` sessions.
- Generation is idempotent.
- Existing manually edited or non-scheduled occurrences are not silently overwritten.

### Confirmation and Undo

- Destructive actions use archive or void semantics and require confirmation.
- Mutations create operation and audit records.
- Undo is available for ten minutes, is authorized on the server, and does not erase audit history.
- Undo rejects expired operations and changes that have become stale because of later edits.

## 4. Architecture decisions

### Standalone application

The ledger is a standalone application rather than a module inside the regular gymnast system. This keeps financial history, access control, deployment, and failure domains separate.

### Runtime stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| UI | Next.js 16 App Router, React 19, TypeScript | Mobile-first screens and server-rendered routes |
| Validation | Zod 4 | Server mutation input validation |
| Auth | Supabase Auth | Single confirmed coach account |
| Database | Supabase Postgres 17 | Ledger, audit history, RLS, atomic RPCs |
| Hosting target | Vercel | Stateless Next.js runtime; not deployed yet |
| Tests | Vitest, Testing Library, jsdom | Domain, validation, and component coverage |

### Data flow

1. An unauthenticated request is redirected to `/login`.
2. The login Server Action calls Supabase email/password authentication.
3. The protected root route verifies the session with `auth.getUser()`.
4. The server loads owner-scoped students, sessions, payments, templates, audit events, and daily review data.
5. The server derives balances, overdue state, period totals, and recap data.
6. Client quick-entry dialogs call validated Server Actions.
7. Server Actions call audited Postgres RPCs with idempotency keys.
8. Successful mutations refresh the server-rendered data and expose the operation-level Undo action.

Browser-local storage is not the source of truth.

## 5. Database implementation

### Target

- Supabase project reference: `mevsairosejypqqtfnum`
- Project region: Canada Central
- Postgres version observed during setup: 17.6
- Initial reviewed migration SHA-256: `2EF6ACB8B20C6746B4F399E8E6DA04922CE3A1516BA639FC3687A857CA4E3D27`

### Applied migrations

1. `20260804055004_initial_gym_ledger_schema.sql`
2. `20260804055140_cover_composite_foreign_keys.sql`

The second migration adds composite foreign-key coverage indexes identified by the Supabase Performance Advisor.

### Tables

| Table | Purpose |
| --- | --- |
| `students` | Active/archived roster, default rate, notes, version |
| `sessions` | Dated status, rate snapshot, recurrence origin, void metadata |
| `payments` | Dated amount, method, notes, void/replacement history |
| `recurring_session_templates` | Weekly recurrence definition and lifecycle |
| `mutation_operations` | Idempotency, request hash, completion, Undo window |
| `audit_events` | Append-only before/after mutation record |
| `daily_reviews` | End-of-day review marker and version |

### Public mutation RPCs

- `log_payment`
- `bulk_mark_attended`
- `materialize_recurring_sessions`
- `undo_operation`
- `save_student`
- `save_template`
- `save_session`
- `correct_payment`
- `mark_daily_reviewed`

Internal transaction logic lives in the non-exposed `app_private` schema. Public functions are narrow authenticated wrappers.

### Security posture

- RLS is enabled and forced on all seven public tables.
- Every public-table policy is owner-scoped with `auth.uid()`.
- There are no anonymous data policies.
- Anonymous table privileges are revoked.
- Authenticated users have owner-scoped reads but no direct inserts, updates, or deletes.
- Writes go through audited RPCs.
- Function execution is revoked from `PUBLIC` and `anon` and explicitly granted to `authenticated` only.
- `rls_auto_enable()` is not publicly executable.
- No service-role or secret key is present in the application runtime.
- Generated browser/server code uses only the Supabase project URL and publishable key.

### Database verification completed

- Migration history contains both applied migrations.
- All seven tables were confirmed present.
- All ledger tables were empty after migration and rollback-based testing.
- Security Advisor returned no findings.
- Performance Advisor's missing composite foreign-key index findings were resolved.
- Anonymous student reads were denied.
- Authenticated owner reads were allowed.
- Authenticated direct table inserts were denied.
- Public mutation RPC execution was denied to anonymous users and allowed to authenticated users.
- A transaction-rolled-back two-owner test confirmed cross-owner isolation.

No destructive production rollback was performed. Future database changes must be forward-only and require new migration approval.

## 6. Application implementation

### Authentication

- `/login` is the public entry route.
- `/` is protected and redirects signed-out users to `/login`.
- Public sign-up is not offered by the application.
- Sign-out clears the local Supabase session and redirects to `/login`.
- Failed login keeps the submitted email, clears the password, and shows a prominent error.

### Dashboard and mobile navigation

The main app uses four mobile-first areas:

- **Today:** current students, today's status, quick session/payment actions, and bulk attendance.
- **Students:** add, edit, archive, search, and balance filtering.
- **Activity:** end-of-day recap, period totals, warnings, and review marker.
- **More:** recurring templates and sign-out.

### Implemented workflows

- Add student with default or overridden rate.
- Edit a student's name, rate, and notes.
- Archive a student after confirmation.
- Log an individual session for any active student and any valid date.
- Select all four session statuses.
- Log a payment with amount, method, and date.
- Bulk mark selected students attended for a date.
- Create a weekly recurring template and materialize sessions.
- Search students by name.
- Filter students by balance state.
- Display owed, overdue, settled, and credit states with text and icons.
- Display monthly/period collected, owed, credit, and attendance totals.
- Display end-of-day held, no-show, scheduled, and collection recap.
- Mark a day reviewed.
- Undo a recently committed database operation.
- Display an explicit empty-ledger state with no demo records.

### Demo and test data policy

- The application does not insert demo students, sessions, or payments.
- The approved database started with zero ledger rows.
- A test student can be removed from the active roster through confirmed archiving.
- Test sessions/payments should be voided or undone so they stop affecting active balances while audit history remains intact.
- A bulk hard-delete or database-reset control is intentionally not implemented because the product requirement forbids permanent destruction of ledger history.
- If a dedicated test-data cleanup workflow is later required, it should be an audited bulk archive/void operation with a typed confirmation, not raw deletion.

## 7. Important implementation files

| File | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Protected root route and live dashboard load |
| `src/app/login/page.tsx` | Signed-out login route |
| `src/components/login-form.tsx` | Login form and action state |
| `src/components/adult-admin-app.tsx` | Mobile application shell and dialogs |
| `src/actions/auth.ts` | Sign-in and sign-out Server Actions |
| `src/actions/ledger.ts` | Validated ledger Server Actions and RPC calls |
| `src/lib/ledger/load-dashboard.ts` | Owner-scoped parallel database reads and summaries |
| `src/lib/ledger/to-admin-read-model.ts` | Server dashboard to UI read-model mapping |
| `src/lib/validation/mutations.ts` | Mutation schemas and cross-field rules |
| `src/lib/supabase/server.ts` | Cookie-scoped server Supabase client |
| `src/lib/supabase/proxy.ts` | Session refresh, CSP, and response headers |
| `src/lib/supabase/database.types.ts` | Generated live database types plus compatibility aliases |
| `supabase/migrations/` | Applied schema and index migrations |

## 8. Quality and verification evidence

The most recent full local verification completed successfully after the login UX fixes:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass with zero warnings |
| `pnpm test` | Pass: 4 files, 19 tests |
| `pnpm build` | Pass: Next.js optimized production build |
| `git diff --check` | Pass at the last full review |
| Signed-out runtime check | Pass: `/` redirects to `/login` |
| Login-page browser check | Pass: page renders without console errors after fixes |
| Authenticated dashboard E2E | Not complete |

### Automated coverage

- Held-only charges and void exclusion.
- Owed versus overdue behavior.
- Oldest-charge-first aging display logic.
- Period collections, owed totals, and separate credit totals.
- Default BBD $30 rate and invalid negative amounts.
- Student, template, session, payment, bulk attendance, daily review, and Undo validation contracts.
- Empty ledger with no demo people.
- Bulk attendance dialog and database-backed Undo invocation.
- Student add/edit/archive confirmation.
- Recurring-template creation.
- Individual session logging.
- Dialog labels, Escape handling, and initial focus.

### Remaining test gaps

- Successful authenticated login through to the empty dashboard.
- Real mutation smoke test using the coach's authenticated browser session.
- Payment correction/void and existing-session/template edit screens.
- Two-device concurrent edit behavior.
- Retry behavior during network interruption.
- Expired/repeated/stale Undo envelopes in an integrated UI run.
- 320px viewport, 200% zoom, safe-area, focus trap/restoration, and automated accessibility scan.
- Full recurrence boundary and concurrent generation integration tests.

## 9. Live-testing defects found and fixed

### Runtime crash after login page load

**Symptom:** production runtime displayed a generic server error and development runtime showed a blank page.

**Cause:** `src/actions/auth.ts` was a `"use server"` module that exported a plain `initialSignInState` object. Next.js Server Action modules may export only async functions at runtime.

**Fix:** moved the initial state object into the client login component and retained only async runtime exports plus erased TypeScript types in the Server Action module.

**Verification:** login page rendered normally; TypeScript and ESLint passed.

### Login appeared to do nothing

**Symptom:** submitting credentials cleared both fields and appeared not to navigate.

**Cause:** Supabase returned an invalid-credentials response, while the uncontrolled form reset and the existing error styling was easy to overlook.

**Fix:** the action now returns the submitted email on failure, the client preserves it, only the password clears, and the error uses a prominent bordered alert treatment.

**Verification:** the browser DOM showed the preserved email and visible authentication error; TypeScript, ESLint, and all 19 tests passed.

### Localhost connection refused

**Symptom:** `127.0.0.1:3210` returned `ERR_CONNECTION_REFUSED` after a testing pause.

**Cause:** the local development server is a temporary process and had stopped. This did not affect Supabase or stored data.

**Resolution:** restart with `pnpm dev -p 3210`. A Vercel deployment will remove the need to keep a local process running.

## 10. Current blocker: manual authentication

The Supabase project currently contains exactly one confirmed, non-anonymous email-provider user with a configured password hash. Manual attempts through the app have received Supabase's invalid-credentials response. No password or secret was inspected or stored by the development process.

Recommended resolution:

1. In Supabase Dashboard, open **Authentication → Users**.
2. Select the coach account.
3. Reset or replace the password using the dashboard's supported account-management flow.
4. Restart the local app with `pnpm dev -p 3210`.
5. Sign in at `http://127.0.0.1:3210/login`.
6. Verify the empty dashboard, sign-out, and sign-in again.
7. Run one controlled student/session/payment/Undo flow before using real data.

Do not place the password in chat, source files, environment files, logs, or Git.

## 11. Source-control status

The GitHub repository exists, but the current implementation has not been committed or pushed.

- Current HEAD: `29e6a27 Initial adult gymnastics ledger app`
- Working tree: contains the live Supabase integration, applied migration files, authentication, UI workflows, tests, and documentation as uncommitted changes.
- The obsolete `draft_initial_schema.sql` is removed and replaced by the two timestamped migrations.
- `.env.local` contains local publishable configuration and is ignored.
- No service-role key should ever be committed.

Before publishing:

1. Re-run all four quality commands.
2. Inspect the complete diff and secret scan.
3. Confirm the migration files match live migration history.
4. Commit the intentional files only.
5. Push to `AgentBim/CodexGym-Ledger`.
6. Require GitHub CI to pass on the exact pushed commit.

## 12. Release and approval gates

Approval for one gate does not authorize another.

### Gate 1: database migrations

The initial migration gate was approved and completed for project `mevsairosejypqqtfnum`. Any new schema revision requires a new target-specific approval before application.

### Gate 2: Vercel Preview

Not approved. Before requesting approval:

- resolve successful coach login;
- complete authenticated smoke tests;
- commit and push the reviewed changes;
- obtain green GitHub CI;
- configure only the project URL, publishable key, and `America/Barbados` timezone;
- verify Preview does not use privileged credentials.

### Gate 3: production promotion

Not approved. Production promotion requires a validated immutable Preview, backup/restore expectations, a rollback plan, final Supabase advisors, mobile/accessibility checks, and explicit approval naming the Preview deployment.

## 13. Recommended next actions

Priority order:

1. Resolve the coach password and complete successful login.
2. Verify the empty live dashboard and browser console.
3. Create a controlled test student.
4. Log a held session and verify a BBD $30 owed balance.
5. Log a payment and verify settlement or credit behavior.
6. Use Undo and confirm the active totals reverse without deleting history.
7. Archive/void the controlled test data.
8. Run the mobile viewport and accessibility checks.
9. Re-run TypeScript, lint, all tests, production build, and diff/secret checks.
10. Commit and push the reviewed working tree.
11. Request explicit Vercel Preview approval.

## 14. Non-negotiable constraints

- Never hard-delete real student, attendance, payment, template, operation, or audit history through the product UI.
- Never expose a Supabase service-role key, secret key, database password, or Vercel token to the browser.
- Never authorize rows using user-editable metadata.
- Never bypass RLS to fix an application permission error.
- Never apply a new database migration without explicit target-specific confirmation.
- Never deploy or promote to Vercel without the applicable explicit confirmation.
- Never show a successful mutation before the database commit is confirmed.
- Never treat browser-local data as the authoritative ledger.

## 15. Related documentation

- `README.md` — setup and release controls
- `docs/product-requirements.md` — MVP scope, rules, and acceptance criteria
- `docs/architecture.md` — system and database design
- `docs/ux-spec.md` — mobile workflows and interface guidance
- `docs/qa-report.md` — executable verification evidence
- `docs/deployment-runbook.md` — approval gates, rollout, rollback, and monitoring
- `security_best_practices_report.md` — original security review and resolution status

## 16. 2026-08-13 authentication and UX update

This section supersedes the earlier authentication blocker and next-action list.

### Authentication resolved

- The coach password was reset through Supabase Auth and successful sign-in was confirmed at `http://127.0.0.1:3210`.
- Authenticated ledger flows were exercised against the live Supabase project.
- Recovery links that arrive at `/?code=...` are now forwarded to the callback route, and callback redirects preserve the request host so `127.0.0.1` cookies are not lost to `localhost`.
- Invalid or expired recovery codes land on the explicit Auth error page.

### Authenticated verification data

The controlled verification run created an archived student named `Codex E2E Test`, two sessions, one recurring template, one daily review, and audit/operation history. Its payment was undone and is no longer live. This history remains intentionally preserved because production records are soft-deleted or voided, never generically hard-deleted.

### Migration-free mobile safety slice completed

- Quick Pay now carries the tapped student into the payment sheet instead of silently defaulting to the first roster entry.
- The suggested payment amount uses the student's positive amount owed; otherwise it uses that student's default rate.
- Every Today student row has a 44px-or-larger contextual Pay target.
- The overdue alert opens the active roster already filtered to overdue balances.
- Empty Today and empty active-roster states provide a direct Add student action.
- Active and Archived roster tabs expose preserved archived students, with audited restore through the existing `save_student` RPC.
- Archived students are excluded from new attendance, payment, and recurrence quick actions.
- The period recap now includes total collected as well as owed, credit, and attendance.
- The ordinary owed-balance CSS selector is corrected, textarea focus/font behavior matches other controls, mutation notices render above sheets, and the Undo toast is stacked above the mobile sticky action.

No database migration or deployment was performed for this slice.

### Current quality evidence

- TypeScript: pass
- ESLint with zero warnings: pass
- Vitest: 4 files, 22 tests pass
- Next.js 16.2.12 production build: pass
- Browser automation CLI was not installed in this environment, so the new slice still needs a final visual pass in the already-authenticated in-app browser at narrow and desktop widths.

### Recommended next feature slice

Build **Review & Correct a Day** without changing the schema: make Activity date-selectable, expose that day's session/payment entries, and connect Manage actions to the existing versioned `saveSession` and `correctPayment` server actions for confirmed edits/voids. Include inline dialog errors, focus trapping/restoration, and URL-backed view/date state. After that, add recurring-template edit/pause/archive UI; intuitive reconciliation of already-generated future sessions should remain behind a separately approved migration.
