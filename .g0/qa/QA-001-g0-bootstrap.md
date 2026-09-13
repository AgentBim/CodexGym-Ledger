# QA-001: G0 product bootstrap

- Feature / acceptance criteria source: Small operational bootstrap recorded in [PROJECT_STATE.md](../PROJECT_STATE.md) and authorized by [ADR-001](../decisions/ADR-001-adopt-ground-zero.md).
- Implementer: G0-00 (Codex)
- Verifier / independence declaration: Temporary engineering reviewer `G0-X-001`; did not author the bootstrap files and inspected the actual product artifacts against pinned G0 Core.
- Candidate revision / digest: Product-local bootstrap on branch `codex/g0-project-002-bootstrap`, with underlying application starting revision `22d4bce`; SHA-256 bundle manifest digest `3c9516ce6043645b301095481b1f59cebc78967737de4bbf23d2e373ee1b768c`. The digest covers root `AGENTS.md`, PROJECT, PROJECT_STATE, ROADMAP, ADR-001, FEAT-001, FEAT-002, and REL-001 as independently accepted on 2026-09-13.
- Environment / prerequisites / date: Local ChalkTab repository, private G0 Core checkout pinned at `3ffccfc6eeec70efcc480443204850ee22bb1312`, Windows/PowerShell, 2026-09-13.
- Independent review reference: `G0-X-001` review in the originating Codex task. Initial verdict CHANGES_REQUIRED; corrected candidate re-reviewed twice; final verdict PASS after removal of the last unsupported evidence claim.

| Criterion / check | Steps or command | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Core pin | Compare product AGENTS/PROJECT pin with checked-out Core HEAD | Exact immutable Core revision | Both identify `3ffccfc6eeec70efcc480443204850ee22bb1312` | PASS | [AGENTS.md](../../AGENTS.md), [PROJECT.md](../PROJECT.md) |
| Required product structure | Inspect `.g0` for PROJECT, PROJECT_STATE, ROADMAP, decisions, features, QA, and releases | Required records/directories exist | Structure exists and is populated with product-local records | PASS | `.g0/` candidate bundle |
| Template completion | Search product G0 records for unresolved template placeholders | No unowned placeholders or fabricated values | Placeholders removed; unknowns have owners/next actions | PASS | Author search plus independent review |
| Link integrity | Resolve every relative Markdown link in root AGENTS and `.g0` records | All relative links resolve | Custom link check returned `G0_PRODUCT_LINKS=PASS` | PASS | Author-check output in Codex task |
| Founder gates | Review approval records and product/release states against Core Founder Gates | Exact scope, source, risk, evidence, conditions, expiry, and pending gates recorded | ADR-001 and FEAT-002 contain scoped approval records; production/paid/destructive/significant gates remain pending | PASS | [ADR-001](../decisions/ADR-001-adopt-ground-zero.md), [FEAT-002](../features/FEAT-002-client-account-statements.md) |
| Honest state and release claims | Compare PROJECT_STATE, features, and REL-001 with Core state/release protocols | No unsupported READY/RELEASED/SUCCEEDED claim | FEAT-001 is SPECIFIED, FEAT-002 is REVIEW, REL-001 is PLANNED | PASS | [PROJECT_STATE](../PROJECT_STATE.md), [REL-001](../releases/REL-001-production-baseline.md) |
| Ownership/delegation | Check future role statements against Delegation protocol | Unassigned work is clearly proposed | No production-foundation assignment is active; future owners are proposed and require complete delegation | PASS | [FEAT-001](../features/FEAT-001-production-foundation.md) |
| Evidence accuracy | Cross-check live remote main versus local tracking ref and remove unsupported evidence | Sources disambiguated; no nonexistent evidence cited | Live `ls-remote` and stale `origin/main` are distinguished; unsupported manifest claim removed | PASS | [PROJECT_STATE](../PROJECT_STATE.md), [ADR-001](../decisions/ADR-001-adopt-ground-zero.md) |

- Additional risk-based checks / justified N/A: Secret-like values were not found by the independent reviewer. Runtime, database mutation, and production smoke testing are N/A because this candidate changes governance documentation only and makes no feature/release completion claim.
- Defects: Initial review found four documentation-control defects: invalid/overstated release status, incomplete approval evidence, proposed roles phrased as assigned, and ambiguous remote-main evidence. Follow-up found one unsupported manifest claim. The first staged whitespace check also found three trailing blank lines. All were corrected before final PASS.
- Residual risk disposition / authority: Product risks remain in FEAT-001/FEAT-002 and are not accepted by this QA result. No authority beyond the Founder-approved G0 bootstrap is granted.
- Limitations and untested behavior: QA does not verify ChalkTab runtime behavior, Release 5 statements, authenticated flows, Preview isolation, recovery, or any production deployment.
- Verdict: PASS for the G0 product bootstrap documentation bundle only.
- Next action / owner: G0-00 commits the accepted bootstrap files on a dedicated branch, then records the exact commit in PROJECT_STATE without changing product feature states.
