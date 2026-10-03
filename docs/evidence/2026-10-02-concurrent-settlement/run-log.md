# Concurrent Settlement Evidence

Date: 2026-10-02

## Planned workload

`server/src/__tests__/settlementConcurrency.test.ts` uses the isolated PostgreSQL database configured by the test environment. It schedules two simultaneous full payments, same-key duplicate requests, same-key payload conflict, and two partial payments whose sum exceeds the outstanding debt. It asserts one durable allocation, exact settled cents, replay equality, and no silent clamping.

## Executed checks

- `npm run typecheck --workspace server`: passed.
- `npm run build --workspace client`: passed; Vite transformed 234 modules.
- `git diff --check`: passed.
- `DATABASE_URL=<isolated-local-postgres> npm test --workspace server -- --runInBand`: attempted, not measured. Pure suites passed (split calculator and encryption: 2 suites, 7 tests); database-backed suites failed to connect, and Socket.IO integration setup could not bind an ephemeral listener in the sandbox.

## Limitations

The local PostgreSQL service on port 5433 was not reachable from this sandbox, and the requested elevated retry was unavailable because the approval service reported an account usage limit. Migration `015` and the real-Postgres concurrency schedules therefore remain unmeasured in this run. No provider credentials, live payment calls, or private data were used.
