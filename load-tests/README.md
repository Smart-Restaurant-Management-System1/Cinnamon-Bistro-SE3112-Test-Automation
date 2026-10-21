# Cinnamon Bistro Load and Performance Tests

This suite uses Grafana k6 to measure HTTP latency, throughput, response failures, and response-contract checks for the Cinnamon Bistro reservation service. Load testing repeatedly sends requests at a controlled concurrency so performance changes and capacity limits can be observed before release. k6 was selected because its scripts are JavaScript, its executable is portable across developer and CI environments, and it reports latency percentiles and threshold outcomes directly.

## Endpoints and target configuration

The smoke suite checks two real HTTP endpoints on the reservation service:

```text
GET http://localhost:5000/api/tables/availability
GET http://localhost:5000/metrics
```

The availability route is public and returns JSON with `available: true` and a non-empty message. Its smoke checks verify HTTP 200, JSON parsing, and the expected response structure. The metrics route is exposed by the service's Prometheus metric server; checks verify HTTP 200, a Prometheus text content type, HELP/TYPE metadata, and a metric sample.

Set `BASE_URL` to change both endpoint hosts (default `http://localhost:5000`). `TARGET_URL` and `METRICS_URL` can override the full endpoint URLs individually. Each iteration pauses for 0.5 seconds. The metrics endpoint is an operational monitoring endpoint and does not represent reservation or ordering workload.

Use only a local CSP reference checkout or an authorized isolated test service. Do not run load or stress profiles against public or production systems.

## Requirements and setup

- Grafana k6 0.54 or later (verified locally with k6 v2.2.0).
- A running Cinnamon Bistro reservation service. The local smoke endpoints can be exercised without Docker by running the .NET service directly, as shown below.
- PowerShell examples below use the installed executable path; if `k6` is on PATH, the short command works too.

Check the executable:

```powershell
k6 version
```

If Windows has not refreshed PATH after installation, use `& 'C:\Program Files\k6\k6.exe'` in place of `k6`. The current terminal may need a restart before the install directory appears on PATH.

