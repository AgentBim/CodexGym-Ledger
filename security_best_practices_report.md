# Security and production-readiness review

## Executive summary

No database or deployment action was performed. The reviewed scaffold has sound foundational choices—server-side `getUser()`, publishable-key-only configuration, strict validation for implemented actions, owner-scoped RLS, integer money, immutable voiding, idempotency keys, and a nonce-based CSP after review fixes. It is **not ready for production or migration approval** because authentication/UI integration and several audited mutation contracts remain incomplete.

## High severity

### SEC-001 — The delivered UI is an unauthenticated in-memory prototype

- **Location:** `src/app/page.tsx:3`; `src/components/adult-admin-app.tsx:9`; `src/components/adult-admin-app.tsx:20`
- **Evidence:** the root page always renders `AdultAdminApp`, whose adapter uses hard-coded `seedStudents` and local React state. It does not authenticate, read Supabase, or call the server actions.
- **Impact:** if deployed in this state, users would see demo data and apparent “saved” confirmations while changes exist only on one device. This violates the central-storage, authentication, cross-device reliability, and “success only after persistence” requirements. It is primarily a release-blocking integrity issue, not exposure of real student data because the displayed records are fixtures.
- **Fix:** implement a sign-in route and authenticated app route; guard protected server-rendered routes with `requireUser`; replace the mock adapter with typed queries and Server Actions; display success/undo only from committed RPC results.
- **Mitigation:** do not deploy this build or enter real student/payment information.

### SEC-002 — Audited mutation coverage is incomplete

- **Location:** `supabase/migrations/draft_initial_schema.sql:208`; `supabase/migrations/draft_initial_schema.sql:437`; final comments near the end of the file
- **Evidence:** RPCs exist for payment creation, bulk attendance, recurrence materialization, and undo. There are no audited RPCs for student create/update/archive, individual session create/update/void, payment correction/void, template create/update/pause/archive, or daily review.
- **Impact:** the complete product cannot mutate those resources while preserving authorization, audit history, idempotency, optimistic concurrency, and confirmation/undo guarantees. Granting direct table writes to fill the gap would bypass those guarantees.
- **Fix:** add narrowly scoped, owner-checking, atomic RPCs for each missing mutation, then update generated database types and Server Actions. Keep direct authenticated table writes revoked. Test every RPC with two genuine authenticated users.
- **Mitigation:** the draft now revokes direct `INSERT`, `UPDATE`, and `DELETE` for `authenticated`, so missing functionality fails closed.

## Medium severity

### SEC-003 — Database functions and RLS are unexecuted and unverified

- **Location:** `supabase/migrations/draft_initial_schema.sql:1`; `supabase/migrations/draft_initial_schema.sql:208-477`
- **Evidence:** the file is intentionally an unapplied draft. Its `SECURITY DEFINER` functions have explicit `auth.uid()` checks, empty `search_path`, owner-scoped queries, and restricted grants, but no live/local Postgres validation has occurred.
- **Impact:** SQL syntax, privilege behavior, RLS enforcement, recurrence conflicts, concurrent idempotency, and undo locking could differ from intent. A defect here could compromise ledger integrity or owner isolation.
- **Fix:** after explicit migration approval, create a real migration through the Supabase CLI, test locally first, run database/security advisors, and execute cross-owner, replay, stale-version, and concurrency integration tests before any remote application.
- **Mitigation:** retain the non-timestamped draft status and do not apply it as-is.

### SEC-004 — Authentication enrollment and route policy are unspecified in code

- **Location:** `src/lib/supabase/server.ts:25`; `src/app/page.tsx:3`
- **Evidence:** `requireUser()` correctly calls `auth.getUser()`, but no sign-in/sign-out flow, public-signup restriction, protected route group, or redirect behavior is implemented.
- **Impact:** the intended single-coach access model cannot be exercised or verified. Misconfigured Supabase Auth could permit unwanted signup even though RLS isolates each owner's rows.
- **Fix:** implement protected routing and sign-in/out; disable public enrollment in the approved Supabase project or enforce an explicit allowlist/admin invitation process; document session revocation and recovery.

## Fixed during this review

- Pinned direct production and development dependency versions to the exact lockfile resolutions and synchronized `pnpm-lock.yaml` specifiers.
- Replaced a hydration-breaking static CSP with per-request nonces in `proxy.ts`, retaining strict production `script-src` and allowing `unsafe-eval` only for local Next.js development.
- Connected CSP request propagation with Supabase cookie refresh and retained defense-in-depth response headers.
- Revoked authenticated direct table mutations in the SQL draft so Data API calls cannot bypass atomic audit/undo functions.
- Restored `manually_edited_at` during session undo so recurrence/manual-edit conflict semantics are not silently changed.

## Verification limitations

Static searches found no dangerous HTML injection, string-to-code execution, token storage, service-role key, untrusted navigation, service worker, or `postMessage` usage. `git diff --check` is clean. Local typecheck/lint/tests could not run because dependencies are not installed in this workspace; invoking the package runner attempted an interactive modules-directory installation, which was not approved or performed. CSP behavior also requires runtime browser verification after dependencies are available.

