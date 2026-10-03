# Resume Candidates

Use only bullets backed by raw artifacts and `metadata.json`.

## Planned Qualitative Bullets

- Built an evidence-producing benchmark harness for SplitEase with synthetic seeded allocation cases, retry/concurrency schedules, balance endpoint timing, query plans, metadata capture, and artifact retention.

## Measured Candidate Bullets

- Validated SplitEase allocation correctness over 10,285 valid and 1,715 invalid local seeded synthetic cases, checking exact cent conservation and deterministic equal/percentage/exact allocation with raw artifact metadata.
- Stress-tested retry-safe manual settlement on local PostgreSQL with 2/10/50 concurrent synthetic requests across 9 repetitions, preserving one persisted settlement per run and reporting 175 expected conflict/rejection responses with 0 unexpected errors.
- Benchmarked authenticated SplitEase group expense reads on local synthetic datasets up to 5,000 expenses and 10 participants, capturing endpoint percentiles and PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` plans.

## Disallowed Until Measured

- Do not claim requests-per-second capacity from closed-loop users.
- Do not call allocation cases real users or financial transactions.
- Do not present local synthetic endpoint timings as production latency.
- Do not claim production readiness, zero corruption, or exactly-once external effects.

## SplitEase Allocation Candidate (2026-10-03T02-24-19-237Z-splitease-allocation)

Status: MEASURED

- Candidate numerical bullet: Validated SplitEase cent allocation over 10285 valid and 1715 invalid local synthetic cases using seed `1592598566`, with zero harness-detected conservation or determinism failures.
- Qualifier: local synthetic allocation correctness harness; no API latency, production traffic, or real financial transactions measured.

## SplitEase Allocation Candidate (2026-10-03T02-25-00-580Z-splitease-allocation)

Status: MEASURED

- Candidate numerical bullet: Validated SplitEase cent allocation over 10285 valid and 1715 invalid local synthetic cases using seed `1592598566`, with zero harness-detected conservation or determinism failures.
- Qualifier: local synthetic allocation correctness harness; no API latency, production traffic, or real financial transactions measured.

## SplitEase Allocation Candidate (2026-10-03T02-25-55-709Z-splitease-allocation)

Status: MEASURED

- Candidate numerical bullet: Validated SplitEase cent allocation over 10285 valid and 1715 invalid local synthetic cases using seed `1592598566`, with zero harness-detected conservation or determinism failures.
- Qualifier: local synthetic allocation correctness harness; no API latency, production traffic, or real financial transactions measured.