Start the service directly from the CSP application checkout (PowerShell; no Docker required). The tested local setup had the project already built and disabled its Kafka publisher and order-expiry worker:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:Kafka__PublisherEnabled = 'false'
$env:OrderExpiry__Enabled = 'false'
$env:Logging__EventLog__LogLevel__Default = 'Critical'
dotnet run --no-build --project backend/reservation-service/reservation-service.csproj --no-launch-profile --urls http://localhost:5000
```

From the test-automation repository, verify both endpoints and run the expanded smoke test:

```powershell
curl.exe -i --max-time 5 http://localhost:5000/api/tables/availability
curl.exe -i --max-time 5 http://localhost:5000/metrics
New-Item -ItemType Directory -Force test-reports/load | Out-Null
$k6 = 'C:\Program Files\k6\k6.exe'
$stats = 'avg,min,med,max,p(50),p(90),p(95),p(99)'
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/smoke-summary.json load-tests/scripts/smoke.js
```

For an approved non-default environment:

```powershell
$env:BASE_URL = 'http://localhost:5000'
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/smoke-summary.json load-tests/scripts/smoke.js
Remove-Item Env:BASE_URL
```

`REQUEST_TIMEOUT` optionally changes the per-request timeout (default `10s`). Do not include credentials or tokens in command-line values or committed files.

## Scenarios and thresholds

| Script | Workload | Thresholds |
| --- | --- | --- |
| `smoke.js` | Availability and metrics run concurrently; 1 VU per endpoint for 10 seconds (2 VUs total) | Each endpoint p95 < 1000 ms, HTTP failures < 1%, checks > 99%; at least one request per endpoint |
| `baseline.js` | 2 constant VUs for 30 seconds | p95 < 500 ms, p99 < 1000 ms, failed requests < 1%, checks > 99% |
| `reservation-load.js` | Ramp 1→5→10→20→0 VUs over 60 seconds | p95 < 750 ms, p99 < 1500 ms, failed requests < 1%, checks > 99% |
| `stress.js` | Controlled ramp 1→10→25→40→0 VUs over 65 seconds | p95 < 1500 ms, failed requests < 5%, checks > 95% |

The three existing non-smoke profiles continue to exercise table availability only. Thresholds are planned test gates, not measured service-level objectives. The stress profile can increase load materially: run it only against an isolated environment with the environment owner's approval. The other profiles also send real requests and should be run only against a test system.

Run baseline, load, or stress with the corresponding summary file:

```powershell
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/baseline-summary.json load-tests/scripts/baseline.js
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/load-summary.json load-tests/scripts/reservation-load.js
& $k6 run "--summary-trend-stats=$stats" --summary-export=test-reports/load/stress-summary.json load-tests/scripts/stress.js
```

k6 prints requests, request rate, average and percentile latency, failed-request rate, checks, and threshold status to the console. `--summary-export` writes the same run's machine-readable summary. A non-zero exit status means a threshold or execution failed; retain that result and investigate it rather than editing metrics.

## Expanded smoke measurements (2026-10-21)

The reservation service was run locally on Windows using .NET SDK 10.0.401 and k6 v2.2.0. Direct probes returned HTTP 200 for both endpoints; `/metrics` returned `text/plain; version=0.0.4; charset=utf-8`. The expanded k6 smoke run completed 20 requests per endpoint, all 140 checks passed, and all thresholds passed. The run's machine-readable summary and full console output are in [`evidence/expanded-smoke-summary.json`](evidence/expanded-smoke-summary.json) and [`evidence/expanded-smoke-output.txt`](evidence/expanded-smoke-output.txt).

| Endpoint | Requests | Requests/sec | Avg | p95 | p99 | HTTP failures | Checks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `GET /api/tables/availability` | 20 | 1.958941 | 1.09 ms | 2.00 ms | 2.06 ms | 0/20 (0%) | 60/60 passed |
| `GET /metrics` | 20 | 1.958941 | 7.67 ms | 12.55 ms | 23.70 ms | 0/20 (0%) | 80/80 passed |
| **Combined** | **40** | **3.917882** | **4.38 ms** | **8.05 ms** | **20.76 ms** | **0/40 (0%)** | **140/140 passed** |

Each smoke scenario ran for 10 seconds with 1 VU; the combined maximum was 2 VUs. Combined request latency percentiles are not an SLO and should not be interpreted as either endpoint's individual latency. These measurements describe one local workstation/service run only and do not establish production capacity.

## Findings, CI, and limitations

The earlier 2026-10-17 local smoke attempt recorded in [`results-summary.md`](results-summary.md) failed because the service was not running; it is retained as historical evidence and is not conflated with the successful run above. The previously reported CI benchmark (20 availability requests, 60/60 checks, p95 11.53 ms) is a separate baseline and was not rerun as part of this local metrics-endpoint test.

The original availability-only smoke workload was separately rerun against the locally running service on 2026-10-21 to verify the existing test behavior: 1 VU for 10 seconds, 20 requests, 60/60 checks, 0% HTTP failures, p95 12.69 ms, and all original thresholds passed. See [`evidence/legacy-smoke-output.txt`](evidence/legacy-smoke-output.txt).

The availability endpoint returns a lightweight response and does not exercise database-backed reservation creation, authentication, or a full customer journey. `/metrics` is an operational scrape endpoint, not a reservation workload. These results do not replace broader reservation/order workload testing or represent a production capacity guarantee.

The checked-in workflow at the locally available `develop` revision still has a placeholder `load-tests` job and does not start this service or run k6. No workflow changes were made because the current CI service-startup configuration described for the newer integrated branch could not be verified from this checkout. GitHub Actions status must be confirmed on the feature branch after remote access is restored; this local run is not a CI result. Keep baseline/load/stress profiles on an authorized controlled performance runner, not on every push.
