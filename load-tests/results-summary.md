# Load and Performance Results Summary

**Status: runtime performance measurements unavailable.** This report distinguishes the failed local availability check from measured service performance.

- **Date checked:** 2026-10-17 (Asia/Colombo)
- **Target:** `GET http://localhost:5000/api/tables/availability` (source-confirmed public controller route)
- **Environment:** Windows developer workstation; k6 v2.2.0 installed at `C:\Program Files\k6\k6.exe`
- **Runtime availability:** connection to `localhost:5000` was refused during the probe and smoke attempt. The backend was not observed running.
- **Thresholds:** defined in each script; they are planned test gates, not measured SLAs.

| Scenario | VUs | Requests/sec | p95 | p99 | Error rate | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Smoke | 1 | NOT A PERFORMANCE RESULT | NOT A PERFORMANCE RESULT | NOT A PERFORMANCE RESULT | 100% failed requests in unavailable-target check | EXECUTED, FAILED: connection refused; response/check thresholds failed |
| Baseline | 2 | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT RUN: backend unavailable |
| Load | 1–20 | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT RUN: backend unavailable |
| Stress | 1–40 | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT RUN: backend unavailable; isolated approved environment required |

## Findings and next action

The endpoint contract and local k6 executable were verified. The smoke script ran for 10 seconds and confirmed that connection refusal produces failed HTTP checks and a failed k6 threshold result (exit code 99). The failed-run request count and request rate are not reported as service performance because no HTTP response was received. Baseline, load, and stress profiles were not run. Start the upstream development stack in an isolated environment, confirm the availability URL responds with HTTP 200 and `available: true`, then run smoke first. Proceed to baseline and load only after smoke is healthy; run stress only with explicit approval for that environment. Save each k6 summary under `test-reports/load/` and update this table from those actual summary files.

No performance bottleneck can be identified from the current evidence. The availability route returns a static controller response according to source, so it does not represent the cost of reservation persistence or the full booking workflow.
