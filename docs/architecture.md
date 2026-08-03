# Adult Gym Admin — Architecture

## Decision summary

Build this as a standalone Next.js App Router application backed by Supabase Auth and Postgres and hosted on Vercel. The domain is small, financially sensitive, and unrelated to the regular gymnast roster; a separate project minimizes accidental coupling and permissions. Supabase is the system of record. Browser storage may retain unsaved form input but is never authoritative.

This document accompanies `supabase/migrations/draft_initial_schema.sql`. That file is a proposal only: it is deliberately non-timestamped, has not been applied, and must be converted into a real CLI-created migration only after explicit approval.

## Runtime boundaries

- Browser: accessible mobile UI, Supabase publishable key, authenticated session cookie, optimistic display only while a request is pending. Never receives a secret/service-role key.
- Next.js server: Server Actions/Route Handlers validate with the shared domain schemas, authenticate with the cookie-scoped Supabase client, supply idempotency keys, and map database conflicts to usable errors. Financial totals are never accepted from the client.
- Supabase Auth: one coach account initially. Email/password or magic-link enrollment is administratively controlled; public signup is disabled for production.
- Postgres: canonical constraints, owner isolation through RLS, ledger history, atomic/idempotent mutation functions, recurrence materialization, and server-derived reporting.
- Vercel: stateless compute. Environment variables are limited to the Supabase URL and publishable key. A service-role key is neither needed nor configured.

All user-facing `date` values are Barbados calendar dates. Audit timestamps use `timestamptz` in UTC. The server derives “today” with `America/Barbados`; it does not trust a device clock for overdue or recap semantics.

## Data model

Every domain row has a UUID `owner_id` referencing `auth.users(id)`, an indexed ownership path, timestamps, and a positive integer `version` for optimistic concurrency.

### `students`

Stores name, optional notes, default rate in integer BBD cents, and `archived_at`. Archive is reversible and never cascades or deletes history. Name uniqueness is intentionally not enforced: two people may share a name. Search uses an owner-scoped lowercase expression index; the roster is too small to justify full-text search.

### `recurring_session_templates`

Represents one weekly recurrence for one student: weekday (ISO 1–7), inclusive start/end dates, current default rate behavior, and paused/archived state. Templates only generate bounded future `scheduled` sessions. The generated session receives `template_id`; editing an occurrence never mutates its template.

### `sessions`

An occurrence has a Barbados `session_date`, status, `charge_rate_cents`, provenance, optional template, and `occurrence_number`. Status `held` requires a rate snapshot. A rate may remain present after moving away from held so the prior financial decision is retained; balance queries count it only while status is held and the row is not voided. When a never-held session first becomes held, the database mutation snapshots the student's current default rate (or an explicitly validated override). Re-holding a formerly held row requires an explicit reviewed rate.

`occurrence_number = 1` is the normal occurrence. An explicit “additional session” allocates 2 or higher. A partial unique index prevents two live occurrences with the same owner/student/date/number, and another prevents duplicate live template/date materialization. `voided_at` removes an occurrence from active calculations without erasing it.

### `payments`

Stores a positive integer amount, Barbados date, constrained method, and void metadata. Corrections void the old payment and create a replacement in one operation; updates that rewrite financial history are not part of the application contract.

### `mutation_operations`, `audit_events`, and `daily_reviews`

Every mutation starts with an owner-scoped operation carrying a client-generated UUID idempotency key, kind, request hash, 10-minute undo expiry, and completion state. Reusing a key with the same hash returns the prior result; a different hash is an idempotency conflict. Bulk attendance shares one operation ID.

Audit events are append-only before/after snapshots for each affected entity. They include the entity version after the change, which lets undo prove that no later edit occurred. Undo is an authenticated, atomic operation: lock the original operation and affected rows in stable UUID order, verify owner, expiry, not previously undone, and current versions, then create compensating mutations plus audit events. It never deletes audit or ledger history. A repeated undo returns the original undo result.

Daily review records mark an owner/date as reviewed without locking later edits. A subsequent mutation for that date makes the UI show “changed since review” by comparing timestamps.

## Balance and reporting rules

Balances and summaries are derived, never stored:

```text
balance = Σ(non-void held session charge_rate_cents)
        − Σ(non-void payment amount_cents)
```

Positive is “Owes”, zero “Settled”, negative “Credit”. Aggregate owed sums only positive student balances; credits are separately summed as absolute negative balances. As-of-period-end calculations include active held charges and payments dated on or before the end date. Period collection and attendance metrics additionally constrain dates to the range.

MVP overdue is derived when current balance is positive and cumulative held charges before Barbados today exceed cumulative active payments under oldest-charge-first display allocation. This can be computed with grouped queries at the expected scale. Add a security-invoker view or stable SQL function only after its query and RLS behavior are covered by tests; do not use a default owner-bypassing view.

## Mutation contracts and concurrency

All write inputs are validated twice: Next.js supplies field errors and Postgres constraints protect invariants. Each request contains `idempotency_key`; updates also contain `expected_version`.

