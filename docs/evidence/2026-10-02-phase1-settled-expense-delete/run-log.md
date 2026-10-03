# Phase 1 Evidence Run Log

Date: 2026-10-02

Commit before changes: `584a891de5c7dcaab46c5ec44a714abdb18b02cf`

Environment:

- Node: `v22.16.0`
- npm: `10.9.2`
- PostgreSQL: Docker Compose `db`, `postgres:15-alpine`, healthy, host port `5433`

Setup commands:

```bash
npm install
docker compose up -d db
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_dev npm run db:migrate
```

Setup notes:

- Initial `npm install` without network access failed with `ENOTFOUND registry.npmjs.org`; rerun with network access succeeded.
- Initial migration command inside the sandbox failed because `tsx` could not create its IPC pipe; rerun outside the sandbox with an explicit local `DATABASE_URL` succeeded.
- Initial Jest run inside the sandbox could not connect to local PostgreSQL; rerun outside the sandbox succeeded.

Migration output:

```text
applied 001_create_users.sql
applied 002_create_refresh_tokens.sql
applied 003_create_email_verifications.sql
applied 004_create_groups.sql
applied 005_create_group_members.sql
applied 006_create_plaid_tables.sql
applied 007_create_expenses.sql
applied 008_create_expense_splits.sql
applied 009_create_settlements_and_ledger.sql
applied 010_add_balance_indexes.sql
applied 011_update_ledger_guard.sql
applied 012_payment_transfers.sql
```

Check: focused regression

```bash
npm test -w server -- --runTestsByPath src/__tests__/expenseDeletion.test.ts
```

Output:

```text
PASS src/__tests__/expenseDeletion.test.ts
  Expense deletion audit behavior
    ✓ deletes an unsettled expense and records the deletion in the ledger (461 ms)
    ✓ rejects deletion of an expense with settlement history and preserves audit rows (427 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.682 s, estimated 2 s
Ran all test suites within paths "src/__tests__/expenseDeletion.test.ts".
```

Check: server typecheck

```bash
npm run typecheck -w server
```

Output:

```text
> splitease-server@0.0.1 typecheck
> tsc --noEmit
```

Check: full server test suite

```bash
npm test -w server
```

Output:

```text
PASS src/__tests__/paymentTransfer.test.ts
PASS src/__tests__/auth.test.ts
PASS src/__tests__/encryption.test.ts
PASS src/__tests__/expenseDeletion.test.ts

Test Suites: 4 passed, 4 total
Tests:       19 passed, 19 total
Snapshots:   0 total
Time:        5.031 s
Ran all test suites.
```

Limitations:

- Dependency audit findings from `npm install` were observed but not remediated in this phase.
