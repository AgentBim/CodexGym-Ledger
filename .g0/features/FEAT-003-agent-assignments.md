# FEAT-003: Authorized PR workstreams

- Date / coordinator: 2026-09-22 / G0-00.
- Founder instruction: "create PRs for 1-5 and assign agents to work on each" following the five-slice redesign/backend plan.
- Authorization: Implement the five proposed slices in branches and create reviewable PRs, including additive class/time scheduling and synthetic verification. No merge, hosted schema application, production deployment, paid service or customer-data access is authorized.
- Inputs: FEAT-003 proposal; current source `1b39c69e002eb1a924541905dfe70d10ccb0c84c`; pinned G0 Core. Existing PRs #5 and #6 overlap retries and quick actions and are references, not presumed verified dependencies.
- State: BUILDING for branch-local candidates. Independent verification is required before READY. No release claim.
- Accepted implementation defaults for this scope: online-only writes with retained drafts; Attended is display text for held; per-student occurrence cancellation; preserve existing overdue semantics with a separate 14-day warning; advisory duplicate detection; existing individual statements; additive scheduling with no speculative historical backfill.
- Shared restrictions: separate worktrees; pinned dependencies; no secrets/customer data in records; no production queries/writes; preserve ledger/audit history. Agents own only their assigned worktree and evidence file. Stop and report if required execution crosses these boundaries. No further delegation without coordinator assignment.

| Task | Role / agent assignment | Objective and acceptance | Output / dependencies |
| --- | --- | --- | --- |
| R01 | Contracts engineer / contracts | Typed outcomes; stable immutable retry attempts; honest save/offline/Undo state; date/read completeness; meaningful tests | `codex/redesign-01-contracts`, `.g0/qa/FEAT-003-R01.md`; source base above |
| R02 | Frontend engineer / ui (queued) | New theme/icons/filter and contextual actions using R01 contracts; preserve existing workflows; component/browser checks | `codex/redesign-02-ui`; starts after R01 |
| R03 | Database/backend engineer / scheduling | Additive owner-safe class/time/enrollment/occurrence model, audited writes, occurrence attendance and generation; ADR and synthetic checks | `codex/redesign-03-scheduling`, `.g0/qa/FEAT-003-R03.md`; independent schema slice |
| R04 | Backend engineer / recap | Typed warnings, event feed, selected-day semantics, server-enforced review freshness; meaningful tests | `codex/redesign-04-recap`, `.g0/qa/FEAT-003-R04.md`; coordinate read-type overlap with R01 |
| R05 | Independent verifier / verification (queued) | Inspect actual combined candidates, add synthetic verification harness/evidence and release checklist; report genuine pass/fail/unverified | `codex/redesign-05-verification`; depends on R01-R04; must not author their product implementation |

- Tools/access: local source, synthetic tests, official technical documentation, Git branches and requested PR publishing only. New migration files do not authorize applying them to hosted databases.
- Review owner: R05 independent agent for R01-R04; G0-00 reviews verification artifacts and coordinates fixes. No agent self-certifies their feature READY.
- Timebox/stop: one implementation and verification cycle per slice; report concrete environment blockers instead of substituting static checks for integration evidence.
- Handoff: agents return exact changed files, check results, residual limitations and commit/candidate to G0-00. G0-00 publishes PRs, records links/dependencies and preserves draft status while checks are incomplete.
