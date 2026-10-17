# Load Testing Presentation and Viva Notes

## Two-minute presentation

My assigned SE3112 contribution is load and performance testing for Cinnamon Bistro. I implemented a Grafana k6 suite focused on the reservation service's public table-availability endpoint. Load testing matters because a system that works for one user may slow down or fail when many users make requests at the same time. k6 lets us describe workloads as code and measure throughput, latency percentiles, request failures, and response checks.

The suite has four profiles: a 10-second, one-user smoke check; a 30-second, two-user baseline; a controlled ramp to 20 users; and a controlled stress ramp to 40 users. Each request checks the real route's HTTP status and JSON response contract. Thresholds are defined as planned gates, and the test command exports a JSON summary that can be reviewed or archived.

I verified the upstream route in `TablesController` and confirmed that k6 v2.2.0 runs from its installed executable. At the time I checked, the local reservation service was not accepting connections on port 5000. For that reason, I did not run the profiles and have no measured latency or throughput results to claim. The next step is to start an isolated test stack, verify the smoke test, then run baseline and load profiles. Stress testing should only happen in an approved isolated environment.

The current availability endpoint is a lightweight public route. A later improvement would be a separately designed authenticated and data-backed reservation scenario with safe test data, followed by repeated runs and comparison of the p95 and error-rate trends. If measurements identify a bottleneck, the team could inspect database query time, connection pooling, caching, and service resource limits.

## Viva questions

1. **What is load testing?** Running a system under an expected workload to measure response and reliability.
2. **What is stress testing?** Increasing load beyond the expected range to find where performance degrades or the system fails.
3. **What is a virtual user?** A simulated user executing the script's request flow concurrently.
4. **What is requests per second?** The number of HTTP requests completed each second during a run.
5. **What is latency?** The time taken for a request to receive a response.
6. **What is p95 latency?** The response time at or below which 95% of measured requests completed.
7. **What is p99 latency?** The response time at or below which 99% of measured requests completed.
8. **Why not use only average response time?** An average can hide slow requests in the tail; percentiles show that tail more clearly.
9. **What is an error rate?** The fraction of requests marked failed, usually reported as a percentage.
10. **What is a k6 threshold?** A pass/fail rule applied to a metric, such as p95 latency below a limit.
11. **What is an SLA?** A formal service-level agreement with a customer, including service commitments.
12. **What is an SLO?** A measurable service-level objective used to guide reliability targets.
13. **Why did you choose k6?** It is scriptable, works from a portable executable, and reports workload and latency metrics clearly.
14. **What did you personally implement?** Four k6 profiles, shared response checks, execution guidance, and honest result/presentation documentation.
15. **What were the actual performance results?** None were measured; the local target was unavailable when checked.
16. **What happens if a threshold fails?** k6 reports the failure and exits unsuccessfully so it can be investigated or used as a gate.
17. **How could performance improve?** First measure the bottleneck, then consider query tuning, caching, connection pooling, or scaling resources.
18. **How does this fit into automated testing and CI/CD?** A lightweight smoke profile can run in CI once CI provides a reliable isolated service and its dependencies; heavier profiles belong on a controlled runner.
