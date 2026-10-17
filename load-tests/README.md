# Cinnamon Bistro Load and Performance Tests

This suite uses Grafana k6 to measure HTTP latency, throughput, response failures, and response-contract checks for the Cinnamon Bistro reservation service. Load testing repeatedly sends requests at a controlled concurrency so performance changes and capacity limits can be observed before release. k6 was selected because its scripts are JavaScript, its executable is portable across developer and CI environments, and it reports latency percentiles and threshold outcomes directly.

## Verified target

The default target is the public reservation availability endpoint:

```text
GET http://localhost:5000/api/tables/availability
```

The route is defined by `TablesController` (`[Route("api/[controller]")]`, `[HttpGet("availability")]`, `[AllowAnonymous]`) in the upstream application. The controller returns JSON with `available: true` and a message. The tests check HTTP 200, JSON parsing, and `available === true`. No authentication header is required. Override the complete URL with `TARGET_URL` when using another approved environment.

The upstream compose file maps MySQL to 3306, Kafka to 9092, identity service to 5001, and reservation service to 5000. The reservation service depends on MySQL and Kafka in compose. Use the upstream repository's documented environment configuration and start only an isolated development/test stack. Do not target production or shared services with load or stress profiles. Each iteration pauses for 0.5 seconds after its request to avoid an unbounded request loop, especially when the target is unavailable.

## Requirements and setup

- Grafana k6 0.54 or later (verified locally with k6 v2.2.0).
- A running Cinnamon Bistro reservation service and its required dependencies.
- PowerShell examples below use the installed executable path; if `k6` is on PATH, the short command works too.

Check the executable:

```powershell
k6 version
```

If Windows has not refreshed PATH after installation, use `& 'C:\Program Files\k6\k6.exe'` in place of `k6`. The current terminal may need a restart before the install directory appears on PATH.

Check the service before running a profile:

```powershell
curl.exe -i --max-time 5 http://localhost:5000/api/tables/availability
```

Create the report directory, then run one script at a time from the repository root:

```powershell
New-Item -ItemType Directory -Force test-reports/load | Out-Null
$k6 = 'C:\Program Files\k6\k6.exe'
& $k6 run --summary-trend-stats='avg,min,med,max,p(50),p(90),p(95),p(99)' --summary-export=test-reports/load/smoke-summary.json load-tests/scripts/smoke.js
```

To use another explicitly approved target:

```powershell
$env:TARGET_URL = 'http://localhost:5000/api/tables/availability'
& $k6 run --summary-trend-stats='avg,min,med,max,p(50),p(90),p(95),p(99)' --summary-export=test-reports/load/baseline-summary.json load-tests/scripts/baseline.js
Remove-Item Env:TARGET_URL
```

`REQUEST_TIMEOUT` optionally changes the per-request timeout (default `10s`). Do not include credentials or tokens in command-line values or committed files.

## Scenarios and thresholds

| Script | Workload | Thresholds |
| --- | --- | --- |
| `smoke.js` | 1 VU for 10 seconds; endpoint and basic health check | p95 < 1000 ms, failed requests < 1%, checks > 99% |
| `baseline.js` | 2 constant VUs for 30 seconds | p95 < 500 ms, p99 < 1000 ms, failed requests < 1%, checks > 99% |
| `reservation-load.js` | Ramp 1→5→10→20→0 VUs over 60 seconds | p95 < 750 ms, p99 < 1500 ms, failed requests < 1%, checks > 99% |
| `stress.js` | Controlled ramp 1→10→25→40→0 VUs over 65 seconds | p95 < 1500 ms, failed requests < 5%, checks > 95% |

Thresholds are planned gates for this test suite, not measured service-level objectives. The stress profile can increase load materially: run it only against an isolated environment with the environment owner's approval. The other profiles also send real requests and should be run only against a test system.

Run baseline, load, or stress with the corresponding summary file:

```powershell
& $k6 run --summary-trend-stats='avg,min,med,max,p(50),p(90),p(95),p(99)' --summary-export=test-reports/load/baseline-summary.json load-tests/scripts/baseline.js
& $k6 run --summary-trend-stats='avg,min,med,max,p(50),p(90),p(95),p(99)' --summary-export=test-reports/load/load-summary.json load-tests/scripts/reservation-load.js
& $k6 run --summary-trend-stats='avg,min,med,max,p(50),p(90),p(95),p(99)' --summary-export=test-reports/load/stress-summary.json load-tests/scripts/stress.js
```

k6 prints requests, request rate, average and percentile latency, failed-request rate, checks, and threshold status to the console. `--summary-export` writes the same run's machine-readable summary. A non-zero exit status means a threshold or execution failed; retain that result and investigate it rather than editing metrics.

## Findings and limitations

On 2026-10-17, all four profiles were executed against the locally running reservation service. Smoke, baseline, load, and stress passed their configured thresholds; every response check passed and the measured HTTP failure rate was 0%. The initial smoke attempt before service startup failed with connection refusal and is preserved separately from the final measurements. See [`results-summary.md`](results-summary.md) and [`LOAD_TESTING_REPORT.md`](LOAD_TESTING_REPORT.md) for the measurements and limits.

The default endpoint is a lightweight public availability response and does not exercise database-backed reservation creation, authentication, or a full customer journey. A load result describes the specific machine, service configuration, dependencies, and target environment used during that run; it is not a production capacity guarantee. No test credentials are embedded. Future authenticated scenarios should use dedicated disposable accounts and secret-managed credentials, and should avoid creating persistent reservation data unless cleanup is defined.

## CI integration

The existing shared workflow checks out and builds/tests upstream code but does not start the service dependencies. This suite is therefore not wired into the default pipeline: a k6 job without a live target would fail for an environmental reason, while starting MySQL and Kafka would change the pipeline's scope. The smoke test can be added once CI has a reliable isolated reservation-service environment and dependency configuration. Keep baseline/load/stress profiles manual or on a controlled performance runner, not on every push.
