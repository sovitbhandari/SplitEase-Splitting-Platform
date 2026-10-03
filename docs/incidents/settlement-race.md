# Settlement Race Incident Note

## Summary

Manual settlement originally calculated available debt and then wrote settlement rows without a durable retry record or a per-pair database lock. Two clients could submit overlapping payments at nearly the same time, each reading the same open debt before either write became visible.

## Impact

The defect could over-record cash/manual settlements for a debt pair. It also made client retries ambiguous: a disconnected client could not distinguish "the first request committed" from "the first request was lost."

No live bank payment behavior is claimed here. Plaid transfer work remains Sandbox-only.

## Lock Boundary

The implemented boundary is the group/user-pair being settled:

- Begin one PostgreSQL transaction.
- Insert or lock the idempotency record for actor, group, operation, and key.
- Acquire an ordered transaction-scoped advisory lock for `(group_id, sorted(from_user_id, to_user_id))`.
- Lock the relevant group membership rows.
- Recompute authoritative open debt inside the transaction.
- Reject overpayment.
- Write split allocation updates, settlement rows, ledger history, and balance outbox row atomically.
- Store the durable HTTP response before commit.

This protects the financial record for that pair. It does not claim universal race freedom across unrelated features.

## Retry Protocol

Clients send `Idempotency-Key` for settlement and sandbox transfer creation. Retrying the exact same canonical request returns the stored result. Reusing the key with a different body returns `409`, so clients should generate a new key only when the user intentionally starts a new payment attempt.

## Remaining Limitations

- Outbox delivery recovery is recorded but there is no worker that marks balance events delivered.
- The member-removal action used in the Phase 4 scenario is model-backed; a public admin removal API is not present yet.
- Real PostgreSQL and Socket.IO checks must run in an environment that permits local database connections and listener binding before marking the concurrency and end-to-end claims as measured.
