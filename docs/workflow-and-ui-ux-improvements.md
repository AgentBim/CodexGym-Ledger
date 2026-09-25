# Adult Gym Admin — Recommended Workflow and UI/UX Improvements

Date: 2026-08-13

## Outcome

The app should follow the coach's day rather than the structure of the ledger:

`Prepare → Run class → Collect payment → Resolve exceptions → Review the day`

Today remains the operational home. Students is the place for people and history. Activity becomes the place to reconcile and correct entries. More remains low-frequency setup.

## Primary workflow

### 1. Prepare before class

1. Open **Today**.
2. See the Barbados date, save/connection state, scheduled count, and unresolved items from the previous day.
3. Review today's roster. Each row shows the student's attendance state and balance.
4. If someone is missing, use **Add session**; recurring scheduling stays in **More**.

Success condition: the coach understands who is expected and what needs attention without changing screens.

### 2. Record attendance during or immediately after class

1. Tap the sticky **Mark attendance** action.
2. The sheet preselects scheduled students, leaves already-held students as “No change,” and keeps canceled/no-show conflicts unselected.
3. Adjust the selection.
4. Continue to a short review step showing the date, number of records created, records changed, and conflicts skipped.
5. Confirm once.
6. Return to Today with saved statuses visible and a grouped Undo message.

Success condition: attendance can be completed with one thumb, with no accidental duplicate charge.

### 3. Record payments in context

1. Tap **Pay** on a student's Today or Students row.
2. The payment sheet opens with that student selected.
3. Show current balance, editable suggested amount, date, method, and an immediate balance-after preview.
4. Use a specific submit label such as **Record $30.00 payment**.
5. After server confirmation, update the row and show Undo.

Success condition: the coach can verify both the payment and its effect before submitting.

### 4. Resolve exceptions

1. Tap a student row to open a student detail view rather than only a management form.
2. See balance first, then **Log payment**, **Log session**, and a chronological ledger.
3. Open a session or payment entry to inspect and correct it.
4. For a destructive correction, show student, date, amount/status, financial impact, and the preservation of audit history.
5. Return to the same student and scroll position after saving.

Success condition: any questionable figure can be traced to an entry and corrected without hunting across screens.

### 5. Review and close the day

1. Open **Activity**, defaulted to today's Recap.
2. Select any date using previous/next controls or the date picker.
3. Review totals and a visible list of that day's sessions, payments, corrections, and warnings.
4. Tap any warning or entry to manage it in place.
5. Mark the day reviewed only after no unresolved items remain, or explicitly confirm that warnings are acknowledged.

Success condition: “Reviewed” means the coach has seen the underlying entries, not only summary totals.

## Recommended information architecture

| Area | Primary question | Main action |
| --- | --- | --- |
| Today | What must I do for today's class? | Mark attendance |
| Students | What is this person's balance and history? | Add student |
| Activity | What happened, and what needs correction? | Review day |
| More | How are future classes and the account configured? | New recurring class |

Keep the four destinations. Rename the Today sticky action from **Mark class attended** to **Mark attendance** because the flow contains mixed states and is not merely a single all-attended action.

## Prioritized UI/UX improvements

### P0 — Complete the reconciliation loop

1. **Add student detail and ledger history.** Make the row/card itself open the detail view; keep Pay as the explicit secondary shortcut. Include sessions, payments, reversals, and corrections in one timeline.
2. **Make Activity date-selectable and actionable.** The current date field is read-only and Recap exposes counts without underlying records. Add previous/next day controls, a real date picker, entry lists, and Manage actions.
3. **Add correction flows.** Connect existing versioned session and payment actions to edit/void dialogs with explicit impact summaries.
4. **Use URL-backed view and date state.** URLs such as `/?view=activity&date=2026-08-13` survive refresh, support Back, and allow alerts to deep-link to the exact context.

### P1 — Reduce mistakes in frequent actions

1. **Add an attendance review step.** Show create/change/no-change/conflict counts before confirmation. This is especially important when existing statuses are mixed.
2. **Show payment balance previews.** Present `Currently owes`, `Payment`, and `Balance after` together; update the preview when student or amount changes.
3. **Make action labels reflect the result.** Prefer **Record $30.00 payment**, **Mark 8 attended**, and **Archive Jordan** over generic Save/Confirm labels.
4. **Preserve retry identity and form data.** Generate an idempotency key when a form opens and reuse it on retry; show errors inside the relevant sheet near the action, not only in the global notice.
5. **Warn before future-held sessions.** If a future date and Held are selected, require explicit confirmation as specified by the business rules.

