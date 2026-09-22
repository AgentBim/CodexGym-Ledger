# FEAT-003: Redesign review and backend alignment proposal

- Date / owner: 2026-09-22 / G0-00.
- State: PROPOSED. Review and planning delivered; implementation and independent verification are not claimed.
- Authority: Founder request: "review first. identify how it differs from existing features and plan how to allign the backend to the new design."
- Scope: Read-only artifact/source comparison and a documented implementation proposal. No application, database, deployment, dependency, or customer-data changes.
- Candidate: Local source HEAD `1b39c69e002eb1a924541905dfe70d10ccb0c84c`; tracked working tree initially clean. Unrelated untracked files were not used.
- Design: [ChalkTab — Full UI/UX Redesign](https://claude.ai/artifact/HmRmWtLmEtYZ7bSD9FUKoV), nine-artboard canvas inspected through rendered browser content on 2026-09-22. This is a mutable reference, not a versioned implementation specification.
- Governance: G0 Core v1.0.0 pinned in PROJECT.md; Constitution, Founder Gates, Operating Model, G0-00 role and Handoff protocol consulted. One coordinator is sufficient for this proposal; independent implementation review/QA remains required before READY.
- Basis and limits: Current repository code and checked-in SQL are the implementation baseline, not proof of current deployed behavior or applied schema equality. Existing production/migration reconciliation risks remain in FEAT-001. No production rows were inspected and no runtime/integration test was performed for this documentation review.

## Assessment

Adopt the design's focused mobile layout, contextual actions, filter sheet, SVG icons, and semantic colors. Preserve the existing ledger and its corrections, audit history, integer BBD cents, owner isolation, and statements. Most changes are presentation or read-contract improvements. Named group classes and times are the substantial new domain capability; automatic offline writes would be a separate capability and is not recommended for the first slice.

The artifact is not a complete replacement specification. It omits important existing flows and mixes staged attendance with saved status. Its annotations cite an older improvement document; current source already implements several of those improvements.

## Feature comparison

| Area | Existing implementation | Artifact difference | Alignment work |
| --- | --- | --- | --- |
| Navigation | Today, Students, Activity, More already exist | Same four destinations, SVG icons, cleaner mobile hierarchy and palettes | UI/tokens only; preserve URL navigation and desktop usability |
| Today roster | All active students shown; one selected-day session status per student | Roster grouped under a time and named class; scheduled attendance staged in rows | Return occurrence-level roster; group by genuine scheduling data, not invented labels; retain unscheduled entry |
| Attendance | Selection sheet and review step; audited bulk RPC | Inline staged Attended state and count | Keep persisted status distinct from selection; retain review/financial effect; consume actual RPC outcomes |
| Row tap | Opens student detail; Pay shortcut exists | Opens attended/no-show/cancel/payment/profile action sheet | Wire existing session/payment actions with occurrence ID and expected version; no new status enum needed |
| Terminology | Database `held`, `scheduled`, `canceled`, `no_show` | Attended, Scheduled, Canceled, No-show | Display `held` as Attended; keep database value and charge rule |
| Cancellation | Per-student session cancellation; no structured cancellation actor | “Cancel class” on a student sheet and “Canceled by client” on roster | Rename to Cancel this student's session unless whole-class cancellation is specified. Do not claim actor without stored evidence |
| Save indicator | Saving while pending, otherwise All changes saved, including after errors | Timestamped save state and offline banner | Explicit pending/saved/error/unknown/offline states, committed-operation timestamp, and refresh/reconciliation state |
| Offline | No offline write queue or connectivity state in main component | Both “changes will sync later” and “entries can't be saved” | Resolve contradiction: first slice disables submission offline and preserves open drafts; no automatic sync promise |
| Student filtering | Search, active/archived roster and single balance select | Filter sheet, chips, multiple balance/class filters, recurring weekday subtitle | Balance filtering is mostly UI; derive weekday subtitle from templates; class filter needs class data |
| Balance vocabulary | Owes, Settled, Credit, Overdue | Overdue, Credit, Paid up; sample 14+ day warning | Preserve Owes option; use Paid up as display synonym for Settled; add age threshold as separate warning rule |
| Activity | Timeline, date-selectable Day review, Audit log; entry correction links | Recap warnings and time-stamped event feed in one screen | Compose existing flows; feed from audit events, retain business-date entry review and audit access |
| Warnings | Scheduled count on day review; overdue count on Today | Duplicate payments, aged balances, partial-save warning | Add structured warning derivation and actionable targets; describe conflicts accurately |
| More | Recurring template management and sign-out already exist | Menu for recurring templates, statement export, Settings, account identity | Preserve recurrence editor; statement entry can reuse existing route; Settings needs a defined scope |
| Statements | Owner-only student statement, period filter, print/Save PDF | Global Export statements menu | Start with student/date chooser into current statement route; batch export is not specified |
| Existing omitted flows | Create/edit/archive/restore students; rates/notes; payment preview/correction/void; session correction/void; Undo; recurrence scope preview; statements; day-review completion | Not illustrated in nine artboards | Explicitly retain these flows; new screens are incomplete coverage, not authority to remove features |

## Findings that affect correctness

1. **Batch results are currently misreported.** `confirmBulk` announces the selected count, while `bulk_mark_attended` returns created/updated/unchanged counts and conflicts. A scheduled session with `manually_edited_at` is a conflict even though the UI only excludes canceled/no-show. `openBulk` also preselects no-shows and unscheduled active students. Select only eligible occurrences by default and render confirmed outcomes.
2. **Database errors and domain conflicts are different.** The bulk RPC runs in one transaction. Eligible rows can commit together while other rows are intentionally reported as conflicts. An exception rolls the transaction back; it is not “one of four writes failed.” Use “3 updated; 1 needs review” for conflicts, “Batch not saved” for a confirmed rollback, and “Save outcome unknown” for lost responses.
3. **Retry identity is incomplete.** Payment keeps a key while its dialog is open; most other handlers create a fresh key per submit. Payment edits can also reuse a key with a different payload after an uncertain result. Bind each key to a frozen validated payload; retry the same attempt unchanged, reconcile uncertain outcomes, then create a new key for a new intent.
4. **A student is not an occurrence.** Loader uses `find` for one session per student/date and bulk selects normal occurrence 1 by student/date. SQL contains occurrence numbers, but current create-session path blocks an existing normal occurrence and does not provide general additional-occurrence creation. This cannot safely target two classes for the same student on one day.
5. **Today and selected date are conflated.** `page.tsx` passes the Activity date as loader `today`, which also drives overdue calculations and operational insights. Separate real Barbados today, selected business date, and balance as-of date.
6. **Timeline and completeness need work.** Current ledger timeline reflects current session/payment rows, not every event. Administrative timeline dates slice UTC while labels use Barbados. Dashboard loads all sessions/payments without explicit pagination and only 100 audit events by default; totals must not depend on a potentially capped response, and filtering the latest audit page cannot establish a complete historical day.
7. **Review freshness is not implemented as documented.** UI receives a boolean reviewed state, not changed-since-review. The review RPC does not enforce the UI's unresolved-session condition. Enforce the agreed rule server-side and compare a stable day revision to the revision reviewed, including corrections that move entries into or out of a date.
8. **Visual promises are not yet verified.** The design supplies light/dark tokens and live-region guidance, but contrast labels are design claims, not measured application evidence. Focus, 320px, 200% zoom, long names and safe-area behavior need implementation verification.

## Recommended behavior decisions

These are proposed defaults, not accepted ADRs or permission to implement:

- Offline: online-only writes with preserved open drafts. Automatic durable offline queuing requires a separate storage/privacy/conflict design.
- Attendance: keep `held` internally; show Attended only after confirmed persistence, or explicitly label selection “Will mark attended.” An unsaved selection must not be covered by “All changes saved.”
- Cancellation: individual occurrence only from the row sheet. If “by client” is required, add validated cancellation initiator/reason fields; existing cancellations remain unknown. Whole-class cancellation is a separately reviewed batch operation.
- Classes: treat names and start times as real scheduling metadata if the Founder wants them. Otherwise omit those headings and filters for the initial redesign; never infer historical classes from weekdays.
- Overdue: preserve the existing general overdue behavior; use 14 days as an additional configurable or explicitly agreed recap threshold, not an unnoticed change to every balance filter.
- Duplicate warning: advisory only. Never merge/void a payment automatically.
- Settings: initially only supported preferences, such as theme. Account roles, payment rules, currency or multi-location settings are not implied by a menu item.
- Export: existing individual statements, selected through More. Bulk generation/delivery needs its own requirements.

## Backend plan

### 1. Specify and repair mutation/read contracts first

Owner proposed: G0-04/G0-06; independent G0-09 review. Dependencies: agreed save/batch semantics and FEAT-001 retry work.

- Replace generic success JSON at the UI boundary with typed operation results: operation ID, committed timestamp, undo expiry, counts, and per-occurrence outcomes (`updated`, `unchanged`, `conflict`). Do not expose private request/audit payloads unnecessarily.
- Introduce one mutation-attempt controller shared by forms: immutable request plus key, pending/confirmed/unknown/failed state, same-key retry, inline errors, and refresh result. An online event is not evidence of a successful database write.
- Expose authenticated operation reconciliation by idempotency key, returning only the owner's result. Existing operation ledger can support this without a second write queue. A missing result is not proof an in-flight request never committed; same-key retry remains safe.
- Respect database `undoExpiresAt`, rather than restarting an unconditional ten-minute timer on receipt/reload.
- Define screen-oriented readers: Today occurrences; filtered student summaries; selected-day recap; cursor-paginated audit feed; student ledger and statement reads. Distinguish `businessDate`, `occurredAt`, `serverToday`, `asOfDate`, and `loadedAt`.
- Aggregate financial totals over complete owner-scoped ledger data on the server/database, independently of displayed page size. Use explicit paging where needed and deterministic `(occurred_at, id)` feed cursors.

### 2. Connect the new UI to existing capabilities

Owner proposed: G0-05, supported by G0-06. Mostly no schema changes.

- Implement token/theme/icon system, filter sheet/chips and contextual action sheet.
- Reuse `saveSession`, `logPayment`, corrections, archive/restore, recurrence scope preview and statement routes. Quick actions operate on a session ID/version, not the first matching student row.
- Expose eligibility and conflict reasons to the attendance review. Preserve an explicit path for adding an unscheduled attendee.
- Keep staged selection local and separate from persisted session status. Show authoritative saved results before success messaging; show read-refresh failures separately from mutation failures.
- Move recurrence and statement entry points under More without dropping their detailed screens. Keep audit, Undo, corrections, and day-review completion reachable.

### 3. Add class/time scheduling if accepted

Owner proposed: G0-04/G0-07. This is the largest optional schema slice and requires a concrete ADR before implementation.

Recommended additive model:

| Entity | Purpose |
| --- | --- |
| `classes` | Owner-scoped name and archive state; no balances or payments |
| `class_schedules` | Class, ISO weekday, Barbados local start time, effective dates, pause/archive state and version |
| `class_occurrences` | Dated instance with scheduled time and historical label snapshot; link to schedule, allow explicit ad hoc occurrence |
| `class_enrollments` | Student-to-schedule membership with effective dates and version, allowing multiple classes |
| Existing `sessions` | Remains the per-student charge-bearing occurrence; nullable owner-safe link to `class_occurrences` |

- Keep existing per-student recurring templates as legacy scheduling until explicitly mapped. Avoid two generators producing the same attendance; mapped enrollment generation supersedes only the agreed future range of its legacy template.
- Add owner-scoped composite foreign keys, RLS and narrow grants for every new relation; authenticated user context remains mandatory. Extend audited writes/Undo deliberately for new entities, including existing audit entity constraints.
- Preserve live owner/student/date/occurrence-number uniqueness; allocate additional numbers under a stable lock and add uniqueness for live student/class occurrence. Do not simply drop uniqueness to allow duplicates.
- Extend materialization idempotently with bounded dates. Preserve held, canceled, no-show, manually edited and voided history. Preview schedule changes before affecting eligible future occurrences.
- Add an occurrence-targeted attendance RPC taking IDs and expected versions. Keep the old student/date RPC compatible during rollout; class enrollment is scheduling eligibility, not a new authorization boundary.
- Keep the current per-student rate snapshot rule. Class-specific pricing is not requested by these artboards and would require another pricing decision.
- Backfill nothing speculative: existing sessions remain unclassified/untimed until an explicit mapping is reviewed. Verify balances, row counts and audit history before/after on a disposable dataset.

Alternative: class/time labels on existing templates would be cheaper but would duplicate class metadata and still need occurrence identity changes for multiple same-day sessions. Use only if classes are purely descriptive and that limitation is accepted.

### 4. Implement recap warnings and trustworthy day review

Owner proposed: G0-06/G0-07, with G0-09 verification.

- Return warnings as typed objects with stable IDs, severity, rule version, relevant entity IDs, explanation, and a safe navigation target.
- Unresolved: non-void scheduled occurrences on selected date; show earlier unresolved dates separately.
- Future-held: compare held business date to actual Barbados today. The artifact annotation mentions this warning but the rendered recap does not show it; retain it in the plan.
- Possible duplicate: candidate rule is same owner/student, amount, method and payment date, created within two minutes, excluding voided/replacement relationships. Treat this as a proposed heuristic; show both entries for review and allow audited correction, never automatic deletion.
- Aged balance: derive oldest unpaid charge using deterministic oldest-charge-first allocation and the chosen as-of date; handle partial payments, credits, corrections, voids and future-dated entries. No stored mutable balance column.
- Batch conflict: derive from completed operation outcomes. Transport errors/unknown attempts stay in the attempt UI until reconciled; they are not fabricated audit events. Cross-device visibility of unsuccessful attempts would require a separately specified durable attempt record.
- Audit feed: show actual event time in Barbados, action, student, and entry target. Preserve the separate business date for backdated payments and moved sessions.
- Day review: validate unresolved state server-side, record the revision reviewed, and display changed-since-review after relevant mutations. Prefer a monotonic per-owner/day revision maintained in the mutation transaction; moving a record updates both old and new dates. Add acknowledgement rules only if explicitly desired.

### 5. Verify and stage release

Proposed verification owner: independent G0-09; delivery owner: G0-11 after approval.

Acceptance evidence must cover:

1. Lost response and same-key retries create one effect; a changed payload cannot silently reuse an uncertain attempt; no false saved banner.
2. Mixed eligible/held/canceled/no-show/manual rows return exact counts; stale versions and two-device races cannot overwrite later edits; genuine exceptions roll back the batch.
3. Multiple classes for one student/day target the right occurrence, charge once, and keep recurrence generation idempotent.
4. Foreign-owner reads, writes, operation lookup and class relationships are denied under real authenticated contexts; direct ledger writes remain denied.
5. Sum of held non-void charges minus active payments reconciles across Today, Students, recap, history and statements, including histories above the API row cap.
6. Barbados midnight boundaries, backdated changes, future-held warnings, partial payments, 14-day boundary, duplicate heuristic exceptions, and review freshness behave as specified.
7. Existing correction/void, archive/restore, recurrence preview, grouped Undo, statement printing and audit history remain usable.
8. Mobile/desktop, keyboard, screen reader status/errors, dark/light contrast, 320px, 200% zoom and safe areas pass browser checks.

Use a disposable or isolated test backend with synthetic data. Reconcile local/applied migration history before applying new forward-only migrations. Add schema before switching reads/writes, preserve compatibility during rollout, and roll back the application via an approved artifact while retaining data/history. No destructive down-migration.

FEAT-001's recorded isolated-preview, canonical-source/release, recovery and security prerequisites still require current verification before release. Historical records dated 2026-09-13 are not a fresh environment inspection. No dependency upgrade or paid service is necessary to establish this design plan.

## Evidence map

- [Main UI and handlers](../../src/components/adult-admin-app.tsx): navigation, Today roster, selection, mutation keys, save banner, filters, Activity, More, corrections and statement entry.
- [Actions](../../src/actions/ledger.ts) and [validation](../../src/lib/validation/mutations.ts): existing write contracts and error envelope.
- [Dashboard loader](../../src/lib/ledger/load-dashboard.ts) and [UI adapter](../../src/lib/ledger/to-admin-read-model.ts): one-session projection, full-table reads, audit limit, mixed timeline and review boolean.
- [Page](../../src/app/page.tsx): selected date passed as today.
- [Ledger rules](../../src/lib/domain/ledger.ts): balances and existing overdue semantics.
- [Initial migration](../../supabase/migrations/20260804055004_initial_gym_ledger_schema.sql): schema, batch outcomes, session identity, operations, audit, Undo and review mutation.
- [Architecture](../../docs/architecture.md) and [older improvement proposal](../../docs/workflow-and-ui-ux-improvements.md): intended invariants; source takes precedence when documentation overstates current behavior.
- [Statements](FEAT-002-client-account-statements.md) and [foundation](FEAT-001-production-foundation.md): preserved scope and release dependencies.

## Handoff

Review findings and phased plan are available for Founder review. G0-00 recommends slice 1 (mutation/read contracts), then UI alignment; class scheduling follows an explicit product/model decision. No dependent implementation is active. Future engineering and verifier roles above are proposed assignments, not delegated work or invented acceptance. This proposal does not mark a product feature READY.
