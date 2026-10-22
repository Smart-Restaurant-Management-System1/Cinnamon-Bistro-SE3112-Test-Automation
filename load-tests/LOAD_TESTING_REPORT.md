# Cinnamon Bistro Load Testing Report

**Course:** SE3112 — Automated Testing Pipeline
**Test dates:** 17, 21, and 22 October 2026 (Asia/Colombo)
**Target:** `GET http://localhost:5000/api/tables/availability`

## 1. Introduction

Load and performance testing measures how an API responds when requests arrive from multiple simulated users. This work uses Grafana k6 to check the Cinnamon Bistro reservation service’s public table-availability route and record latency, throughput, HTTP failures, response checks, and threshold results.

## 2. My contribution

I implemented the k6 smoke, baseline, load, and stress scripts; shared HTTP and JSON response checks; and scenario thresholds. I installed and verified k6 v2.2.0, ran the tests against the local service, exported machine-readable summaries, captured full console logs, updated the run documentation, and generated the comparison chart and this report. All four final test runs passed. An earlier smoke attempt before the API was running failed and is retained as separate evidence.

## 3. Testing environment

- Windows developer workstation, .NET SDK 10.0.401, Grafana k6 v2.2.0.
- ASP.NET Core reservation service running locally on port 5000 from the existing application checkout.
- The route is public and returns JSON containing `available: true`. A live probe returned HTTP 200 with the expected response.
- Kafka publishing and the order-expiry background worker were disabled for this isolated run. The route itself is static and did not make a database query. MySQL was installed and running locally; no database-backed operation was part of these tests. Docker is not installed.
- No secrets, tokens, or test credentials were used.

## 4. Test cases performed

Every request checked HTTP 200, valid JSON, and `available === true`.

| Test | Objective and configuration | Thresholds | Result and evidence |
| --- | --- | --- | --- |
| Smoke | Verify basic availability; 1 VU, 10 seconds | p95 < 1000 ms; HTTP failures < 1%; checks > 99% | **PASS**; [smoke log](evidence/03-smoke-test-output.txt) |
| Baseline | Measure low-load behavior; 2 constant VUs, 30 seconds | p95 < 500 ms; p99 < 1000 ms; failures < 1%; checks > 99% | **PASS**; [baseline log](evidence/04-baseline-test-output.txt) |
| Load | Increase concurrency to 20 VUs over 60 seconds | p95 < 750 ms; p99 < 1500 ms; failures < 1%; checks > 99% | **PASS**; [load log](evidence/05-load-test-output.txt) |
| Stress | Controlled ramp to 40 VUs over 65 seconds on local service | p95 < 1500 ms; failures < 5%; checks > 95% | **PASS**; [stress log](evidence/06-stress-test-output.txt) |

## 5. Test results

Values below come from the final k6 summary exports. Latencies are milliseconds. The configured VU peak is shown; k6 observed peaks of 1, 2, 19, and 39 VUs respectively while ramping through the load and stress profiles.

| Test | Configured VUs | Requests | Requests/sec | Average | p50 | p95 | p99 | HTTP error rate | Checks | Thresholds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Smoke | 1 | 20 | 1.992 | 0.740 | 0.791 | 1.366 | 1.445 | 0% | 100% | PASS |
| Baseline | 2 | 120 | 3.988 | 0.543 | 0.539 | 1.056 | 1.140 | 0% | 100% | PASS |
| Load | 20 | 1,120 | 18.613 | 0.510 | 0.510 | 1.084 | 1.307 | 0% | 100% | PASS |
| Stress | 40 | 2,533 | 38.855 | 0.557 | 0.530 | 1.185 | 1.438 | 0% | 100% | PASS |

Full JSON summaries are in `test-reports/load/` as `smoke-summary.json`, `baseline-summary.json`, `load-summary.json`, and `stress-summary.json`. Full execution output, including threshold status, is in the evidence logs.

## 6. Findings and limitations

The API returned the expected response throughout all four final runs. HTTP failure rate was 0%, response checks were 100%, and all configured thresholds passed. The measured p95 stayed between 1.056 ms and 1.366 ms across the profiles; p99 stayed between 1.140 ms and 1.445 ms. No performance bottleneck was observed for this route and this local setup.

These results are not a capacity claim for the whole application. The endpoint returns a static response and does not exercise MySQL queries, reservation creation, Kafka, authentication, or frontend behavior. k6 adds a 0.5-second pause after each iteration, so throughput reflects both the test script and the local machine. A production-like test should use an isolated deployment and a data-backed reservation scenario with safe test data. The earlier pre-start smoke failure was caused by the service not yet listening and is not part of the final performance table.

## 7. Evidence

See [`evidence/EVIDENCE_INDEX.md`](evidence/EVIDENCE_INDEX.md) for the file-by-file evidence map. It includes the k6 version, backend startup and HTTP probe, four full k6 logs, the initial connection-refused log, the measured SVG chart, and a Git status snapshot. The chart is generated from k6 JSON data and is not a screenshot. A VS Code screenshot was not captured because the available computer-use surface does not control native VS Code windows.

