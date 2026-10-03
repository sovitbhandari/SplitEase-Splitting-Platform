# Phase 4 End-to-End Behavior Run Log

Date: 2026-10-02

Commit SHA at implementation time: `584a891de5c7dcaab46c5ec44a714abdb18b02cf`

## Scope

- Reproducible PostgreSQL-backed scenario added in `server/src/__tests__/endToEndBehavior.test.ts`.
- Scenario covers group creation, invite joins, equal/percentage/exact expenses, partial manual settlement, same-key retry, same-key changed-body rejection, socket reconnect, member removal, revocation, and removed-member read denial.
- Client payment modal now surfaces rejected/duplicate sandbox payment failures in an alert region.
- API contract and settlement race incident notes added.

## Commands

Commands are recorded after execution in this run. Environmental blocks remain blocks, not measurements.

### `npm run typecheck --workspace server`

Result: passed.

Output summary:

- `tsc --noEmit` completed successfully.

### `npm run build --workspace client`

Result: passed.

Output summary:

- TypeScript project build completed.
- Vite transformed 234 modules and built `dist`.
- Browserslist reported stale caniuse-lite data; this did not fail the build.

### `git diff --check`

Result: passed.

Output summary:

- No whitespace errors reported.

### `npm test --workspace server -- --runInBand --runTestsByPath src/__tests__/splitCalculator.test.ts src/__tests__/encryption.test.ts`

Result: passed.

Output summary:

- `src/__tests__/splitCalculator.test.ts` passed.
- `src/__tests__/encryption.test.ts` passed.
- 2 suites passed, 7 tests passed.

### `DATABASE_URL=<isolated-local-postgres> npm test --workspace server -- --runInBand --runTestsByPath src/__tests__/endToEndBehavior.test.ts`

Result: blocked by local runtime restrictions.

Output summary:

- The Socket.IO setup could not bind an ephemeral listener: `listen EPERM: operation not permitted 0.0.0.0`.
- The database reset could not connect to local PostgreSQL and raised `AggregateError` from `pg-pool`.
- The test did not reach its contract assertions.
- After tightening the listener helper, the blocked run fails fast in about one second instead of timing out the hook.

Escalated retry:

- Requested because this check needs local PostgreSQL access and ephemeral listener binding.
- Rejected by the approval reviewer because the test reset helper deletes rows from the target database and the transcript does not prove that database is disposable.
- No workaround was attempted.
