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
| 3 — Activity and mobile | `codex/ux-release-3-activity` | `621cd65` / `chalktab-ux-release-3` | `dpl_ESTrcRQgLkXS1HCXgAGtxdSerJss` | `chalktab-d21clt0rp-jelanis-projects-19609d5d.vercel.app` |
| 4 — Navigation continuity | `codex/ux-release-4-navigation` | `92e16a1` / `chalktab-ux-release-4` | `dpl_2iGkY3HYaTYf3ut5YWvBgTTQVKV3` | `chalktab-9temam9kv-jelanis-projects-19609d5d.vercel.app` |

### Release 4 safe-area patch

- Commit/tag: `f111ecf` / `chalktab-ux-release-4-safe-area`
- Preview deployment: `dpl_ENtZao54LnNVb82kTECakGbD6QRm`
- Preview URL: `chalktab-ekrlvyjv8-jelanis-projects-19609d5d.vercel.app`
- Production remains unchanged pending physical iPhone verification.

## Current production

- Release 3 plus audit/auth fix deployment: `dpl_FXHfnVn9cevNW5teAoA3dYeYRJYH`
- Immutable deployment URL: `chalktab-6uru5dbu3-jelanis-projects-19609d5d.vercel.app`
- Production alias: `chalktab.vercel.app`
- Production remains on the separated-login build while Release 4 is validated as a protected preview.

## Rollback procedure

1. For a UI defect, reassign `chalktab.vercel.app` to the previous READY production deployment.
2. For release dissatisfaction, restore the alias to baseline deployment `dpl_8CqGT67zGkssQSYq6vZJGfNzccF6`.
3. For code rollback, create a new `codex/` branch from `a7c1242`; do not rewrite a shared branch.
4. For a database issue, deploy baseline code so the additive RPCs are unused. Keep the additive migrations unless a separately reviewed compensating migration is required.

Never delete corrected entries, generated sessions, audit records, or user data during rollback.
