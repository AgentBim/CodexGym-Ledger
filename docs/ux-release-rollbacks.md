# ChalkTab UX release and rollback record

## Immutable baseline

- Commit: `a7c1242` (`chalktab-ux-baseline-a7c1242`)
- Production deployment: `dpl_8CqGT67zGkssQSYq6vZJGfNzccF6`
- Deployment URL: `chalktab-6jikp20g4-jelanis-projects-19609d5d.vercel.app`
- Production alias: `chalktab.vercel.app`
- Database baseline: `20260804055004_initial_gym_ledger_schema.sql`, `20260804055140_cover_composite_foreign_keys.sql`

## Release records

| Release | Branch | Commit/tag | Preview deployment | Preview URL |
| --- | --- | --- | --- | --- |
| 1 — Ledger integrity | `codex/ux-release-1-ledger` | `c3169c9` / `chalktab-ux-release-1` | `dpl_8yndgCUgeapmJWFPDtpxajdJDXQw` | `chalktab-r0ce421ug-jelanis-projects-19609d5d.vercel.app` |
| 2 — Template safety | `codex/ux-release-2-scheduling` | `5f76313` / `chalktab-ux-release-2` | `dpl_3tUAzPdFqMnQEmydKWY68Z8imjw1` | `chalktab-e39ds5nxm-jelanis-projects-19609d5d.vercel.app` |
| 3 — Activity and mobile | `codex/ux-release-3-activity` | Recorded after verification | Recorded after verification | Recorded after verification |

## Rollback procedure

1. For a UI defect, reassign `chalktab.vercel.app` to the previous READY production deployment.
2. For release dissatisfaction, restore the alias to baseline deployment `dpl_8CqGT67zGkssQSYq6vZJGfNzccF6`.
3. For code rollback, create a new `codex/` branch from `a7c1242`; do not rewrite a shared branch.
4. For a database issue, deploy baseline code so the additive RPCs are unused. Keep the additive migrations unless a separately reviewed compensating migration is required.

Never delete corrected entries, generated sessions, audit records, or user data during rollback.
