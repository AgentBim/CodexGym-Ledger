# Adult Gym Admin — Mobile UX Specification

## Experience principles

The coach should be able to record the common gym-floor actions with one thumb, verify that the server saved them, and recover immediately from a mistake. Today is the operational home; Recap is the daily safety net. The interface uses Barbados calendar dates and BBD amounts throughout, and never treats device-local storage as authoritative.

Design for 320px first. Primary controls are at least 44×44 CSS pixels, the primary action sits in the lower half of the screen where practical, and forms avoid side-by-side fields on phones. Status is always communicated with words and an icon or shape as well as color.

## Information architecture

Signed-out users see only Sign in. Signed-in navigation has four destinations:

1. **Today** — today's class list, bulk attendance, inline payment entry, alerts, and shortcuts.
2. **Students** — searchable/filterable roster, balances, student history, add/edit/archive.
3. **Activity** — end-of-day Recap by default, with session/payment ledgers and period summaries as tabs.
4. **More** — recurring templates and account/session settings.

On phones, use a fixed bottom navigation above the safe-area inset. Today is first and selected after sign-in. A prominent contextual action sits above the navigation: `Mark class attended` on Today, `Add student` on Students, and `Log payment` or `Review day` where relevant. Do not use a floating action button with an unlabeled plus.

On desktop, replace bottom navigation with a left rail and use a two-column content area where the second column adds context rather than changing task order. All routes and actions remain identical.

## Core screen flows

### Today / run class

Header: `Today`, full Barbados date, connection/save-state indicator, and compact search. Below it:

- Alert strip: overdue student count and unreviewed prior day, each opening a filtered destination.
- Today's scheduled/held list. Each row shows name, attendance status, and balance label. A row tap opens a bottom sheet with `Mark held`, `Change status`, `Log payment`, and `View student`.
- Sticky lower action: `Mark class attended`.
- Recent activity: last three entries, each with server-confirmed state and Undo when eligible.

Bulk flow: tap `Mark class attended` → full-height sheet → date picker defaults to Barbados today → active roster with scheduled students selected first → `Select all` / `Clear` controls → mixed-status rows explain their current state → sticky `Review attendance (N)` → review screen names date, selections, creates, updates, and conflicts → `Confirm attendance` → saving state disables duplicate submission → persisted result summary + grouped Undo toast.

Conflicts are not silently overwritten. Already-held rows are labeled `No change`; canceled/no-show or manually edited rows start unselected and require an explicit choice. An intentional additional same-day session uses a separate `Add another session` action.

### Quick payment

Reachable from Today in one action and from a student row/detail. Sheet order: student search/select, amount, date, method, balance-after preview, submit. If launched from a student, preselect that student; date defaults to Barbados today; amount may suggest the positive amount owed but must remain editable. Submit label includes amount: `Record $30.00 payment`.

Show success only after persistence. On failure retain all values, announce the error, and offer `Try again`; retries reuse the same idempotency key. A payment for an archived student is allowed only from history/search and displays a warning before confirmation.

### Students

Top controls are a search field and a `Filters` button with active-filter count. Default list includes active students, ordered overdue first then name. Each card shows:

- Student name and archived label if applicable.
- `Overdue · Owes $60.00`, `Owes $30.00`, `Settled`, or `Credit $20.00`.
- Optional last-attended date and quick payment button.

Filters combine: active/archived, overdue/owes/settled/credit, and clear all. Search is case-insensitive and updates the result count. Empty search and empty filter states explain how to recover.

Student detail places name and balance summary first, followed by `Log payment` and `Log session`. History is a chronological ledger with sessions, payments, voids/reversals, and corrections visually distinct but in one sequence. Each item opens details and correction actions. Edit profile includes rate-change copy: `Existing held-session charges will not change.` Archive is at the end of the form and never styled as a routine primary action.

### Recurring templates

List templates by student with weekday, active/paused state, and next generated occurrence. Create/edit form is linear: student, weekday, start, optional end, then generated-date preview. Saving template changes requires a scope choice (`Template only` or `Template and eligible future scheduled sessions`) followed by a confirmation listing affected counts. Held, canceled, no-show, voided, and manually edited occurrences remain visibly excluded.

### Activity, summaries, and end-of-day Recap

Activity opens on **Recap** for Barbados today. A date control supports prior days and a `Today` reset. Recap contains:

