# QA Report — Adult Gym Admin

Date: 2026-07-31  
Environment: Windows workspace, Node.js 24.15.0, pnpm 11.9.0

## Executive result

The source tree passes whitespace/static patch validation, and targeted QA fixes were added for functional Undo and keyboard-close behavior. The executable quality gate is **environment-blocked**, not passing: the pnpm virtual store exists, but top-level package links and `node_modules/.bin` are absent. Running a script causes pnpm to attempt reconstruction, then fail because registry downloads are denied (`EACCES`). Lint, typecheck, unit/component tests, and production build therefore remain unverified and must not be treated as green.

No migration, Supabase connection, deployment, external application call, or commit was performed. Native package build scripts remain explicitly denied.

## Commands and results

| Command/check | Result | Evidence |
| --- | --- | --- |
| `node --version` | Available | `v24.15.0` |
| `pnpm --version` | Available | `11.9.0` |
| `git diff --check` | Pass | Exit code 0, no whitespace errors |
| Dependency link inspection | Blocked | `node_modules/.bin`, `node_modules/typescript`, and `node_modules/next` are all absent; packages exist only partially under `.pnpm` |
| `pnpm typecheck` | Environment-blocked | pnpm attempted to add 446 packages; registry requests failed with `EACCES` and the bounded command timed out |
| `pnpm lint` | Not runnable | Same missing-link/install prerequisite; not retried after exact blocker was established |
| `pnpm test` | Not runnable | Same missing-link/install prerequisite |
| `pnpm build` | Not runnable | Same missing-link/install prerequisite; Next/SWC and Sharp artifacts are among inaccessible packages |

`pnpm-workspace.yaml` now records `allowBuilds: false` for `esbuild`, `sharp`, and `unrs-resolver`; QA did not grant native-script execution.

## Defects fixed during QA

1. **Undo previously changed only toast text.** The mock adapter now snapshots the prior student/activity state and restores it when Undo is activated. The UI also expires the affordance after ten minutes and states the window in visible text. The future server adapter remains authoritative for expiry, authorization, idempotency, and stale-version handling.
2. **Quick-action dialogs lacked Escape behavior and predictable initial focus.** Dialogs now focus the close control on open, listen for Escape, remove the listener on close, and retain explicit dialog labeling.
3. Added component coverage for Escape-to-close and restoring the prior mock state through bulk-operation Undo.
4. Optional native dependency scripts were explicitly denied rather than approved merely to unblock QA.

## Acceptance-criteria coverage

### Covered by implementation and/or source tests

- Domain unit tests cover held-only charges, void exclusion, today's debt versus overdue debt, oldest-charge-first aging, period collections, and owed/credit separation.
- Validation tests cover the default BBD $30 rate and rejection of negative payments.
- Component tests cover primary gym-floor actions, mixed-status bulk attendance explanations, non-color-only overdue/credit labels, keyboard dialog dismissal, and bulk Undo.
- UI source includes mobile-first Today, quick payment, roster search/balance filter, recurring template view, period summary, end-of-day recap, explicit confirmation, 44px-oriented controls, safe-area positioning, reduced-motion handling, and desktop adaptations.
- Server-action source validates mutation inputs and maps authentication, conflict, expiry, not-found, and retryable database failures into typed results.

These are source-level observations until the automated suite executes successfully.

### Partially covered or missing

- The frontend still uses a local mock adapter; it is not integrated with server actions or centrally persisted data.
- Add/edit/archive student, individual session editing, recurrence creation/edit scopes, ledger drill-down, and real void/correction screens are not complete end-to-end workflows.
- Dialog initial focus and Escape are covered, but full focus trapping/restoration and automated WCAG scanning remain unverified.
- Visual behavior at 320px, 200% zoom, phone safe areas, keyboard-only navigation, and desktop breakpoints requires browser testing.
- Offline, network retry, stale concurrent edits, partial bulk failures, expired/repeated Undo, and later-edit protection need integrated UI tests against real mutation envelopes.
- Static summary and recap sample values do not yet reconcile against a live repository.

### Environment/approval-gated

- Install/link dependencies in an environment with an available pnpm store or approved registry access, without broadly approving package scripts.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` to completion.
- After explicit database-migration approval: test RLS cross-owner denial, constraints, RPC idempotency/replay conflict, concurrency, rate snapshots, recurrence boundaries, reporting reconciliation, and atomic Undo using distinct authenticated JWT contexts.
- After an approved local/preview runtime exists: run browser E2E and accessibility checks at 320px and desktop widths.
- Vercel environment and deployment validation remain gated on explicit deployment confirmation.

## Release recommendation

**Do not deploy yet.** The repository is suitable for continued integration, but release gates are not met until dependency links are repaired, all four local commands pass, the frontend uses the authenticated server contract, the database migration/RLS/RPC suite is explicitly approved and exercised, and browser accessibility/E2E checks pass.

## DevOps handoff

1. Repair dependency installation in a network-enabled or fully cached environment; keep native build-script approvals narrowly scoped and only enable a script if the production build demonstrates it is required.
2. Run the four quality commands independently and retain logs; any failure returns to engineering/QA rather than being waived.
3. Do not configure production Supabase variables, apply the draft migration, or deploy until the coach explicitly confirms.
4. When approved, use only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key in Vercel; never configure a service-role key in this app runtime.
5. Require migration review, RLS/RPC test evidence, backup/restore expectations, and a forward-only rollback plan before production promotion.
