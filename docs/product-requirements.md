# Adult Gym Admin — MVP Product Requirements

## Product goal

Give one gymnastics coach a fast, dependable, mobile-first way to record adult-class attendance and payments, see who owes money, and review the day’s activity across phone and laptop. This is a standalone Next.js + Supabase + Vercel application; separating it from the regular gymnast roster keeps permissions, financial records, and workflows small and explicit.

The operating timezone is `America/Barbados`. Currency is Barbados dollars (BBD), displayed with `$` plus an accessible BBD label where ambiguity matters.

## MVP scope

- Password-protected, single-coach workspace with centrally stored Supabase data and RLS on every exposed table.
- Student roster: name, default per-session rate (BBD $30.00 by default), optional notes, and active/archived status.
- Session ledger: student, local class date, status (`scheduled`, `held`, `canceled`, `no-show`), and the rate charged when held.
- Payment ledger: student, local date, positive amount, and method (`cash`, `transfer`, `other`).
- Student balance and history, clearly distinguishing money owed, settled, and credit.
- Fast entry for individual sessions and payments, including past and future dates.
- Bulk attendance for a selected date, with student selection and a single confirmation before records are created/updated.
- Weekly recurring-class templates that create scheduled occurrences; generated occurrences remain editable independently.
- Dashboard search and filters for active/archive state, balance state, session status, and date/period.
- Monthly/custom-period summary: payments collected, outstanding balance attributable through the period end, and attendance counts.
- Overdue indicators and a filterable list of students who are behind.
- End-of-day recap showing that Barbados date’s newly logged/changed sessions and payments, totals, warnings, and links to correct entries.
- Confirmation before destructive actions and a short-lived undo affordance after logging or changing an entry.
- Responsive, touch-friendly UI optimized for one-handed use.

## Primary user journeys

### Run today’s class

1. Coach opens Today and sees scheduled students for the Barbados date.
2. Coach taps “Mark class attended,” selects all or adjusts the list, and confirms.
3. The app marks selected occurrences held, or creates held sessions where no occurrence exists, without duplicating an existing student/date occurrence.
4. A success message offers Undo for the bulk operation.
5. Coach records payments inline with the current date preselected and immediately sees updated balances.

### Add and manage a student

1. Coach adds a name; rate defaults to $30.00 and can be overridden.
2. Student appears in the active roster and is available for scheduling and entry.
3. Coach may later update the default rate; prior held sessions retain their original charged rate.
4. Archiving requires confirmation, removes the student from normal active views and future generation, and preserves all history.

### Plan recurring classes

1. Coach creates a weekly template for one student, choosing weekday, start date, and optional end date.
2. The app previews affected dates before confirmation and creates scheduled occurrences for a bounded forward window.
3. Canceling or editing one occurrence does not silently alter the template or other occurrences.
4. Changing/stopping a template affects future scheduled occurrences only after an explicit scope choice and confirmation; held/history records are untouched.

### Review balances and history

1. Coach searches or filters the roster.
2. Each student shows owed, settled, or credit state with amount; state is conveyed by text/icon as well as color.
3. Coach opens a student to inspect chronological sessions, payments, voids/reversals, and the running balance.

### End-of-day review

1. Coach opens Recap for today (or another date).
2. The app shows held/no-show/canceled/scheduled counts, payments collected, students with positive balances, future-dated items, duplicates/conflicts, and recent corrections.
3. Coach opens an item, corrects it with confirmation where destructive, or uses Undo while still available.
4. A clear “reviewed” marker records that the date was checked without locking later corrections.

## Business rules

### Money and balances

- Store money as integer cents; never binary floating-point.
- A student’s default rate starts at 3,000 cents but may be any validated non-negative override.
- Only a session whose status is `held` accrues a charge. `scheduled`, `canceled`, and `no-show` accrue zero.
- When a session first becomes held, snapshot the effective student rate onto that session. Later student-rate changes never alter historical charges.
- Changing a held session away from `held` removes its charge from the active balance but retains the prior value and audit trail. Changing it back restores/sets an explicitly reviewed charge.
- Balance = sum of active held-session charge snapshots − sum of active payments. Positive means owed; zero means settled; negative means credit.
- Payments must be greater than zero. Corrections use a void/reversal plus replacement rather than destroying financial history.
- Summary “total collected” is active payment amounts dated within the selected period. Attendance is held-session count within the period. “Total owed” is the aggregate positive balance as of the selected period end; credits are reported separately and never netted invisibly against another student.