- Create student/payment/session/template: insert operation, domain row, and audit event atomically.
- Update: `UPDATE ... WHERE owner_id = auth.uid() AND id = ? AND version = expected_version`; zero rows is either not-found/unauthorized or stale and is resolved without leaking another owner's existence.
- Bulk attendance: sort student UUIDs, validate ownership/active state, then atomically upsert only permitted normal occurrences. Existing held rows are no-ops; canceled/no-show/manual rows are reported as conflicts unless the confirmed request explicitly names them. No request silently replaces a later edit.
- Recurrence generation: compute at most the configured rolling 12-week range, insert `scheduled` occurrence 1 with `ON CONFLICT DO NOTHING`, and never update existing occurrences. Exclude archived students and paused/archived templates.
- Void/archive/scope changes: require a separately confirmed server request and append audit events.
- Undo: lock operation then entities in sorted UUID order; reject expired or stale versions; apply compensating changes and mark `undone_at` in the same short transaction.

Supabase JS cannot wrap arbitrary client-side calls in one transaction. Therefore bulk attendance, correction, recurrence generation, and undo must be database RPCs. Prefer `security invoker`; use explicit `auth.uid()` ownership predicates and RLS. If a narrowly scoped `security definer` function is ever unavoidable, put it in an unexposed schema, set `search_path = ''`, revoke execute from `PUBLIC`, explicitly check `auth.uid()`, grant only the exact signature, and security-review it before migration.

## RLS and privileges

RLS is enabled and forced on every public table. Policies target `authenticated` and use `(select auth.uid()) = owner_id`; updates have both `USING` and `WITH CHECK`. `owner_id` is immutable in the application contract. There are no anonymous policies. The draft explicitly grants only required table privileges to `authenticated` and grants none to `anon`; RLS is row authorization, while grants control Data API exposure.

Application queries must use the signed-in user's Supabase client. Never authorize from user-editable metadata. Cross-user denial tests are mandatory for select, insert, update, and any RPC. Audit events should be append-only through mutation RPCs in the final migration; the broad draft insert grant is temporary scaffolding and is identified as a migration risk below.

## Query and index plan

- Every foreign key is indexed, with composite owner/date indexes matching common filters.
- Partial indexes omit archived/voided rows for active roster and ledger queries.
- Unique partial indexes enforce live occurrence and template generation idempotency.
- Session `(owner_id, student_id, session_date)` and payment equivalent support student history, balance, and period reports.
- Audit `(owner_id, occurred_at desc)` and operation `(owner_id, idempotency_key)` support recap and retries.
- Paginate long histories with keyset `(date, id)`, not growing offsets.
- Keep database transactions short and acquire multi-row locks in deterministic UUID order.

At this roster size, derived aggregation is preferable to cached balances. Revisit only with measured `EXPLAIN (ANALYZE, BUFFERS)` evidence.

## Next.js layout and data flow

Use route groups such as `(auth)` and `(app)`, with server-rendered landing/dashboard data and small client islands for quick-entry forms, dialogs, date pickers, and undo toasts. Suggested feature boundaries are `students`, `sessions`, `payments`, `templates`, `reports`, and `recap`; shared domain validation remains under `src/lib/validation`.

After a mutation returns committed data, invalidate the affected student, today/selected-date ledger, summary, and recap cache tags. Do not announce success before persistence. Preserve submitted values on errors. Realtime is optional for MVP: revalidation on focus/navigation is sufficient, while optimistic concurrency protects phone/laptop collisions.

## Backend handoff

1. Review the draft SQL and turn it into a real migration with `supabase migration new` only after explicit user approval.
2. Implement transaction RPCs for create/update/void, bulk attendance, recurrence generation, correction, and undo; return typed result envelopes including conflicts and affected versions.
3. Make audit insertion inaccessible as a standalone client operation once RPCs exist.
4. Add security-invoker reporting queries/views and typed server repository functions.
5. Test constraints, rate snapshots, cross-owner denial, idempotency replay/conflict, stale versions, deterministic bulk conflicts, recurrence boundaries, and undo expiry/staleness.
6. Run Supabase database/security advisors against a local or approved target before applying anything.

## Frontend handoff

- Treat amounts as cents end-to-end and format as BBD only at display boundaries.
- Send ISO calendar dates and never derive them by slicing UTC timestamps.
- Include idempotency keys on every submission and expected versions on edits; retain keys across network retries.
- Render database conflict outcomes explicitly rather than claiming all-selected success.
- Display balance text as Owes/Settled/Credit, with Overdue as an additional non-color-only label.
- Undo UI is a convenience countdown; the server expiry and version checks are authoritative.
- Never expose voided entries as absent: history and recap show corrections/reversals clearly.

## Migration and operational risks

- **No migration has been applied.** The draft is intentionally not executable through normal timestamp ordering.
- Mutation RPCs and their exact grants are not yet in the draft. Applying table DDL alone would leave an incomplete audit/undo contract.
- `gen_random_uuid()` availability and the hosted Postgres version must be verified in the approved environment.
- Final grants depend on Supabase Data API exposure settings; verify rather than assuming new tables are reachable.
- RLS tests must use genuine distinct authenticated JWT contexts; testing as `postgres` or service role bypasses the intended boundary.
- Recurrence generation around year boundaries and Barbados date derivation need database integration tests.
- Backups/PITR availability depends on the selected Supabase plan. Document and rehearse restore before production financial use.
- Schema rollback must be forward-only and data-preserving; do not roll back by dropping ledger/audit tables after real data exists.