### P2 — Improve scanability and navigation

1. **Separate roster scope from balance filters.** Keep Active/Archived tabs, but replace the narrow balance select with a Filters sheet and visible removable chips such as `Overdue ×`.
2. **Sort by task urgency.** Today: scheduled first, unresolved exceptions second, completed last. Students: overdue first, then owes, then name. Allow an alphabetical override.
3. **Clarify the Today count.** Replace “N students” with status-aware copy such as “6 scheduled · 2 held.” The current count represents every active student, not necessarily today's class.
4. **Make status controls direct.** A Today row tap should open a contextual action sheet: Mark held, No-show, Cancel, Pay, View student.
5. **Improve recent activity.** Identify the action type with distinct accessible icons/labels and include a **View all activity** link.
6. **Use a real icon set.** Replace text glyphs with consistent SVG icons so appearance does not depend on operating-system fonts or character encoding.

### P3 — Accessibility and polish

1. Trap focus inside dialogs, restore focus to the trigger on close, and prevent background scrolling.
2. Move initial dialog focus to the first meaningful field for entry flows while retaining an easy Close target.
3. Add persistent field-level validation and connect help/error text with `aria-describedby`.
4. Announce saving, success, and failure through separate polite/assertive live regions; do not use the same visual style for neutral notices and errors.
5. Verify 320px width, 200% zoom, safe-area insets, long student names, keyboard-only use, and screen-reader labels.
6. Avoid multiple sticky layers competing on mobile. When a sheet or Undo toast is visible, ensure it cannot cover the primary action or bottom navigation.

## Suggested screen-level changes

### Today

- Add a compact summary row: `6 scheduled · 2 held · $90 collected`.
- Show only students relevant to today by default, with **All active students** available when adding an unscheduled attendee.
- Let the whole student row open contextual actions.
- Keep Pay explicit and at least 44×44px.
- Replace the always-green “All changes saved” indicator with accurate states: Saved, Saving, Offline, or Couldn't save.

### Students

- Make the student card a detail link and move profile editing behind **Edit profile** inside detail.
- Show balance and last attendance as the primary scan information.
- Add a clear-filters action whenever filters or search return no matches.
- Display archived debt/credit in financial filters and reports even though archived students remain excluded from quick entry.

### Activity

- Add tabs: **Recap**, **Sessions**, **Payments**.
- Put the selected date in the URL and support previous/today/next navigation.
- Place warnings before summary metrics and make every warning actionable.
- List the records contributing to each metric so totals are auditable.
- Disable or qualify **Mark day reviewed** while unresolved scheduled sessions remain.

### More / recurring classes

- Rename the visible page heading to **More**, with **Recurring classes** as a section; this matches the navigation label and leaves room for account settings.
- Allow template edit, pause/resume, and archive.
- Preview the next generated dates before creation or a scope-changing edit.
- Clearly distinguish “this occurrence” from “future occurrences.”

## Recommended delivery sequence

### Slice 1 — Review and correct a day

- URL-backed Activity date.
- Daily session/payment list.
- Session edit/void and payment correction/void.
- Actionable warnings.
- Focus trapping/restoration and inline errors.

### Slice 2 — Student detail

- Profile summary and chronological ledger.
- Contextual log payment/session actions.
- Entry detail and correction deep links.

### Slice 3 — Safer quick entry

- Attendance review step.
- Payment balance-after preview and amount-specific label.
- Stable retry idempotency key.
- Future-held warning.

### Slice 4 — Recurrence management and polish

- Template edit/pause/archive with scope confirmation.
- Filters sheet/chips and urgency sorting.
- Consistent SVG iconography.
- Automated accessibility and narrow-screen verification.

## UX success measures

- Attendance for a normal class requires no more than two navigation choices and one confirmation.
- A payment from a student row requires no student re-selection and previews the resulting balance.
- Any Recap total can be traced to its contributing entries in one interaction.
- Any session/payment correction is reachable in no more than two interactions from Activity or student detail.
- No destructive action occurs without naming the person, entry, date, and financial effect.
- Forms remain usable at 320px and 200% zoom with no hidden primary action or horizontal scroll.
