# Load and Performance Results Summary

This file keeps the earlier unavailable-target attempt separate from successful local endpoint smoke runs. Measurements below are from actual k6 output; no failed connection attempt is presented as service performance.

## Expanded smoke run

- **Latest run date:** 2026-10-22
- **Environment:** Windows developer workstation, .NET SDK 10.0.401, Grafana k6 v2.2.0.
- **Target:** Locally running reservation service on `http://localhost:5000`.
- **Workload:** Two concurrent scenarios, each 1 VU for 10 seconds; 2 VUs total; 20 requests to each endpoint.
- **Direct probes:** Availability returned HTTP 200 and the expected JSON. `/metrics` returned HTTP 200 with `text/plain; version=0.0.4; charset=utf-8`.

| Endpoint | Requests | Requests/sec | Average | p95 | p99 | HTTP failures | Checks | Thresholds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `GET /api/tables/availability` | 20 | 1.972582 | 1.88 ms | 5.26 ms | 10.64 ms | 0/20 (0%) | 60/60 passed | PASS |
| `GET /metrics` | 20 | 1.972582 | 5.42 ms | 6.11 ms | 9.64 ms | 0/20 (0%) | 80/80 passed | PASS |
| **Combined** | **40** | **3.945165** | **3.65 ms** | **6.11 ms** | **11.42 ms** | **0/40 (0%)** | **140/140 passed** | **PASS** |

All global and endpoint-specific thresholds passed: p95 < 1000 ms, HTTP failure rate < 1%, checks > 99%, and at least one request per endpoint. Combined VU peak was 2; duration was 10 seconds per scenario. Endpoint-specific request rates and latency are separated by the `endpoint` tag. Raw output and the k6 summary are in [`evidence/expanded-smoke-2026-10-22-output.txt`](evidence/expanded-smoke-2026-10-22-output.txt) and [`evidence/expanded-smoke-2026-10-22-summary.json`](evidence/expanded-smoke-2026-10-22-summary.json).

### Previous expanded smoke run (2026-10-21)

- **Date:** 2026-10-21
- **Environment:** Windows developer workstation, .NET SDK 10.0.401, Grafana k6 v2.2.0.
- **Target:** Locally running reservation service on `http://localhost:5000`.
- **Workload:** Two concurrent scenarios, each 1 VU for 10 seconds; 2 VUs total; 20 requests to each endpoint.
- **Direct probes:** Availability returned HTTP 200 and the expected JSON. `/metrics` returned HTTP 200 with `text/plain; version=0.0.4; charset=utf-8`.

| Endpoint | Requests | Requests/sec | Average | p95 | p99 | HTTP failures | Checks | Thresholds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `GET /api/tables/availability` | 20 | 1.958941 | 1.09 ms | 2.00 ms | 2.06 ms | 0/20 (0%) | 60/60 passed | PASS |
| `GET /metrics` | 20 | 1.958941 | 7.67 ms | 12.55 ms | 23.70 ms | 0/20 (0%) | 80/80 passed | PASS |
| **Combined** | **40** | **3.917882** | **4.38 ms** | **8.05 ms** | **20.76 ms** | **0/40 (0%)** | **140/140 passed** | **PASS** |

All global and endpoint-specific thresholds passed: p95 < 1000 ms, HTTP failure rate < 1%, and checks > 99%. Each endpoint also passed its `http_reqs count>0` threshold. Combined VU peak was 2; duration was 10 seconds per scenario. The per-endpoint request rates and response times are separated by the `endpoint` tag in k6 output.

The previous run's raw console output and machine-readable k6 summary remain preserved in [`evidence/expanded-smoke-output.txt`](evidence/expanded-smoke-output.txt) and [`evidence/expanded-smoke-summary.json`](evidence/expanded-smoke-summary.json).

## Historical results and evidence boundary

On **2026-10-17**, the original local availability smoke, baseline, load, and stress profiles were executed against the local service. Their verified results are retained below and in the original evidence logs; the additional endpoint smoke does not replace these measurements.

| Existing profile | VUs (configured peak) | Requests | Requests/sec | Average | p95 | p99 | HTTP failures | Checks | Thresholds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Smoke | 1 | 20 | 1.991607 | 0.740 ms | 1.36 ms | 1.44 ms | 0/20 (0%) | 60/60 passed | PASS |
| Baseline | 2 | 120 | 3.987584 | 0.543 ms | 1.05 ms | 1.13 ms | 0/120 (0%) | 360/360 passed | PASS |
| Load | 20 | 1,120 | 18.612977 | 0.510 ms | 1.08 ms | 1.30 ms | 0/1,120 (0%) | 3,360/3,360 passed | PASS |
| Stress | 40 | 2,533 | 38.854781 | 0.557 ms | 1.18 ms | 1.43 ms | 0/2,533 (0%) | 7,599/7,599 passed | PASS |

These values are preserved from the 2026-10-17 final k6 console logs in [`evidence/03-smoke-test-output.txt`](evidence/03-smoke-test-output.txt) through [`evidence/06-stress-test-output.txt`](evidence/06-stress-test-output.txt). The observed maximum ramping VUs were recorded as 19 and 39 for the load and stress runs respectively; the table gives their configured targets.

The earlier unavailable-target smoke attempt (before the service started) is retained separately; connection-refused checks failed and are not reported as service performance.

The previously reported CI availability benchmark (1 VU, 10 seconds, 20 requests, 60/60 checks, 0% HTTP errors, p95 11.53 ms) is a separate prior result supplied for comparison. It was not rerun or reused as the result for `/metrics`.

These smoke measurements describe one local machine and service process. The availability endpoint is lightweight, while `/metrics` is a monitoring scrape; neither verifies database-backed reservation creation, ordering flows, or production capacity. GitHub Actions was not run for this feature branch.
