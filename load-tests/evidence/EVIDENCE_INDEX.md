# Load Testing Evidence Index

**Run date:** 2026-10-17 (Asia/Colombo)  
**Target:** local `GET /api/tables/availability` on port 5000  
**Final test outcome:** smoke, baseline, load, and stress all passed.  
**Raw k6 JSON summaries:** `../../test-reports/load/` (ignored by Git, retained locally).

| File | Demonstrates | Scenario / status | Requirement supported |
| --- | --- | --- | --- |
| `01-k6-version.txt` | Installed and executed Grafana k6 version | Setup / verified | Tooling |
| `02-backend-running.txt` | ASP.NET Core startup, runtime controls, HTTP 200 probe, and expected JSON body | Backend / passed | Real target availability and response contract |
| `03-smoke-test-output.txt` | Full k6 output, VU profile, requests, latency percentiles, checks, failures, thresholds, and exit code | Smoke / passed | Smoke test and actual measurements |
| `04-baseline-test-output.txt` | Full k6 output and metrics for low concurrency | Baseline / passed | Baseline measurement |
| `05-load-test-output.txt` | Full k6 output and metrics for the ramp to 20 VUs | Load / passed | Load measurement |
| `06-stress-test-output.txt` | Full k6 output and metrics for the isolated ramp to 40 VUs | Stress / passed | Controlled stress test |
| `07-results-comparison.svg` | Actual p95, throughput, and HTTP error-rate comparisons from the four JSON summaries | Summary chart / generated from actual runs; not a screenshot | Results comparison |
| `08-git-status.txt` | Branch and working-tree snapshot after evidence/report creation | Repository / snapshot | Git safety and review status |
| `09-initial-smoke-unavailable-target.txt` | Earlier genuine smoke output when port 5000 refused connections | Initial pre-start check / failed; not counted as final scenario result | Transparent failure evidence |
| `../LOAD_TESTING_REPORT.md` | Plain-English summary of scope, environment, results, findings, and limits | Final report | University submission report |
| `../../test-reports/load/smoke-summary.json` | Machine-readable smoke metrics and thresholds | Smoke / passed | Raw result data |
| `../../test-reports/load/baseline-summary.json` | Machine-readable baseline metrics and thresholds | Baseline / passed | Raw result data |
| `../../test-reports/load/load-summary.json` | Machine-readable load metrics and thresholds | Load / passed | Raw result data |
| `../../test-reports/load/stress-summary.json` | Machine-readable stress metrics and thresholds | Stress / passed | Raw result data |

No synthetic terminal screenshots were created. The SVG is a chart generated from the final k6 summaries.
