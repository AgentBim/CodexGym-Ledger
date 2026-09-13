# FEAT-002: Client account statements

- Owner / requester: Founder / G0-05 implementation owner
- State: REVIEW
- Blocked: Yes; independent review and authenticated real-ledger PDF verification are required before QA/READY, and production promotion requires Founder approval.
- Disposition: Active; Release 5 preview only.
- Problem and intended outcome: Let an authorized owner generate a clear client account-standing statement from canonical held-session charges and payments without modifying ledger history.
- Scope / exclusions: Owner-scoped statement route, client and period, opening balance, active held-session charges, active payments, running/closing balance, date filtering, print/Save PDF, and student-profile entry point. Excludes invoices, receipts, tax claims, automated delivery, client authentication, and hand-edited statement data.
- Acceptance criteria: 1. Opening plus in-period active held charges minus active payments equals closing balance. 2. Voided/corrected/non-held entries do not affect totals. 3. Date range is validated and produces deterministic running balances. 4. A foreign or unknown student statement is not disclosed. 5. Statement is reachable from a student profile and can print/save as PDF. 6. A4 desktop and iPhone output has no clipping and remains readable. 7. The exact candidate passes typecheck, lint, tests, build, and independent authenticated reconciliation against controlled ledger data.
- Dependencies / risks: Current preview uses the existing environment; PDF and real-ledger verification are incomplete; generated files contain confidential financial data; client-ready business/contact/dispute details are a separately proposed follow-up.
- Selected lifecycle stages / omissions and rationale: DEFINE/DESIGN/BUILD were completed before G0 adoption; REVIEW and QA must now be independently evidenced. SHIP is gated. DISCOVER was unnecessary for the Founder-requested feature.
- Design / architecture / ADRs: [Statement route](../../src/app/statements/[studentId]/page.tsx), [statement domain model](../../src/lib/domain/statement.ts), and [statement loader](../../src/lib/ledger/load-student-statement.ts). No schema change.
- Founder gate assessment: Founder authorized statement generation. That does not authorize representing the document as a regulated invoice/receipt, automated sharing, significant privacy changes, or production promotion.
- Authorization / approval record: Request ID `FOUNDER-2026-08-21-STATEMENTS-001`; proposed action - add owner-only client account-standing statements with date filtering and print/Save PDF; alternatives - no statement feature or manual spreadsheet reconstruction; recommended choice - derive statements read-only from the canonical ledger; impact/cost - application code and protected preview only, no database migration or new service cost; risks - disclosure of confidential financial records, stale downloaded PDFs, or misleading totals; mitigations - authenticated owner scope, deterministic canonical calculations, void exclusion, no client-facing link delivery, and independent reconciliation before production; evidence - starting Release 4 baseline, candidate `09fa798f23e9e7234b0971ebe165823109abc453`, and preview `dpl_GyGd8cHEnrbaom6wTkFKh2uTXBtV`; exact authorized scope - generate statements showing account standing, without invoice/tax claims, automated delivery, client accounts, paid services, schema changes, or production promotion; Founder - Jelani Brice; faithful source response - `i would like to be able to generate statements for clients of their account standing`; date - 2026-08-21; conditions - none stated beyond the requested capability; expiry - none stated; status - APPROVED for build/preview, with production PENDING.
- Implementation owner / independent reviewer / independent verifier: Original Codex implementation; independent G0 reviewer and G0-09 verifier pending.
- Assignment scope, inputs, access limits, output, stop condition: Review exact candidate `09fa798` and protected preview. Use controlled data, do not expose customer statements or authenticated owner URLs, and stop on reconciliation or owner-isolation failure.
- Candidate artifact / revision: Commit `09fa798f23e9e7234b0971ebe165823109abc453`; tag `chalktab-ux-release-5`; preview deployment `dpl_GyGd8cHEnrbaom6wTkFKh2uTXBtV` (`chalktab-32ys4iote-jelanis-projects-19609d5d.vercel.app`).
- Author checks: 37 unit/component tests, typecheck, lint, local production build, Vercel build, and deployment READY were reported on 2026-08-21. These are author checks and do not establish independent QA.
- Independent review: Pending against exact candidate.
- QA report: Pending.
- Residual defects / risk disposition: HIGH - Preview data isolation and independent authenticated reconciliation are absent; MEDIUM - business identity/contact/dispute/payment instructions are absent for external client communication. No broad-release risk acceptance recorded.
- Release: Preview only. See [REL-001](../releases/REL-001-production-baseline.md) for the current production state. No Release 5 production record exists.
- Measurement and follow-up: G0-09 verifies controlled owed/settled/credit/voided/date-range cases and A4/iPhone output; G0-01 separately specifies client-ready identity/delivery improvements if Founder prioritizes them.

## Transition log

| Date | Actor | From -> To | Reason | Evidence / authorization |
| --- | --- | --- | --- | --- |
| 2026-08-21 | Founder / implementation agent | - -> APPROVED | Founder requested client account statements. | Codex task instruction |
| 2026-08-21 | Implementation agent | APPROVED -> BUILDING | Statement domain, loader, route, action, styles, and tests implemented. | Candidate `09fa798` |
| 2026-08-21 | Implementation agent | BUILDING -> REVIEW | Author quality gates and protected preview passed. | Preview `dpl_GyGd8cHEnrbaom6wTkFKh2uTXBtV` |
| 2026-09-13 | G0-00 | REVIEW -> REVIEW | G0 bootstrap preserved state; independent evidence is still missing. | G0 Core completion rules |

## Handoff and dissent

Pending handoff to an independent reviewer/G0-09. Product and growth review recommends business identity, contact/dispute information, payment instructions, and safe manual delivery before broad external-client use; those recommendations do not retroactively expand the approved Release 5 scope.
