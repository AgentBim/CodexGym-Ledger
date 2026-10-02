# ADR-002 — Preview-led UI and confirmation before production merge

- Date: 2026-10-02. ACCEPTED for implementation and release workflow.
- Authority: Founder said “bring the app up to the new UI/UX” and “i prefer a PR-confirmation merge style of production”; clarified “the goal is to get the app looking like the preview . build out the backend to suit”.
- Target: https://chalktab-git-claude-relaxed-me-2fc800-jelanis-projects-19609d5d.vercel.app/ . Components come from `origin/claude/relaxed-meitner-94q5kz`; its in-memory demo store is not the production backend.
- Implement on current main, retaining auth/accounting. Add owner-scoped package definitions, assigned snapshots, signed adjustments, class settings and attendance marks. Tests use synthetic data.
- Use one branch and one PR. No new agents dispatched. Earlier five draft workstreams are not the implementation plan for this transition.
- Production workflow: implementation → author checks → PR review and independent verification → explicit Founder confirmation of revision and migration/release scope → merge/deploy. Do not enable auto-merge. A PR or continuation request does not authorize production schema changes.
- Recovery must preserve new financial/audit rows and readers that include adjustments. No destructive rollback or reverting to incompatible balance calculations.