### Dates, status, and recurrence

- User-facing dates are calendar dates in `America/Barbados`, not device-local timestamps. Past and future dates are valid.
- Future sessions default to `scheduled`. A future `held` status is allowed only after a warning and explicit confirmation, to support legitimate back-office entry without silent mistakes.
- A student may have at most one non-void session occurrence per template/date. Ad-hoc multiple sessions for the same student/date require an explicit “additional session” action so duplicates are intentional.
- Weekly templates generate `scheduled` occurrences only. Generation is idempotent and bounded (MVP default: rolling 12 weeks, respecting an optional end date).
- Archived students remain visible in historical reports but are excluded from default roster, bulk attendance, and new recurring occurrence generation.

### Overdue state

- MVP definition: a student is overdue when their balance is positive and at least one unpaid charge comes from a held session before today in Barbados.
- A positive balance caused only by a held session dated today is “owed,” not “overdue.” Future scheduled sessions never affect either state.
- Allocation for aging is oldest charge first for display purposes; payments are not permanently tied to individual sessions in MVP.

### Safety, deletion, and undo

- “Delete” is presented as archive for students and void/remove for entries. No user action hard-deletes student, session, payment, template, or audit history.
- Every archive, void, or destructive scope change requires a confirmation naming the target and impact.
- After a successful create/update/bulk action, show Undo for 10 minutes and until logout, whichever comes first. Undo must be server-authorized, idempotent, and auditable; bulk undo reverses only records changed by that operation and must not overwrite later edits.
- Undo of a payment voids/reverses it; undo of a newly logged session voids it; undo of an update restores the prior recorded state through an audit event.
- All mutations validate input and authenticated ownership on the server. The browser receives only the Supabase publishable/anon key; no service-role or privileged secret is shipped in the application runtime.

## Acceptance criteria

### Students

- Creating a student with only a valid name produces an active student at $30.00; an override persists exactly to cents.
- Notes are optional and rendered as plain text. Invalid/empty names and out-of-range rates are rejected with field-level errors.
- Archiving requires confirmation, preserves related history and balances, and can be reversed.
- Changing a default rate does not alter charges on previously held sessions.

### Sessions and bulk attendance

- Coach can create/edit a session on any valid past or future date and choose all four statuses.
- Only transition to `held` adds the snapshotted charge; leaving `held` removes it from the active balance.
- Bulk attendance previews date and selected students, avoids accidental duplicates, reports partial/conflicting items, and offers operation-level Undo.
- Repeating the same bulk request is idempotent and cannot double-charge students.

### Payments and balances

- Coach can log a positive payment with date and method; the balance updates after confirmed persistence.
- Credit, settled, owed, and overdue states have distinct text/icon treatment and correct signed arithmetic.
- Voiding/correcting a payment requires confirmation, preserves an audit record, updates totals, and cannot be applied twice.

### Templates

- Coach can create, pause, edit, and archive a weekly template and preview generated dates.
- Generation creates only missing future scheduled occurrences within the configured horizon.
- Template changes never modify held, canceled, no-show, voided, or manually edited occurrences without an explicit per-scope confirmation.

### Search, reports, and recap

- Search matches student names case-insensitively; filters can be combined and cleared.
- Monthly/custom-period totals reconcile with the underlying active ledger entries, and credit is shown separately from owed.
- End-of-day recap uses Barbados dates, exposes all activity/corrections for the chosen day, flags suspicious future-held or duplicate entries, and supports direct correction.

### Mobile and reliability

- Core actions (bulk attendance, log payment, open recap) are reachable in no more than two navigation choices from the signed-in landing view.
- Primary tap targets are at least 44×44 CSS pixels; forms work at 320px width without horizontal scrolling; primary actions remain reachable one-handed.
- A mutation is shown as successful only after server persistence. On failure, entered values remain recoverable and retry does not duplicate data.
- Signing in on another device shows persisted changes without relying on browser-local storage as the source of truth.

