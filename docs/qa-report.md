# QA Report — Adult Gym Admin

Date: 2026-08-13
Environment: Windows workspace, Node.js 24.15.0, pnpm 11.9.0

## Executive result

The executable quality gate is **passing**. Dependency links are present, lint and TypeScript complete without errors, all 22 unit/component tests pass, and Next.js produces an optimized production build. The UI now uses authenticated Supabase reads and audited server mutations; a new account starts with no demo data.

The two approved migrations were applied to Supabase project `mevsairosejypqqtfnum` and verified with advisors and transaction-rolled-back authorization tests. No Vercel deployment or commit was performed. Native package build scripts remain explicitly denied.

## Commands and results

| Command/check | Result | Evidence |
| --- | --- | --- |
| `node --version` | Available | `v24.15.0` |
| `pnpm --version` | Available | `11.9.0` |
| `git diff --check` | Pass | Exit code 0, no whitespace errors |
| Dependency link inspection | Pass | `node_modules/.bin` and required top-level package links are present |
| `pnpm lint` | Pass | ESLint exits 0 with `--max-warnings=0` |
| `pnpm typecheck` | Pass | TypeScript exits 0 with `--noEmit` |
| `pnpm test` | Pass | 4 files and 22 tests pass |
| `pnpm build` | Pass | Next.js 16.2.12 compiles, type-checks, and generates the app routes |

`pnpm-workspace.yaml` now records `allowBuilds: false` for `esbuild`, `sharp`, and `unrs-resolver`; QA did not grant native-script execution.

## Defects fixed during QA

1. **Undo previously changed only local display state.** Undo now calls the audited database operation. The UI states the ten-minute window while the server remains authoritative for expiry, authorization, idempotency, and stale-version handling.
2. **Quick-action dialogs lacked Escape behavior and predictable initial focus.** Dialogs now focus the close control on open, listen for Escape, remove the listener on close, and retain explicit dialog labeling.
3. Added component coverage for Escape-to-close, persisted bulk-operation Undo, student management, recurring templates, empty-ledger behavior, and individual session logging.
4. Optional native dependency scripts were explicitly denied rather than approved merely to unblock QA.
5. Added validation coverage for versioned student/template/session changes, session-void confirmation rules, recurring date ranges, and atomic payment replacement input.
6. Fixed contextual Pay so the tapped student and that student's balance/rate populate the sheet; added regression coverage.
7. Made the overdue alert actionable, added active/archived roster separation and audited restore, and added direct empty-state onboarding.
8. Added period collected totals and fixed mobile notice/Undo positioning plus the ordinary owed-balance selector.

## Acceptance-criteria coverage

### Covered by implementation and/or source tests

- Domain unit tests cover held-only charges, void exclusion, today's debt versus overdue debt, oldest-charge-first aging, period collections, and owed/credit separation.
- Validation tests cover the default BBD $30 rate and rejection of negative payments.
- Component tests cover primary gym-floor actions, mixed-status bulk attendance explanations, non-color-only overdue/credit labels, keyboard dialog dismissal, and bulk Undo.
- UI source includes mobile-first Today, quick payment, roster search/balance filter, recurring template view, period summary, end-of-day recap, explicit confirmation, 44px-oriented controls, safe-area positioning, reduced-motion handling, and desktop adaptations.
- Server-action source validates mutation inputs and maps authentication, conflict, expiry, not-found, and retryable database failures into typed results.

These checks are now executable and green locally.

### Partially covered or missing

- Student add/edit/archive, individual session creation, payment logging, bulk attendance, recurrence creation, daily review, and Undo are connected to centrally persisted data. Individual history drill-down, payment correction/void, and editing existing sessions/templates remain future UI work.
- Dialog initial focus and Escape are covered, but full focus trapping/restoration and automated WCAG scanning remain unverified.
- Visual behavior at 320px, 200% zoom, phone safe areas, keyboard-only navigation, and desktop breakpoints requires browser testing.
- Offline, network retry, stale concurrent edits, partial bulk failures, expired/repeated Undo, and later-edit protection need integrated UI tests against real mutation envelopes.
- Summary and recap values are derived from the live repository, and authenticated browser reconciliation was exercised after successful coach sign-in. A final automated 320px visual pass remains outstanding because the browser automation CLI is unavailable locally.

### Environment/approval-gated

- The approved target passed Security Advisor checks and transaction-rolled-back owner-isolation/direct-write-denial checks. Broader RPC concurrency, recurrence-boundary, and browser reconciliation scenarios remain release gates.
- After an approved local/preview runtime exists: run browser E2E and accessibility checks at 320px and desktop widths.
- Vercel environment and deployment validation remain gated on explicit deployment confirmation.

## Release recommendation

**Do not deploy yet.** Local executable, coach authentication, and database security gates are green, but the final browser accessibility/visual pass, reviewed Git commit/CI run, and separate Vercel deployment approval remain outstanding.

## DevOps handoff

1. Keep all four local quality commands green as integration continues.
2. Do not deploy or promote on Vercel until the coach explicitly confirms the applicable deployment gate.
3. When approved, use only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key in Vercel; never configure a service-role key in this app runtime.
4. Require migration review, RLS/RPC test evidence, backup/restore expectations, and a forward-only rollback plan before production promotion.
