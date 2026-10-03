# Implementation Plan

Date: 2026-10-02

## Repository Baseline

- No `AGENTS.md` was present in the repository paths inspected.
- `git status --short --branch` reported a clean `main...origin/main` working tree before changes.
- Stack confirmed from manifests: npm workspaces with `client/` React/Vite and `server/` Express/TypeScript/Jest, PostgreSQL via raw SQL migrations.
- Database migrations are in [db/migrations](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/db/migrations). Server tests are Jest tests under [server/src/__tests__](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/__tests__).

## Confirmed Defects

### D1: Deleting an Expense Silently Deletes Settlement Records

Anchors:

- [server/src/models/expense.model.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/models/expense.model.ts:119) deletes from `settlements` for all splits on the expense before deleting the expense.
- [db/migrations/009_create_settlements_and_ledger.sql](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/db/migrations/009_create_settlements_and_ledger.sql:1) defines `settlements` as financial history linked to `expense_splits` with `ON DELETE RESTRICT`.
- [server/src/models/settlement.model.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/models/settlement.model.ts:62) records settlement rows and appends ledger entries.

Risk:

- Settlement rows are financial records. Silently deleting them breaks auditability and can make balances/history impossible to explain.
- The schema already expresses a restrictive relationship from settlements to expense splits, but the model bypasses that protection by deleting settlements first.

Chosen contract:

- Expense deletion remains allowed for expenses with no settlement records.
- Expense deletion is rejected with an explicit conflict when any settlement record exists for one of the expense's splits.
- On rejection, no expense, split, settlement, or ledger rows are deleted.

Alternatives considered:

- Soft-delete expenses and keep all rows visible to history. This is a larger UI/API contract change and better suited to a later phase.
- Cascade-delete and write a compensating ledger event. This still removes the authoritative settlement rows and conflicts with the audit requirement.

Migration risk:

- No schema migration is needed for Phase 1 because the database already has `ON DELETE RESTRICT` from settlements to splits.
- Existing invalid data is not deleted. The change only blocks future destructive deletes of settled expenses.

Acceptance checks:

1. Add an API-level regression test that creates an expense, settles part/all of the resulting debt, attempts to delete the original expense, and expects HTTP `409`.
2. The test must query PostgreSQL after the rejected delete and confirm the expense, split, settlement, and ledger rows still exist.
3. Confirm an unsettled expense can still be deleted successfully or is covered by existing behavior.
4. Run the targeted Jest suite against PostgreSQL.
5. Run server typecheck.

### D2: Some Group-Scoped Expense and Settlement Reads Do Not Confirm Membership

Anchors:

- [server/src/controllers/expense.controller.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/controllers/expense.controller.ts:61) reads group expenses after auth but without checking that the user belongs to the group.
- [server/src/controllers/settlement.controller.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/controllers/settlement.controller.ts:20) reads group debts after auth but without checking that the user belongs to the group.
- [server/src/controllers/expense.controller.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/controllers/expense.controller.ts:80) deletes an expense after auth but without checking group membership.

Chosen contract:

- Every group-scoped endpoint verifies group membership before exposing or mutating group data.
- Non-members receive `404` to avoid confirming private group existence.
- Current membership means an active `group_members` row with `removed_at IS NULL`.
- Removed members keep historical rows and may settle their own existing old obligations by cash/manual settlement only. They cannot read full group resources, create expenses, subscribe to group sockets, or start bank transfers.
- Expense payer and split participants must be current group members at expense creation time.
- Settlement `fromUserId` must match the authenticated user, and `toUserId` must be a historical group participant on an existing unsettled debt line.
- Socket room joins validate payload shape, check current membership asynchronously, acknowledge success/failure, and revalidate occupants before group broadcasts.

Migration risk:

- Forward migration `013_soft_removed_group_members.sql` adds nullable `group_members.removed_at` plus an active-member index.
- Existing rows remain current members because `removed_at` defaults to `NULL`.
- The migration does not delete or reinterpret historical expenses, splits, settlements, or ledger rows.

Acceptance checks:

1. Outsider with known group UUID gets `404` for group-scoped REST reads.
2. Another group's member gets `404` for protected resources.
3. Removed member loses full group reads and socket room access.
4. Forged payer, forged split participant, duplicate participant IDs, and invalid UUIDs are rejected before writing expense records.
5. Unauthorized socket joins acknowledge failure and do not subscribe the client to balance updates.
6. Socket room occupants are revalidated and evicted after membership revocation.
7. Removed historical debtor can settle an existing old cash obligation without regaining full group visibility.
8. Full server tests and server typecheck pass against migrated PostgreSQL.

### D3: Plaid Transfer Settlement Application Is Not Atomic Across Payment Status, Settlement Rows, and Ledger Rows

Anchors:

