# Benchmark Results

This file is appended by benchmark runs. Do not move a claim from `PLANNED` to numerical resume wording unless the raw run artifacts and `metadata.json` exist.

## SplitEase DB-Backed Experiments

Status: MEASURED for the listed local synthetic runs

- Runs used a disposable `splitease_bench` PostgreSQL database migrated through `015`.
- The generator and Express app ran in one local Node process through Supertest; PostgreSQL was external through `DATABASE_URL`.
- These are closed-loop local synthetic runs, not requests-per-second capacity guarantees.
- One failed exploratory balance run is preserved at `docs/benchmarks/runs/2026-10-03T02-33-21-300Z-splitease-balance-api/metadata.json`.

## 2026-10-03T02-24-19-237Z-splitease-allocation - SplitEase Allocation Correctness

Status: MEASURED

- Seed: `1592598566`
- Valid generated cases: 10285
- Invalid generated cases: 1715
- Passed cases: 12000
- Failed cases: 0
- Latency summary is for local in-process allocation checks only: p50 0.0026 ms, p95 0.0057 ms, p99 0.0090 ms.
- Raw artifacts: `docs/benchmarks/runs/2026-10-03T02-24-19-237Z-splitease-allocation/raw/allocation-results.jsonl`, `docs/benchmarks/runs/2026-10-03T02-24-19-237Z-splitease-allocation/allocation-summary.json`, `docs/benchmarks/runs/2026-10-03T02-24-19-237Z-splitease-allocation/metadata.json`

This is correctness testing, not 10k successful financial transactions.

## 2026-10-03T02-32-56-973Z-splitease-concurrency - SplitEase Settlement Concurrency

Status: MEASURED

- Workload: barrier-style concurrent manual settlement requests against real PostgreSQL with synthetic two-person groups, duplicate idempotency keys, and competing overpayments.
- Levels/repetitions: 2, 10, and 50 concurrent requests, 3 repetitions each.
- Level 2 totals: 3 successful `200` responses, 3 expected conflict/rejection responses, 0 unexpected errors; every repetition persisted exactly 1 settlement row and 4,999 settled cents.
- Level 10 totals: 3 successful `200` responses, 27 expected conflict/rejection responses, 0 unexpected errors; every repetition persisted exactly 1 settlement row and 4,999 settled cents.
- Level 50 totals: 5 successful `200` responses, 145 expected conflict/rejection responses, 0 unexpected errors; every repetition persisted exactly 1 settlement row and 4,999 settled cents.
- p95 response latencies by repetition: level 2 = 20.77/9.99/9.32 ms, level 10 = 46.47/29.80/27.61 ms, level 50 = 105.96/96.40/94.21 ms.
- Raw artifacts: `docs/benchmarks/runs/2026-10-03T02-32-56-973Z-splitease-concurrency/concurrency-summary.json`, `docs/benchmarks/runs/2026-10-03T02-32-56-973Z-splitease-concurrency/raw/concurrency-results.jsonl`, `docs/benchmarks/runs/2026-10-03T02-32-56-973Z-splitease-concurrency/metadata.json`

Expected `400`/`409` responses are not corruption; they are reported explicitly as rejected overpayments or idempotency conflicts/replays.

## 2026-10-03T02-33-42-402Z-splitease-balance-api - SplitEase Balance Endpoint and Query Plans

Status: MEASURED

- Workload: seeded synthetic groups with 10 participants and 100/1,000/5,000 expenses; authenticated `GET /api/groups/:groupId/expenses` reads; authorization checked for every seeded group; query plans captured with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.
- 100 expenses: 30/30 responses were `200`; p50/p95/p99 endpoint latency = 6.68/8.18/8.18 ms.
- 1,000 expenses: 30/30 responses were `200`; p50/p95/p99 endpoint latency = 64.50/67.04/67.32 ms.
- 5,000 expenses: 30/30 responses were `200`; p50/p95/p99 endpoint latency = 26.63/28.43/28.49 ms.
- Raw artifacts: `docs/benchmarks/runs/2026-10-03T02-33-42-402Z-splitease-balance-api/balance-summary.json`, `docs/benchmarks/runs/2026-10-03T02-33-42-402Z-splitease-balance-api/raw/balance-api-latencies.jsonl`, `docs/benchmarks/runs/2026-10-03T02-33-42-402Z-splitease-balance-api/raw/balance-query-plans.json`, `docs/benchmarks/runs/2026-10-03T02-33-42-402Z-splitease-balance-api/metadata.json`

These numbers are local synthetic endpoint timings. They do not claim production latency or capacity.

## 2026-10-03T02-25-00-580Z-splitease-allocation - SplitEase Allocation Correctness

Status: MEASURED

- Seed: `1592598566`
- Valid generated cases: 10285
- Invalid generated cases: 1715
- Passed cases: 12000
- Failed cases: 0
- Latency summary is for local in-process allocation checks only: p50 0.0027 ms, p95 0.0058 ms, p99 0.0088 ms.
- Raw artifacts: `docs/benchmarks/runs/2026-10-03T02-25-00-580Z-splitease-allocation/raw/allocation-results.jsonl`, `docs/benchmarks/runs/2026-10-03T02-25-00-580Z-splitease-allocation/allocation-summary.json`, `docs/benchmarks/runs/2026-10-03T02-25-00-580Z-splitease-allocation/metadata.json`

This is correctness testing, not 10k successful financial transactions.

## 2026-10-03T02-25-55-709Z-splitease-allocation - SplitEase Allocation Correctness

Status: MEASURED

- Seed: `1592598566`
- Valid generated cases: 10285
- Invalid generated cases: 1715
- Passed cases: 12000
- Failed cases: 0
- Latency summary is for local in-process allocation checks only: p50 0.0036 ms, p95 0.0105 ms, p99 0.0155 ms.
- Raw artifacts: `docs/benchmarks/runs/2026-10-03T02-25-55-709Z-splitease-allocation/raw/allocation-results.jsonl`, `docs/benchmarks/runs/2026-10-03T02-25-55-709Z-splitease-allocation/allocation-summary.json`, `docs/benchmarks/runs/2026-10-03T02-25-55-709Z-splitease-allocation/metadata.json`

This is correctness testing, not 10k successful financial transactions.
