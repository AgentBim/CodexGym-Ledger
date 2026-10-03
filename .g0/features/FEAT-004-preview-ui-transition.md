# FEAT-004 — Preview UI with a persistent ledger

2026-10-02 / G0-00 / REVIEW pending independent review. Branch `codex/preview-ui-transition`; base main `8534c92`.

## Implementation

- Uses target screen components/styles for Today, attendance/summary, Students/profile, Activity, More and packages.
- Replaces demo writes with authenticated actions and database reloads. Attendance is labeled draft until saved; failed forms retain input; retry keeps the original operation identity; success follows confirmed persistence.
- Adds class settings/enrollment, present/late/absent marks, package definitions/assigned snapshots and append-only adjustments. Attendance batches are atomic and version checked.
- Package-covered sessions add no extra charge. Usage derives from live held rows. A trigger covers attendance and existing correction/void paths. Historical rows are not rewritten.
- Statements and balances include package charges/credits. Financial history reads page past PostgREST response caps.
- Preserves authentication, archive/restore, sign-out and statements. Existing corrections, audit details, recurring templates and daily review remain at authenticated `/ledger-tools`.

## Author checks

- `pnpm test`: 60 passed, including save failure/retry, attendance batching, adjustment/statement parity and complete-history reads.
- `pnpm test:database`: all migrations execute in disposable PGlite PostgreSQL with synthetic auth roles. Checks persistence, usage/exhaustion, correction release, unsafe Undo rejection, idempotency, atomic rollback, schedule versions, owner isolation and direct-write denial.
- `pnpm typecheck`, `pnpm lint`: passed. Production build result is in PROJECT_STATE.
- `pnpm preview:ui`: separate local harness using actual components, synthetic data and disabled writes. Browser checks covered desktop, 390px Today and 320px payment-failure/package screens; retained failed input, no horizontal overflow in the narrow payment check, no initial browser errors.
- These are author checks, not independent QA or hosted authenticated E2E evidence.

## Release gates and order

1. Independently review the exact PR SHA and migration `20261002050805_preview_ui_ledger.sql`.
2. Rehearse migration/authenticated flows in isolated Supabase with synthetic data, including two-tab concurrency and statement reconciliation. PGlite does not test hosted GoTrue/PostgREST behavior.
3. Verify recoverable backup and production alias/revision. Obtain explicit Founder confirmation of migration and PR merge/release scope.
4. Apply additive migration before promoting matching app. New UI requires `ui_snapshot` and `ui_command`; UI-only deployment is incomplete.
5. Smoke-test login, attendance, payments, assignment and statements; record release evidence. This work performs no hosted migration, merge or production promotion.

## Review notes

- One weekly class configuration matches the preview. Existing student recurring templates remain separate; settings changes do not rewrite their occurrences.
- Timeline/audit show the latest 100 events explicitly. Full session/payment history and statements remain in Ledger tools; unlimited audit search is not claimed.
- Supported existing operations, including payments, retain Undo. Package-covered or late attendance uses versioned corrections; the database rejects the old unsafe Undo path.
- After package charges exist, reverting to old readers would omit adjustments. Keep data and compatible readers; use a forward fix or reviewed rollback.
- Independent review, isolated hosted integration, concurrency and release checks remain pending. Do not label READY/RELEASED from author evidence.

Transition: Founder authorized build and selected preview; G0-00 implemented one candidate for review. Earlier FEAT-003 planning and closed PRs #8–12 remain historical, not completion evidence.