### Security and accessibility

- Unauthenticated users cannot read or mutate app data. RLS ownership policies cover every exposed table and are tested for cross-user denial even in this single-user release.
- Server mutations reject malformed, unauthorized, replayed/idempotency-conflicting, and out-of-scope input.
- Secrets are absent from client bundles and logs; security headers remain enabled.
- All workflows are keyboard operable, labeled for assistive technology, and do not rely on color alone.

## Edge cases to design and test

- Rate changes between scheduling and attendance; zero-rate/discount student; cent values rather than whole dollars.
- Payment larger than amount owed, multiple payments on one date, backdated payments, and payment entered for an archived student.
- Bulk attendance when some students are already held/canceled/no-show, when an occurrence was manually edited, or when the request is retried after a timeout.
- Template start/end boundaries, recurrence across month/year transitions, pausing templates, and regenerating the rolling horizon.
- Device clocks/timezones differing from Barbados; midnight boundary during entry; future-held warning.
- Concurrent edits from phone and laptop; stale forms must surface a conflict rather than silently overwrite newer data.
- Undo after a later edit, repeated Undo, expired Undo, and partial failure in a bulk operation.
- Archived student with outstanding debt or credit; archival must not hide them from financial summaries/overdue reporting.
- Empty roster/period, long names/notes, network interruption, duplicate submission, and accessible error announcements.

## Out of scope for MVP

- Integration with the regular gymnast roster or a broader club-management system.
- Student accounts, self-service booking, invoices/receipts, automated reminders, email/SMS/WhatsApp messaging.
- Card processing, bank reconciliation, refunds to payment rails, accounting exports, tax handling, or multi-currency conversion.
- Multiple coaches, roles/permissions beyond one owner, shared households, class capacity/waitlists, packages with consumption rules, or variable per-occurrence pricing beyond the rate snapshot/manual correction.
- Offline-first writes. A recoverable form and safe retry are required, but confirmed changes require connectivity.
- Permanent deletion through the product UI.

## Release gates

1. **Product/UX:** Mobile flows and destructive/undo language satisfy the journeys and acceptance criteria at 320px and common phone widths.
2. **Architecture:** Schema documents ownership, rate snapshots, soft deletion/voiding, audit events, idempotency, concurrency, recurrence generation, and Barbados-date semantics.
3. **Security:** Authentication and RLS policies are reviewed and tested; server validation exists for every mutation; no privileged key reaches client/runtime; dependency and secret scans pass.
4. **Data integrity:** Automated tests prove only held sessions accrue debt, historical rates remain stable, totals reconcile, recurring/bulk operations are idempotent, and undo cannot erase history or overwrite later work.
5. **Quality:** Unit/integration/E2E coverage includes the primary journeys and listed high-risk edge cases; lint, typecheck, test, and production build pass with no high-severity accessibility findings.
6. **Operational readiness:** Error handling, structured redacted logging, backup/restore expectations, and a rollback plan are documented.
7. **Explicit approval:** Database migrations are reviewed but not applied until the coach confirms. Vercel configuration is reviewed, including environment variables, but preview/production deployment is not performed until the coach confirms.

## Architect and UX handoff

The architect should make the ledger auditable rather than mutable: owner-scoped rows, session charge snapshots, void/reversal metadata, optimistic concurrency, idempotency keys/operation groups, and server-derived summaries. Resolve how a held session that is returned to scheduled/canceled is represented without losing the financial trail. Specify recurrence materialization and conflict rules before backend work begins.

UX should prioritize Today, Quick payment, and Recap in thumb reach; use a bottom navigation/action pattern only if it remains accessible. Prototype bulk attendance with mixed pre-existing statuses, visible save state, retry, and grouped Undo. Balance presentation must say “Owes $X,” “Settled,” or “Credit $X,” with overdue as an additional label—not color alone. Confirmation dialogs must identify the student/entry, date, financial impact, and whether the action affects one occurrence or future occurrences.
