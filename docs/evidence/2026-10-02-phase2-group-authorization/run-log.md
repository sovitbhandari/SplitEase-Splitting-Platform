# Phase 2 Evidence Run Log

Date: 2026-10-02

Commit before changes: `584a891de5c7dcaab46c5ec44a714abdb18b02cf`

Environment:

- Node: `v22.16.0`
- npm: `10.9.2`
- PostgreSQL: Docker Compose `db`, `postgres:15-alpine`, host port `5433`
- Isolated test database: `splitease_authz_test_20261002`

Setup commands:

```bash
docker compose exec -T db createdb -U splitease splitease_authz_test_20261002
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_authz_test_20261002 npm run db:migrate
```

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
applied 013_soft_removed_group_members.sql
```

Check: focused group authorization regression

```bash
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_authz_test_20261002 npm test -w server -- --runTestsByPath src/__tests__/groupAuthorization.test.ts
```

Output:

```text
PASS src/__tests__/groupAuthorization.test.ts
  group resource authorization policy
    ✓ returns 404 for outsiders and members of another group with a known group UUID (672 ms)
    ✓ returns 400 for malformed group UUIDs before querying group resources (212 ms)
    ✓ rejects forged payers, forged split participants, duplicate participants, and invalid UUIDs (616 ms)
    ✓ blocks removed members from group reads and sockets while allowing settlement of old obligations (435 ms)
    ✓ acknowledges socket authorization failures and does not subscribe unauthorized clients (562 ms)
    ✓ evicts sockets when current membership is revoked (599 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        4.128 s
Ran all test suites within paths "src/__tests__/groupAuthorization.test.ts".
```

Check: full server test suite

```bash
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_authz_test_20261002 npm test -w server
```

Output:

```text
PASS src/__tests__/groupAuthorization.test.ts
PASS src/__tests__/auth.test.ts
PASS src/__tests__/paymentTransfer.test.ts
PASS src/__tests__/expenseDeletion.test.ts
PASS src/__tests__/encryption.test.ts

Test Suites: 5 passed, 5 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        7.92 s, estimated 9 s
Ran all test suites.
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

Limitations:

- This phase adds a soft-removal database state and model helper but does not expose a new member-removal REST endpoint.
- The isolated test database remains in the local Docker Postgres container.
- Plaid Transfer remains behind existing sandbox/live-money feature gates; this phase did not add live payment behavior.