- [server/src/services/plaidTransferService.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/services/plaidTransferService.ts:80) calls `settleDebtBetweenUsers`, then updates `payment_transfers`, then appends a ledger row as separate operations.
- [server/src/models/settlement.model.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/models/settlement.model.ts:4) uses its own transaction internally, which prevents the caller from atomically grouping the payment transfer status update with the settlement write.

Chosen contract for a later phase:

- Applying a successful Plaid transfer should be one database transaction: lock the payment transfer row, verify `settlement_applied=false`, settle the matching debt, mark the transfer applied, and append payment ledger history together.
- Replayed webhooks should be idempotent and should not create duplicate settlement rows.

Migration risk:

- No destructive migration expected.
- Tests should use real PostgreSQL transaction semantics; mocks are not enough for row locking/idempotency proof.

### D4: Floating-Point Expense Splits Can Produce Invalid Monetary Allocations

Anchors:

- [server/src/utils/splitCalculator.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/utils/splitCalculator.ts:24) previously split decimal dollar amounts with `Math.round` and assigned residual to the final input row.
- [server/src/schemas/expense.schema.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/schemas/expense.schema.ts:1) accepted JavaScript numbers without enforcing USD/two-decimal precision.
- [db/migrations/007_create_expenses.sql](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/db/migrations/007_create_expenses.sql:20), [db/migrations/008_create_expense_splits.sql](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/db/migrations/008_create_expense_splits.sql:6), and [db/migrations/009_create_settlements_and_ledger.sql](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/db/migrations/009_create_settlements_and_ledger.sql:6) stored money only as `NUMERIC(12, 2)`.

Risk:

- Tiny equal splits such as `$0.03 / 5` can allocate a negative last share under a round-then-residual algorithm.
- Input-order residual assignment means the same participants can receive different allocations if request order changes.
- Excess precision can be silently rounded by JavaScript/SQL boundaries unless explicitly rejected.

Chosen contract:

- Supported currency starts as USD with exactly two minor units.
- Maximum supported app money value is `999,999,999,999` cents (`$9,999,999,999.99`), below JavaScript's safe integer ceiling.
- Request amounts are strictly parsed from JSON string or finite number input. Unsupported precision, negative values, NaN, Infinity, and over-limit values are rejected.
- Internal allocation uses integer cents. Existing JSON responses remain decimal numbers/strings for client compatibility; BigInt is not serialized over JSON.
- Equal splits use quotient/remainder allocation with deterministic stable user-id ordering.
- Percentage splits accept weights to 4 decimal places, require an exact `100.0000%` total, and allocate by largest remainder with user-id tie-breaking.
- Exact splits accept zero-share participants and require exact cent totals.
- Duplicate participants are rejected.
- Original allocation cents are stored separately from remaining debt cents.

Migration risk:

- Forward migration `014_money_minor_units.sql` adds cent columns for expenses, splits, and settlements, plus `money_migration_anomalies`.
- Existing `NUMERIC(12, 2)` values are backfilled into cent columns without changing historical rows.
- Expense split-sum mismatches and over-settled split anomalies are reported for manual reconciliation. The migration does not delete, rewrite, or reinterpret unexplained financial history.
- The current ledger remains an append-only event log; it is not described as double-entry because it does not maintain balanced debit/credit entries.

Acceptance checks:

1. Unit tests reproduce `$0.03/5`, `$0.01/3`, `$0.02/4`, odd totals, exact zero shares, duplicate people, NaN, negative values, unsupported precision, and exact-total mismatch.
2. Percentage tests cover non-divisible weights and deterministic largest-remainder tie-breaking.
3. Deterministic generated invariant tests with a saved seed assert nonnegative shares and exact sums.
4. Integration tests create tiny expenses through the API and verify stored cent allocations in PostgreSQL.
5. Client build passes after the add-expense UI preserves decimal strings and permits zero exact shares.
6. Full server suite passes against a database migrated through `014`.

### D5: Settlement Retries and Provider Updates Need Durable Serialization

Anchors:

- [server/src/controllers/settlement.controller.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/controllers/settlement.controller.ts:97) previously calculated available debt and wrote settlement history without a durable retry record or pair lock.
- [server/src/services/plaidTransferService.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/services/plaidTransferService.ts:86) previously applied a successful provider transfer through separate transactions for allocation, transfer status, and ledger history.
- [server/src/controllers/plaidWebhook.controller.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/controllers/plaidWebhook.controller.ts:15) previously accepted unsigned webhook bodies and dispatched duplicate events.

Chosen contract:

- Manual settlement requires `Idempotency-Key`, scoped by actor, group, and operation. The canonical request hash is stored for seven days. Same key and payload replays the stored HTTP response; a different payload returns `409`.
- Pair mutations take an ordered PostgreSQL transaction advisory lock before calculating debt. Membership, debt availability, allocation rows, settlement rows, ledger event, and balance outbox event commit together. Overpayment is rejected rather than clamped.
- Plaid transfer creation remains sandbox-gated and requires a caller retry key. The stored transfer request hash and unique key prevent a second durable transfer record; Plaid network calls occur outside database locks.
- Provider acceptance is not treated as final settlement. Only settled/funds-available provider states apply the locked allocation transaction. Signed `Plaid-Verification` JWTs are checked against the raw-body hash and provider JWK; webhook event IDs/body hashes deduplicate repeats while status reads tolerate out-of-order delivery.
- The outbox records committed balance-change notifications. Direct socket emission is post-commit and may lag; reconnecting clients must fetch authoritative balances/debts.

