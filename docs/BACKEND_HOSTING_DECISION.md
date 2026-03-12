# Backend hosting decision (free tier vs VPS)

This project runs long Python jobs (scraping + generation + Gmail drafts), so backend hosting must be selected from expected workload and reliability needs.

## Inputs to estimate before choosing

- Runs per day (`runs_per_day`)
- Average run duration in minutes (`avg_run_minutes`)
- P95 run duration in minutes (`p95_run_minutes`)
- Max concurrent runs (`max_concurrent_runs`)
- Reliability target (`best_effort` or `high_reliability`)

## Decision matrix

Choose **free tier** only if all conditions below are true:

- `runs_per_day <= 3`
- `avg_run_minutes <= 15`
- `p95_run_minutes <= 25`
- `max_concurrent_runs == 1`
- Reliability target is `best_effort`

Choose **VPS** if at least one condition below is true:

- `runs_per_day > 3`
- `avg_run_minutes > 15` or `p95_run_minutes > 25`
- `max_concurrent_runs > 1`
- Reliability target is `high_reliability`
- You need predictable execution windows (nightly or business-critical runs)

## Project default decision

For this repository, the current default target is **free tier**.

Reasoning:

- Current expected usage is low volume and can tolerate best-effort reliability.
- This allows reducing infrastructure cost while validating the run cadence.
- The matrix above still applies, and migration to VPS remains planned once thresholds are exceeded.

Use free tier as the active target for now, with a planned switch to VPS when re-evaluation triggers are met.

## Suggested rollout

1. **Current stage (low volume)**: free tier backend (monitor failures, cold starts, timeouts).
2. **When thresholds are exceeded**: migrate to a small VPS (2 vCPU / 2-4 GB RAM baseline).
3. **Higher load**: increase VPS size and add queue/worker separation later if needed.

## Re-evaluation trigger

Revisit hosting choice when one of these happens:

- 3+ run failures in a week caused by host limits/sleep/restarts
- P95 runtime grows by 30%+ for two consecutive weeks
- Need for guaranteed daily automation without manual restart
