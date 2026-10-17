# Load and Performance Results Summary

**Status: four local profiles completed.** The table below reports the final runs against the running local reservation service. An earlier smoke attempt against a stopped service is retained as a failed pre-start check.

- **Test date:** 2026-10-17 (Asia/Colombo)
- **Target:** `GET http://localhost:5000/api/tables/availability` (source-confirmed public controller route)
- **Environment:** Windows workstation, .NET SDK 10.0.401, k6 v2.2.0, local ASP.NET Core reservation service
- **Runtime controls:** Kafka publishing and order-expiry worker disabled. This static endpoint did not access MySQL. Docker is not installed.
- **Thresholds:** planned gates for these runs, not a production SLA.

| Scenario | VUs | Requests/sec | p95 | p99 | Error rate | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Smoke | 1 | 1.992 | 1.366 ms | 1.445 ms | 0% | PASS; 20 requests, 100% checks |
| Baseline | 2 | 3.988 | 1.056 ms | 1.140 ms | 0% | PASS; 120 requests, 100% checks |
| Load | 1–20 | 18.613 | 1.084 ms | 1.307 ms | 0% | PASS; 1,120 requests, 100% checks |
| Stress | 1–40 | 38.855 | 1.185 ms | 1.438 ms | 0% | PASS; 2,533 requests, 100% checks |

All four final runs returned HTTP 200 with the expected JSON field, passed their configured thresholds, and recorded no HTTP failures. Throughput rose as the virtual-user profile increased. No bottleneck was observed for this lightweight route. The route returns a static controller response, so these measurements do not represent database-backed reservation creation, Kafka publishing, authenticated workflows, or a deployed environment.

The initial pre-start smoke attempt is preserved in `load-tests/evidence/09-initial-smoke-unavailable-target.txt`; it is not included in the performance results. Raw final k6 summaries are in `test-reports/load/`. Detailed logs and the measured comparison chart are indexed in `load-tests/evidence/EVIDENCE_INDEX.md`.
