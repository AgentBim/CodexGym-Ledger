# FEAT-001: Production foundation

- Owner / requester: Founder / G0-00; proposed owners G0-04, G0-07, G0-10, G0-11
- State: SPECIFIED
- Blocked: Yes; G0-11 must reconcile source and production aliases, G0-07 must propose Preview isolation and recovery, and implementation approval must be recorded before BUILDING.
- Disposition: Active; stop-ship foundation before broader real-client use.
- Problem and intended outcome: ChalkTab's ledger architecture is strong, but source, environment, retry, recovery, auth, and release evidence do not yet establish a reproducible production candidate. Create a clean, isolated, recoverable, monitored release path.
- Scope / exclusions: Source/release reconciliation, protected branch and exact-SHA CI, Preview/Production data isolation, stable mutation idempotency, backup/restore evidence, auth/CSP/origin hardening, authenticated E2E/accessibility/concurrency tests, monitoring and canonical aliases. Excludes feature expansion, paid provisioning without approval, destructive database changes, and production promotion.
- Acceptance criteria: 1. The exact release SHA exists on a protected remote branch and lint, typecheck, all tests, and production build pass in CI. 2. Deployment metadata reports a clean source candidate and maps one canonical production alias to the documented revision and rollback target. 3. Preview uses an isolated Supabase environment and cannot read or write production. 4. Every ledger mutation retains its idempotency key through uncertain retries and lost-response integration tests create no duplicate effects. 5. Backup owner, RPO/RTO, retention, and recovery method are recorded, and a disposable restore reconciles schema, migration history, row counts, balances, and audit history. 6. Auth origin allowlists, CSP, leaked-password protection disposition, and owner enrollment boundaries pass security review. 7. Authenticated E2E covers core ledger, correction, conflict, Undo, statement, keyboard, 320px, 200% zoom, and iPhone safe-area paths. 8. A 24-hour preview soak has zero unexplained core-flow failures and an alert/incident owner is named.
- Dependencies / risks: GitHub authentication/branch protection; Vercel alias reconciliation; only one visible Supabase project; possible added service cost; live financial data; migration filename/history mismatch; availability of independent QA.
- Selected lifecycle stages / omissions and rationale: DEFINE, ARCHITECT, BUILD, VERIFY, SHIP, and MEASURE are required. DISCOVER reuses the 2026-08-21 startup-team assessment. DESIGN is limited to error/retry states. Production SHIP remains gated.
- Design / architecture / ADRs: [Architecture](../../docs/architecture.md), [deployment runbook](../../docs/deployment-runbook.md), [PROJECT.md](../PROJECT.md). New architecture/privacy/cost choices require ADRs and gate reassessment.
- Founder gate assessment: G0 bootstrap is approved. Preview isolation that changes trust boundaries, any paid service, significant auth/privacy change, destructive database action, and production launch require explicit Founder approval unless a narrower recorded standing policy applies.
- Authorization / approval record: SPECIFIED by G0-00 from the Founder-authorized bootstrap and evidence review on 2026-09-13. Authorization to implement routine no-cost documentation/tests is not a production or architecture approval. Remaining gated choices are PENDING.
- Implementation owner / independent reviewer / independent verifier: No implementation assignment is active. G0-04/G0-07/G0-10/G0-11 are proposed implementers by capability, and G0-09 is the proposed independent verifier. G0-00 must record complete task-level delegations before work begins; implementers cannot be sole reviewers.
- Assignment scope, inputs, access limits, output, stop condition: Proposed bounds only, not an active assignment - use the exact repository revisions, Vercel/Supabase read-only evidence, and pinned Core; write evidence to this feature or linked ADR/QA/release records; do not expose secret values, use production data for Preview testing, incur cost, change security/privacy boundaries, or promote production without applicable approval; stop on any unexplained ledger discrepancy or cross-owner exposure.
- Candidate artifact / revision: None.
- Author checks: Specification cross-checked against live read-only Vercel/Supabase evidence on 2026-09-13; implementation checks not run.
- Independent review: Pending exact candidate.
- QA report: Pending.
- Residual defects / risk disposition: HIGH - split production identity, non-reproducible deployment/source mapping, absent Preview data isolation, unverified recovery, and incomplete retry/E2E evidence. No risk acceptance recorded.
- Release: No release candidate. Production promotion not approved.
- Measurement and follow-up: G0-04/G0-11 first reconcile source and deployment facts; G0-00 then seeks only the Founder decisions needed for environment cost/trust and release policy.

## Transition log

| Date | Actor | From -> To | Reason | Evidence / authorization |
| --- | --- | --- | --- | --- |
| 2026-09-13 | G0-00 | - -> PROPOSED | Startup-team audit identified production-control gaps. | Team assessment summarized in PROJECT_STATE.md |
| 2026-09-13 | G0-00 | PROPOSED -> SPECIFIED | Scope, acceptance criteria, gates, owners, risks, and evidence were recorded during G0 bootstrap. | Founder-authorized bootstrap; live read-only checks |

## Handoff and dissent

Proposed handoff is pending, not assigned: G0-04/G0-11 for source/deployment reconciliation and G0-07 for an isolated Preview/recovery proposal. G0-00 must create Core-complete delegation records before activating those roles. The engineering assessment dissents from broad production use until all P0 acceptance criteria pass. G0-00 accepts that stop-ship assessment.
