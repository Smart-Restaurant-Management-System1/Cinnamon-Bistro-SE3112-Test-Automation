# Load Testing Evidence Index

**Run dates:** 2026-10-17, 2026-10-21, and 2026-10-22 (Asia/Colombo)
**Targets:** local table availability and Prometheus `/metrics`
**Final test outcome:** original smoke, baseline, load, stress, and both recorded expanded two-endpoint smoke runs passed.
**Raw k6 JSON summaries:** original profile summaries are retained locally under `test-reports/load/`; new smoke summaries are checked in here.

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
| `legacy-smoke-output.txt` | Re-run of original availability-only 1-VU smoke profile against the local service on 2026-10-21 | Smoke / passed; 20 requests and 60/60 checks | Existing behavior regression check |
| `legacy-smoke-summary.json` | Machine-readable result of the 2026-10-21 original availability-only smoke | Smoke / passed | Exact latency and threshold values |
| `expanded-smoke-output.txt` | Full two-endpoint k6 smoke output, including endpoint-tagged metrics and thresholds | Expanded smoke / passed on 2026-10-21 | Added metrics coverage |
| `expanded-smoke-summary.json` | Machine-readable summary of the expanded smoke run | Expanded smoke / passed | Exact latency, request counts, and threshold values |
| `expanded-smoke-2026-10-22-output.txt` | Full two-endpoint k6 smoke output from the latest local run | Expanded smoke / passed on 2026-10-22; 40 requests and 140/140 checks | Latest endpoint-specific measurements and thresholds |
| `expanded-smoke-2026-10-22-summary.json` | Machine-readable summary from the latest expanded smoke run | Expanded smoke / passed | Exact latest latency and request values |
| `../LOAD_TESTING_REPORT.md` | Plain-English summary of scope, environment, results, findings, and limits | Final report | University submission report |
| `../../test-reports/load/smoke-summary.json` | Machine-readable smoke metrics and thresholds | Smoke / passed | Raw result data |
| `../../test-reports/load/baseline-summary.json` | Machine-readable baseline metrics and thresholds | Baseline / passed | Raw result data |
| `../../test-reports/load/load-summary.json` | Machine-readable load metrics and thresholds | Load / passed | Raw result data |
| `../../test-reports/load/stress-summary.json` | Machine-readable stress metrics and thresholds | Stress / passed | Raw result data |

No synthetic terminal screenshots were created. The SVG is a chart generated from the final k6 summaries.
