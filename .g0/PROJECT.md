# ChalkTab — G0-P002

- Owner: Jelani Brice / AgentBim. Single-owner adult gymnastics attendance and BBD ledger.
- Ground Zero Core: v1.0.0, `AgentBim/Codex-Agents`, commit `3ffccfc6eeec70efcc480443204850ee22bb1312`. Act as G0-00; preserve ledger/audit history; require independent verification before READY.
- Original adoption: [ADR-001](decisions/ADR-001-adopt-ground-zero.md). Historical foundation evidence remains on `codex/g0-production-foundation-integration`; this branch starts from main `8534c92`.
- Approved build scope: reproduce the Founder-selected Vercel preview and provide persistent backend behavior for attendance, packages, credits, schedule and students. Authentication, corrections, recurring student schedules, daily review and statements remain accessible.
- Scope expansion and release authority: [ADR-002](decisions/ADR-002-preview-and-pr-confirmation.md). Packages are authorized for implementation. Production database changes and merges require explicit approval.
- Constraints: Barbados dates, integer BBD cents, authenticated server actions, owner-scoped RLS, append-only financial adjustments and audited corrections. No customer data or credentials in fixtures/G0 records.
- Services: existing Next.js, Supabase, GitHub and Vercel plans. No new paid service, automated messaging or card processing.
- UX: target preview’s teal palette, white cards, mobile tabs, desktop sidebar, attendance choices, profile tabs and package catalogue; keyboard access and 320px layout.
- Current feature: [FEAT-004](features/FEAT-004-preview-ui-transition.md). [Current state](PROJECT_STATE.md).
