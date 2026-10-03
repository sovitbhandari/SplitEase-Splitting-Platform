# Exact Money Evidence Run Log

Date: 2026-10-02

Commit before changes: `584a891de5c7dcaab46c5ec44a714abdb18b02cf`

Environment:

- Node: `v22.16.0`
- npm: `10.9.2`
- PostgreSQL: Docker Compose `db`, `postgres:15-alpine`, host port `5433`
- Isolated test database: `splitease_authz_test_20261002`

Setup command:

```bash
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_authz_test_20261002 npm run db:migrate
```

Migration output:

```text
skip 001_create_users.sql (already applied)
skip 002_create_refresh_tokens.sql (already applied)
skip 003_create_email_verifications.sql (already applied)
skip 004_create_groups.sql (already applied)
skip 005_create_group_members.sql (already applied)
skip 006_create_plaid_tables.sql (already applied)
skip 007_create_expenses.sql (already applied)
skip 008_create_expense_splits.sql (already applied)
skip 009_create_settlements_and_ledger.sql (already applied)
skip 010_add_balance_indexes.sql (already applied)
skip 011_update_ledger_guard.sql (already applied)
skip 012_payment_transfers.sql (already applied)
skip 013_soft_removed_group_members.sql (already applied)
applied 014_money_minor_units.sql
```

Anomaly summary on isolated test database:

```text
 anomaly_type | count
--------------+-------
(0 rows)
```

Check: split allocation unit tests

```bash
npm test -w server -- --runTestsByPath src/__tests__/splitCalculator.test.ts
```

Output:

```text
PASS src/__tests__/splitCalculator.test.ts
  calculateSplits exact money allocation
    ✓ reproduces tiny equal split edge cases without negative shares (1 ms)
    ✓ uses stable user-id ordering independent of input permutation (1 ms)
    ✓ allocates percentage splits by largest remainder with deterministic ties (4 ms)
    ✓ accepts exact zero shares when totals match exactly
    ✓ rejects duplicates, unsupported precision, negative values, NaN, and invalid totals (5 ms)
    ✓ preserves invariants for deterministic generated cases (17 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
```

Generated invariant seed:

- Seed literal: `0x5eedeed`
- Provenance: manually chosen and saved in `server/src/__tests__/splitCalculator.test.ts`
- Generated cases: 200 equal allocations and up to 200 percentage allocations, depending on generated valid percentage totals.

Check: expense money API/PostgreSQL integration

```bash
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_authz_test_20261002 npm test -w server -- --runTestsByPath src/__tests__/expenseMoney.test.ts
```

Output:

```text
PASS src/__tests__/expenseMoney.test.ts
  expense money validation and storage
    ✓ stores $0.03 split across 5 people as nonnegative cents that sum exactly (1052 ms)
    ✓ accepts exact zero-share participants and rejects unsupported precision (622 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
```

Check: full server test suite

```bash
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_authz_test_20261002 npm test -w server
```

Output:

```text
PASS src/__tests__/groupAuthorization.test.ts
PASS src/__tests__/expenseMoney.test.ts
PASS src/__tests__/auth.test.ts
PASS src/__tests__/paymentTransfer.test.ts
PASS src/__tests__/expenseDeletion.test.ts
PASS src/__tests__/splitCalculator.test.ts
PASS src/__tests__/encryption.test.ts

Test Suites: 7 passed, 7 total
Tests:       33 passed, 33 total
Snapshots:   0 total
Time:        9.852 s, estimated 11 s
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

Check: client build

```bash
npm run build -w client
```

Output excerpt:

```text
✓ 234 modules transformed.
✓ built in 642ms
```

Limitations:

- The client has no configured unit test runner; zero-share UI behavior was validated by TypeScript/Vite build plus server integration tests.
- Existing API responses still return decimal numbers/strings for compatibility, while storage and allocation use cent columns.
- `money_migration_anomalies` provides anomaly reporting and reconciliation notes, not automated correction.
