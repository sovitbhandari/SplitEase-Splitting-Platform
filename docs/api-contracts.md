# API Contracts

This document records the contracts exercised by the Phase 4 reproducible scenario. It is not a production-readiness statement.

## Group Access

- Group reads and writes require a valid JWT and current group membership.
- Unknown groups, unrelated groups, and groups known only through a leaked UUID return `404` for normal group resources.
- Malformed UUIDs return `400` before resource lookup.
- Removed members keep historical financial rows. They cannot read the group, join group socket rooms, create expenses, or start sandbox bank transfers.
- Historical removed debtors may record cash/manual settlement for their own old obligations.

## Expenses

- Currency is currently USD with two decimal places.
- Amounts are parsed strictly; unsupported precision is rejected instead of rounded.
- Expense `paidBy` must match the authenticated user and must be a current group member.
- Split participants must be current group members and cannot be duplicated.
- Equal splits allocate integer cents by quotient/remainder with deterministic user-id ordering.
- Percentage splits use exact percentage units up to four decimal places and largest-remainder allocation.
- Exact splits must sum to the total cents exactly. Zero-share participants are valid.

## Manual Settlement

- `POST /api/groups/:groupId/settlements` requires `Idempotency-Key`.
- The idempotency key is scoped to actor, group, and `manual_settlement`.
- Same key and same canonical body returns the original stored response.
- Same key and different canonical body returns `409`.
- Settlement takes an ordered pair advisory lock before calculating available debt and writing allocation rows.
- Overpayment is rejected; amounts are not silently clamped.
- Settlement rows and ledger history are preserved. Settled expenses cannot be deleted.

## Sandbox Bank Transfer

- Plaid bank transfer endpoints are sandbox-gated. Production money movement is disabled by configuration and should stay disabled for this portfolio project.
- Transfer creation requires `Idempotency-Key`.
- Provider authorization or creation acceptance is not final settlement. Balances are applied only after provider states treated as final by the server state machine.
- Webhooks require Plaid signature verification against the raw request-body hash and are deduplicated by provider event key.
- The UI labels sandbox bank payment flows as simulated and states that no real money is moved.

## Socket Rooms

- `join_group` accepts `{ groupId }` or a group-id string and acknowledges success or failure.
- Joining a group room requires current membership at join time.
- Group update emission revalidates room members and emits `group_access_revoked` before removing unauthorized sockets from the room.
- Reconnected clients must fetch authoritative REST state after joining; socket notifications are latency hints, not the financial source of truth.
