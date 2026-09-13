# Roadmap

Priorities are proposals unless supported by a recorded authorization. Dates are forecasts unless explicitly committed.

| Priority | Outcome / feature link | Success measure | Dependencies | State | Owner | Horizon |
| --- | --- | --- | --- | --- | --- | --- |
| P0.1 | [Reproducible production foundation](features/FEAT-001-production-foundation.md) | Remote protected branch, clean CI-proven release SHA, canonical alias and rollback target recorded | GitHub access; release reconciliation | SPECIFIED | G0-04 / G0-11 | Now |
| P0.2 | Isolated Preview data | Preview cannot read or write production; migrations reproduce cleanly | Supabase environment proposal; Founder approval if cost/privacy boundary changes | PROPOSED | G0-07 / G0-11 | Now |
| P0.3 | Retry-safe ledger mutations | Every mutation reuses one idempotency key through uncertain retries; lost-response tests create no duplicates | Integration harness | PROPOSED | G0-06 / G0-09 | Now |
| P0.4 | Verified recovery | RPO/RTO, owner, backup method, and disposable restore reconciliation recorded | Plan capability and cost decision | PROPOSED | G0-07 / G0-11 | Now |
| P0.5 | Auth and runtime hardening | Leaked-password protection disposition, canonical-origin allowlist, CSP evidence, and 24-hour error-free soak | Security review; authenticated test account | PROPOSED | G0-10 / G0-09 | Now |
| P0.6 | [Client account statements](features/FEAT-002-client-account-statements.md) | Exact ledger reconciliation and accessible unclipped A4/iPhone PDF on verified candidate | Independent review and QA; explicit production approval | REVIEW | G0-05 / G0-09 / G0-11 | Now |
| P1.1 | Schedule-driven Today with explicit walk-ins | Ten-person class confirmed in under 60 seconds without charging an unscheduled client accidentally | Product definition and design | PROPOSED | G0-01 / G0-03 / G0-05 | Next |
| P1.2 | Changed-since-review day status | Any later relevant mutation visibly reopens the reviewed day | Version-boundary design | PROPOSED | G0-01 / G0-06 / G0-09 | Next |
| P1.3 | Better payment evidence | Optional reference/notes and immutable receipt reference appear in history and statements | Data/UX review; additive migration decision | PROPOSED | G0-01 / G0-07 / G0-05 | Next |
| P1.4 | Client-ready statement identity | Business/contact/dispute/payment details and safe manual delivery procedure | Gym profile decision; qualified local guidance for regulated claims | PROPOSED | G0-01 / G0-13 | Next |
| P2.1 | Concierge pilot and support | One design partner completes a week with zero unexplained discrepancies, then 3-5 matched coaches | P0 gates; support owner; feedback log | PROPOSED | Founder / G0-12 / G0-13 | Later |

## Scope decisions

- G0 adoption and Project 002 identity are accepted in [ADR-001](decisions/ADR-001-adopt-ground-zero.md).
- Existing feature scope and non-negotiable ledger constraints remain in [PROJECT.md](PROJECT.md) and [product requirements](../docs/product-requirements.md).
- Multi-coach, multi-location, packages, payments processing, automated messaging, and client portals remain deferred pending pilot evidence and separate Founder direction.