1. Review status: `Not reviewed` or `Reviewed at …`; marking reviewed does not lock the day.
2. Metric grid: held, no-show, canceled, still scheduled, and collected.
3. Warnings: future-held items, intentional/unresolved duplicates, conflicts, failed/partial bulk operations, and outstanding students from that day's held sessions.
4. Timeline of that day's created/changed sessions, payments, reversals, and corrections, with direct edit links.
5. Sticky `Mark day reviewed` action; when already reviewed, show `Review again` after later changes.

The **Summary** tab has month presets plus custom start/end dates. Show `Collected`, `Attendance`, `Total owed`, and `Total credit` as separate values; never net credit against debt. Tapping a metric opens its reconciling entries. Empty periods show zero values and `No activity in this period`.

The **Ledger** tab provides date, entry-type, session-status, and student filters with a clear-all action.

## Visual and language semantics

Balance labels use signed meaning, not a bare number:

| State | Required label | Icon/shape | Color role |
| --- | --- | --- | --- |
| Overdue | `Overdue · Owes $60.00` | warning triangle | strong amber/red |
| Owed today/not overdue | `Owes $30.00` | open circle | amber |
| Settled | `Settled` | check circle | neutral/green |
| Credit | `Credit $20.00` | down-arrow circle | blue/teal |

Use `BBD` in summary/help context and `$` in compact repeated labels. Never display credit as `-$20.00` without the word `Credit`.

Session chips read `Scheduled`, `Held`, `Canceled`, and `No-show`. Voided entries remain visible with `Voided` and subdued struck-through value; assistive text explains the reversal.

## Confirmation patterns

Confirmation is mandatory for archive, void/remove, destructive recurrence scope changes, transitions that remove a held charge, and future-dated held sessions. The dialog title uses the action and target, and body states date, financial impact, and scope. Examples:

- `Archive Maya Clarke?` — `She will leave active class lists. Her history and $60.00 owed balance remain.`
- `Void $30.00 cash payment?` — `Maya's amount owed will increase from $0.00 to $30.00. The original payment remains in history.`
- `Mark Aug 7 as held?` — `This date is in the future and will add a $30.00 charge.`

Buttons use explicit verbs (`Keep payment`, `Void payment`), with focus initially on the safe action. Destructive buttons are visually distinct but not solely by color. Escape/back closes without action; focus returns to the trigger.

## Undo behavior

After every successful create, update, or bulk operation, show a bottom toast above navigation for 10 minutes or until logout. It contains a plain-language result, `Undo`, and dismiss control. Example: `12 students marked held · Undo`.

Undo begins only after the user activates it; show `Undoing…`, then `Attendance undone` after server confirmation. Grouped undo names partial protection: it reverses only records from that operation that have not since changed. If later edits prevent reversal, show `10 undone; 2 kept because they changed` with `View details`. Expired, repeated, offline, or unauthorized undo produces an explanatory non-destructive message. Dismissing a toast does not cancel eligibility; eligible actions remain in Recent activity with their remaining time. Do not persist undo credentials or sensitive session material in browser storage.

## Interaction and system states

- **Loading:** use stable skeleton rows; never replace the entire screen with a spinner.
- **Saving:** button changes to verb-progress (`Recording…`), is disabled, and preserves entered values.
- **Saved:** update totals only from confirmed server response; announce success in a polite live region.
- **Offline/network loss:** persistent banner `You're offline — entries can't be saved yet`; forms stay filled and can retry, but are not represented as queued or saved.
- **Stale/concurrent edit:** stop, show current server value beside the user's attempted value, then offer `Reload latest` and a deliberate reapply path.
- **Partial bulk result:** show created/updated/no-change/conflict counts and affected names; never collapse this to generic success.
- **Empty roster:** `No active students yet` plus `Add first student`.
- **No results:** retain query/filters and provide `Clear filters`.
- **Unauthorized/session expired:** preserve non-sensitive draft values in memory during reauthentication where feasible, never in local storage as source of truth.

Date fields use a native-friendly date picker plus a readable formatted value. Label all future dates and warn only when a future session is made held, not merely scheduled.

## Accessibility requirements

- Meet WCAG 2.2 AA contrast and reflow at 320px and 200% zoom without horizontal scrolling.
- Maintain logical heading order, landmarks, visible focus, and keyboard operation for sheets, dialogs, menus, filters, and date controls.
- Use native buttons/inputs; every icon-only control has an accessible name and tooltip where useful.
- Dialogs trap focus, announce their title/description, close predictably, and restore trigger focus.
- Errors are adjacent to fields, summarized at form top, and announced via `aria-live="assertive"`; success/undo updates use `aria-live="polite"`.
- Lists expose status text, not color alone. Charts are optional and must have equivalent tabular values.
- Respect reduced motion; sheet/toast transitions are brief and nonessential.
- Touch targets are at least 44×44 with 8px separation where accidental taps are costly.