Migration risk:

- Forward migration `015_settlement_idempotency_and_webhook_events.sql` adds retry records, provider event receipts, an outbox, and a request hash on provider transfers. Existing financial rows are retained.
- Idempotency records are retained for seven days; cleanup is operationally required before production use. This phase does not claim universal race freedom or real-money correctness.

Acceptance checks:

1. Real PostgreSQL schedules cover simultaneous full payments, partial overpayment, same-key replay/conflict, rollback, stale clients, recipient removal, and provider replay/out-of-order handling.
2. Assertions prove settled cents never exceed original debt and concurrent duplicate keys produce one durable operation.
3. Webhook tests verify missing/invalid signatures are rejected and valid repeats are acknowledged without duplicate application.
4. Typecheck and client build pass; blocked database/socket runs are recorded without converting them to measurements.

### D6: Demonstrable End-to-End Behavior Needs a Reproducible Scenario

Anchors:

- [server/src/__tests__/endToEndBehavior.test.ts](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/server/src/__tests__/endToEndBehavior.test.ts:1) creates a full PostgreSQL-backed scenario for group creation, invite join, three expense split modes, retry-safe settlement, socket reconnect, and member removal.
- [client/src/components/RecordPaymentModal.tsx](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/client/src/components/RecordPaymentModal.tsx:388) displays payment API failures in an alert region inside the modal.
- [client/src/pages/GroupDetailPage.tsx](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/client/src/pages/GroupDetailPage.tsx:42) maps duplicate/rejected sandbox payment responses to user-facing retry guidance.
- [docs/api-contracts.md](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/docs/api-contracts.md:1) documents the current REST/socket contracts and sandbox boundaries.
- [docs/incidents/settlement-race.md](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/docs/incidents/settlement-race.md:1) records the original settlement race and the actual database lock boundary.

Chosen contract:

- The demonstrable scenario is an integration test, not a seeded demo script. It drives the public REST API for group creation, invite join, expense creation, debts, and manual settlement; it uses Socket.IO for reconnect/revocation behavior; it uses the group access model directly for removal because there is not yet a member-removal REST route.
- Manual settlement replay returns the stored response for the same key/body and returns `409` for the same key with a different body.
- Reconnected sockets must rejoin rooms only after current membership authorization. Removed members receive revocation and lose group read access.
- Plaid transfer UI copy remains explicitly sandbox-labeled; no live payment activity is introduced.

Alternatives considered:

- A browser end-to-end test would prove more visual behavior, but the repository has no browser test harness. Adding one now would add toolchain weight and distract from the financial correctness contract.
- Adding a full admin removal endpoint would make the scenario more purely black-box, but it is a product/API expansion beyond this evidence phase. The limitation is documented instead.

Migration/operation risk:

- The scenario depends on migrations through `015`. Databases that have not applied those migrations will fail before the contract is exercised.
- Socket tests require permission to bind an ephemeral local listener. The current sandbox may block that, so blocked runs must remain `CODE-SUPPORTED`, not `MEASURED`.

Acceptance checks:

1. The scenario creates one group, joins invited members, creates equal/percentage/exact expenses, records a partial cash settlement, retries it with the same idempotency key, rejects a changed body with `409`, reconnects a socket, removes a member, receives revocation, and confirms the removed member receives `404`.
2. Database assertions confirm three expenses exist and settled cents for the scenario do not exceed the original selected debt line.
3. Typecheck, client build, diff whitespace, and focused tests are run. Any PG/socket environmental block is recorded in evidence.
4. API contracts and incident documentation are present and do not claim production readiness, exactly-once external effects, or live money movement.

## Phase Order

1. D1 settled-expense deletion conflict and regression evidence.
2. D2 group membership authorization gaps for REST and sockets.
3. D4 exact money parsing/allocation/storage.
4. D3 atomic/idempotent transfer settlement application.
5. D5 durable retry, locking, webhook authentication, and concurrency evidence.
6. D6 reproducible end-to-end scenario, API contract documentation, and incident note.

## Evidence Rules

- Evidence claims are recorded in [docs/evidence/claims.jsonl](/Users/sovitbhandari/Documents/SplitEase-Splitting-Platform/docs/evidence/claims.jsonl).
- Raw command artifacts for measured checks should be stored under `docs/evidence/<run-id>/`.
- Use `PLANNED`, `CODE-SUPPORTED`, or `MEASURED` literally. A configured target is not a measurement.
- Personal contribution remains pending unless Sovit independently confirms it.
