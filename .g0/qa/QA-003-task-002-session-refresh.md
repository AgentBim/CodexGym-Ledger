# QA-003: TASK-002 controlled session-refresh integration

- Feature / acceptance criteria source: [FEAT-001 TASK-002](../features/FEAT-001-production-foundation.md#assignment-task-002-controlled-session-refresh-integration).
- Implementer: Engineering lead acting as G0-04.
- Verifier / independence declaration: Independent agent acting as G0-09; did not author the implementation and independently inspected and tested the exact source/test candidate.
- Candidate identification: Branch `codex/g0-production-foundation-integration`, based on `ce4f0ae7d9ab44fa153c24f54f8f1bff8a32ea1d`; ordered four-file source/test SHA-256 manifest digest `eadf29a6c243807c92dcb9fb5d95f65c3a6b67c0baa1f0b8044f1ad57e5cbccc`.
- Environment / prerequisites / date: Local ChalkTab repository with pinned dependencies, Node.js/Next.js 16.2.12, Windows/PowerShell, 2026-09-13.

| Criterion / check | Expected | Actual | Status | Evidence |
| --- | --- | --- | --- | --- |
| Anonymous bypass and headers | Anonymous requests avoid Auth refresh while retaining CSP and forwarded request headers | Refresh mock was not called; nonce and CSP remained on forwarded/response headers | PASS | `proxy.test.ts`; independent focused test run |
| Authenticated cookie refresh | Unchunked and chunked project cookies invoke refresh | Non-empty exact and `.0` cookies invoked the refresh path in helper and app-proxy tests | PASS | Both focused test files |
| Invalid-cookie bypass | Empty, malformed-project, and other-project cases avoid refresh | All cases bypassed refresh | PASS | Both focused test files |
| Narrow integration | Preserve current UI/auth/ledger behavior and exclude unrelated remote changes | Diff contains two proxy files, two focused test files, and G0 evidence only; prototype UI and `vitest.setup.ts` changes were not ported; no dependency, lockfile, migration, or environment-file diff | PASS | Independent diff from `ce4f0ae`; full regression run |
| Verification suite | Focused tests, typecheck, lint, full tests, and production build pass | Focused 2 files/12 tests; typecheck PASS; ESLint PASS with zero warnings; full Vitest 8 files/49 tests; Next.js production build PASS; whitespace check PASS | PASS | Independent command run |
| Independent gate | G0-09 verifies the exact candidate | Digest independently reproduced and all criteria passed | PASS | Independent G0-09 review in originating Codex task |

- Defects: None blocking.
- Residual risks: Supabase refresh is mocked rather than exercised in an authenticated browser/isolated Preview. Cookie matching permits any non-empty suffix after the project cookie name, which may cause a harmless extra refresh for an unusual cookie but does not authorize access. Protected-branch exact-SHA CI remains outstanding.
- Scope and mutation confirmation: Verification changed no source, refs, dependencies, configuration, migrations, or external state. No Preview, database, deployment, production, or alias action occurred.
- Verdict: PASS for TASK-002 only. FEAT-001 remains BUILDING and blocked on its remaining production-foundation criteria.
- Next action / owner: G0-00 records and publishes the reviewed branch commit for pull-request review; production gates remain pending.
