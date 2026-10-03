# Evidence Benchmark Harness

This harness is for reproducible evidence, not a marketing table. It records raw artifacts under `docs/benchmarks/runs/<run-id>/`, including `metadata.json` for every run.

## Semantics

- The SplitEase API harnesses use a plain TypeScript/Supertest closed-loop client against the Express app. Closed-loop users wait for each request to finish before issuing the next request, so these runs are not requests-per-second capacity guarantees.
- The allocation harness is correctness-only and runs in-process. It must not be described as successful financial transactions.
- DB-backed harnesses require a real PostgreSQL database and refuse to run unless `SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1` is set and the database name contains `bench`, `benchmark`, `test`, or `perf`.
- The harness uses synthetic accounts/data only. Do not describe these as real users.
- All runs are exploratory unless a separate untouched final holdout database/workload is declared before running.

## Commands

Allocation correctness:

```bash
npm run bench:splitease:allocation
```

Settlement concurrency schedules:

```bash
SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1 \
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_bench \
JWT_SECRET=local-benchmark-jwt-secret-32-chars-min \
JWT_REFRESH_SECRET=local-benchmark-refresh-secret-32-chars \
npm run db:migrate

SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1 \
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_bench \
JWT_SECRET=local-benchmark-jwt-secret-32-chars-min \
JWT_REFRESH_SECRET=local-benchmark-refresh-secret-32-chars \
npm run bench:splitease:concurrency
```

Balance endpoint and query plans:

```bash
SPLITEASE_BENCH_ALLOW_DESTRUCTIVE=1 \
DATABASE_URL=postgresql://splitease:password@localhost:5433/splitease_bench \
JWT_SECRET=local-benchmark-jwt-secret-32-chars-min \
JWT_REFRESH_SECRET=local-benchmark-refresh-secret-32-chars \
npm run bench:splitease:balances
```

## Two-Minute Demo Script

1. Show `docs/benchmarks/README.md` and explain the difference between correctness, closed-loop API measurements, and capacity claims.
2. Run `npm run bench:splitease:allocation`.
3. Open the newest `docs/benchmarks/runs/*/metadata.json` and `raw/allocation-results.jsonl`.
4. Open `docs/benchmarks/results.md` and `docs/benchmarks/resume-candidates.md`.
5. Explain that DB-backed concurrency/balance runs require a disposable benchmark PostgreSQL database because they reset synthetic data.
6. Explain the tradeoff: the harness uses plain TypeScript clients already available in the repo instead of adding k6, keeping setup simple and dependency-free while documenting closed-loop semantics honestly.