## Compact mobile wireframes

```text
TODAY                         BULK ATTENDANCE
┌──────────────────────┐      ┌──────────────────────┐
│ Today      Saved ✓   │      │ ← Attendance         │
│ Fri, 31 July         │      │ [31 Jul 2026      ▾] │
│ ⚠ 3 overdue          │      │ Select all      Clear│
├──────────────────────┤      ├──────────────────────┤
│ Search students      │      │ ☑ Maya   Scheduled  │
│ Maya    Scheduled    │      │ ☑ Joel   No session │
│ Owes $30     [Pay]   │      │ ☐ Ana    Canceled   │
│ Joel    Held         │      │ ⓘ Review conflicts  │
│ Credit $10   [Pay]   │      │                      │
├──────────────────────┤      ├──────────────────────┤
│ Recent activity      │      │ [Review attendance 2]│
│ Payment $30 · Undo   │      └──────────────────────┘
├──────────────────────┤
│ [Mark class attended]│
│ Today Students Activity More│
└──────────────────────┘

RECAP                         STUDENT
┌──────────────────────┐      ┌──────────────────────┐
│ Activity > Recap     │      │ ← Maya Clarke        │
│ [31 Jul 2026]        │      │ ⚠ Overdue            │
│ Not reviewed         │      │ Owes $60.00          │
├──────────────────────┤      │ [Log payment][Session]│
│ Held 12  No-show 1   │      ├──────────────────────┤
│ Collected $180       │      │ History              │
├──────────────────────┤      │ Jul 31 Held    +$30  │
│ ⚠ 1 future-held      │      │ Jul 31 Cash    -$30  │
│ ⚠ 2 still scheduled │      │ Jul 24 Held    +$30  │
│ Timeline …           │      │ Payment voided       │
├──────────────────────┤      └──────────────────────┘
│ [Mark day reviewed]  │
└──────────────────────┘
```

## Component inventory

- App shell: `MobileBottomNav`, `DesktopRail`, `PageHeader`, `ConnectionStatus`, `StickyActionBar`.
- Data display: `StudentBalanceCard`, `BalanceBadge`, `SessionStatusChip`, `LedgerItem`, `MetricCard`, `WarningList`, `ActivityTimeline`, `EmptyState`, `SkeletonRow`.
- Entry: `StudentCombobox`, `MoneyInput`, `BarbadosDateField`, `SessionStatusField`, `PaymentMethodField`, `SearchField`, `FilterSheet`.
- Workflows: `QuickPaymentSheet`, `SessionEntrySheet`, `BulkAttendanceSheet`, `BulkReview`, `RecurrenceForm`, `GeneratedDatesPreview`, `EodRecap`.
- Safety/feedback: `ConfirmDialog`, `FutureHeldWarning`, `ConflictResolver`, `OperationResult`, `UndoToast`, `InlineError`, `FormErrorSummary`, `OfflineBanner`, `LiveRegion`.

Frontend should implement route-level server data loading and progressively enhance forms. Client state may hold transient field values and presentation state, but balances, save success, undo eligibility, and conflict decisions must come from server responses.

## Desktop adaptation

At 768px+, use a persistent left rail and cap primary reading width around 720px. At 1024px+, Today can pair the class list with Recent activity; Student detail can pair balance/actions with history; Recap can pair metrics/warnings with timeline. Keep primary actions in the same DOM/task order as mobile, preserve full keyboard navigation, and avoid desktop-only capabilities. Confirmation dialogs become centered modals; entry sheets may become right-side panels. Tables are acceptable for ledgers only when every action remains accessible without hover.

## Frontend acceptance checklist

- Today, bulk attendance, quick payment, and Recap each work at 320px without horizontal scrolling.
- Core gym-floor actions require no more than two navigation choices.
- All mutation outcomes distinguish saving, saved, failed, conflict, partial result, and undone states.
- Confirmation copy names target, date, financial impact, and recurrence scope where applicable.
- Owed, overdue, settled, and credit states remain understandable in grayscale and to screen readers.
- Bottom navigation, sticky actions, sheets, keyboard focus, and undo toast do not obscure one another or safe-area insets.
- Desktop layouts add useful context without creating different workflows.