## 8. Conclusion

The four k6 scenarios ran successfully against the verified local API and produced reproducible JSON summaries and console logs. This completes the local endpoint performance check. Database-backed reservation performance and CI execution remain outside the verified scope. The shared GitHub Actions load-test job is still a placeholder; the group leader would need to integrate a smoke run after CI can start an isolated service and its dependencies.

## Reproduce

From the testing repository root in PowerShell, with the reservation service running:

```powershell
$k6 = 'C:\Program Files\k6\k6.exe'
New-Item -ItemType Directory -Force test-reports/load | Out-Null
$stats = 'avg,min,med,max,p(50),p(90),p(95),p(99)'
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/smoke-summary.json load-tests/scripts/smoke.js
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/baseline-summary.json load-tests/scripts/baseline.js
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/load-summary.json load-tests/scripts/reservation-load.js
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/stress-summary.json load-tests/scripts/stress.js
```

For this run, the backend was launched from the application repository with the Kafka publisher and expiry worker disabled, and the Windows Event Log provider limited to critical messages for the restricted execution account:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Kafka__PublisherEnabled = 'false'
$env:OrderExpiry__Enabled = 'false'
$env:Logging__EventLog__LogLevel__Default = 'Critical'
dotnet run --no-build --project backend/reservation-service/reservation-service.csproj --no-launch-profile --urls http://localhost:5000
```

## Additional endpoint coverage (21 October 2026)

The existing local k6 smoke was rerun unchanged in workload against the availability endpoint, and a second independent smoke scenario was added for the Prometheus metrics endpoint. No original CSP application source files were changed.

Direct HTTP probes returned:

- `GET /api/tables/availability`: HTTP 200 with `{"available":true,"message":"Tables are available for reservation today."}`.
- `GET /metrics`: HTTP 200 with `Content-Type: text/plain; version=0.0.4; charset=utf-8` and Prometheus HELP/TYPE metadata and metric samples.

Each smoke scenario ran for 10 seconds at 1 VU (2 VUs total), producing 20 requests per endpoint. All endpoint-specific thresholds passed: p95 < 1000 ms, HTTP failures < 1%, checks > 99%, and at least one request per endpoint. Availability recorded 20 requests at 1.958941 requests/sec, 1.09 ms average, 2.00 ms p95, 2.06 ms p99, 0/20 failures, and 60/60 checks. Metrics recorded 20 requests at 1.958941 requests/sec, 7.67 ms average, 12.55 ms p95, 23.70 ms p99, 0/20 failures, and 80/80 checks. Combined: 40 requests, 3.917882 requests/sec, 4.38 ms average, 8.05 ms p95, 20.76 ms p99, 0% HTTP failures, and 140/140 checks.

The raw expanded output and k6 JSON are in [`evidence/expanded-smoke-output.txt`](evidence/expanded-smoke-output.txt) and [`evidence/expanded-smoke-summary.json`](evidence/expanded-smoke-summary.json). The separate availability-only regression run is in [`evidence/legacy-smoke-output.txt`](evidence/legacy-smoke-output.txt) and [`evidence/legacy-smoke-summary.json`](evidence/legacy-smoke-summary.json). Its p95 was 12.69 ms, with 20 requests, 0% HTTP failures, 60/60 checks, and all thresholds passing.

This smoke only validates the lightweight availability and monitoring endpoints; it does not represent database-backed reservation or ordering workload. These local results are not a GitHub Actions result and do not guarantee production capacity.

## Latest local smoke verification (22 October 2026)

The local reservation service was started from the separate CSP checkout with the Kafka publisher and order-expiry worker disabled. Direct HTTP probes confirmed HTTP 200 from both endpoints, the expected availability JSON, and a Prometheus text response from `/metrics` (`text/plain; version=0.0.4; charset=utf-8`) with metadata and metric samples. No CSP source files were modified.

The expanded k6 smoke ran two concurrent scenarios for 10 seconds each at 1 VU per endpoint (2 VUs total). Availability completed 20 requests at 1.972582 requests/sec, with 1.88 ms average, 5.26 ms p95, 10.64 ms p99, zero HTTP failures, and 60/60 checks passed. Metrics completed 20 requests at 1.972582 requests/sec, with 5.42 ms average, 6.11 ms p95, 9.64 ms p99, zero HTTP failures, and 80/80 checks passed. Combined results were 40 requests at 3.945165 requests/sec, 3.65 ms average, 6.11 ms p95, 11.42 ms p99, 0/40 HTTP failures, and 140/140 checks passed. All global and endpoint-specific thresholds passed.

The exact output and summary are preserved in [`evidence/expanded-smoke-2026-10-22-output.txt`](evidence/expanded-smoke-2026-10-22-output.txt) and [`evidence/expanded-smoke-2026-10-22-summary.json`](evidence/expanded-smoke-2026-10-22-summary.json). This is a local measurement, not a GitHub Actions result; CI status and integration against the latest `develop` revision remain unverified.
