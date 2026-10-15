# Quality Assurance & Testing Master Plan

## 1. Executive Summary

This Master Testing Plan establishes the testing strategy, standards, tooling evaluation, quality gates, and demonstration deliverables for the **SE3112 Advanced Software Engineering** project, targeting the **Cinnamon Bistro SE3022 Cloud Services Platform (CSP)**.

The project structure aligns strictly with the SE3112 assessment framework, designating **four individual testing areas** alongside a **shared group CI/CD automation pipeline**:
1. **Code Quality & Metrics** — Owned by **Wijesinghe K** (`IT24102587`)
2. **UI / End-to-End (E2E) Testing** — Owned by **H.R.M.A.A. Bandara** (`IT24100315`)
3. **Unit Testing & Mocking** — Owned by **Perera H.L.P.S.** (`IT24101848`)
4. **Load & Performance Testing** — Owned by **D.M.N. Presanjith** (`IT24101505`)
- **Shared Group Requirement**: Test Automation Pipeline & CI Orchestration — Led by **Wijesinghe K** (`IT24102587`)

> **Scope Note on Mutation Testing**: Mutation testing is **not** included within the four selected individual testing areas and is **not** presented as a completed group requirement. The `mutation-tests/` directory remains as an exploratory placeholder for future enhancement.

---

## 2. Testing Scopes & Individual Ownership

### 2.1 Area 1: Code Quality & Metrics
- **Individual Owner**: Wijesinghe K (`IT24102587`)
- **Directory**: [`quality-checks/`](../quality-checks/)
- **Objectives**:
  - Enforce uniform code formatting, linting rules, and stylistic consistency.
  - Execute Static Application Security Testing (SAST) to detect common vulnerabilities (OWASP Top 10) and secret leaks.
  - Track software quality metrics including cyclomatic complexity, cognitive complexity, code duplication, and maintainability indices.
  - Establish automated quality gates within the CI pipeline to fail non-compliant builds.
- **Expected Test & Check Procedures**:
  - Pre-commit/CI linting checks.
  - Dependency vulnerability auditing.
  - Automated generation of quality badges and code analysis summary reports.
- **Key Metrics & Evidence**:
  - 0 High/Critical security vulnerabilities in dependencies.
  - 0 fatal linter errors.
  - Quality metrics report archived in `test-reports/quality/`.

### 2.2 Area 2: UI / End-to-End (E2E) Testing
- **Individual Owner**: H.R.M.A.A. Bandara (`IT24100315`)
- **Directory**: [`e2e-tests/`](../e2e-tests/)
- **Objectives**:
  - Validate end-to-end customer workflows through the user interface against integrated backend services.
  - Test realistic customer journeys: user authentication/registration, menu catalog browsing, table reservation, and order checkout (subject to actual capabilities exposed by the Cinnamon Bistro CSP application).
  - Exercise positive and negative UI paths (e.g., successful checkout vs. invalid payment inputs, session timeout handling).
- **Expected Test Procedures**:
  - Headless browser automation executing in CI.
  - Cross-browser validation (Chromium, Firefox) where applicable.
  - Automated screenshot capture on test failure and video recording of test runs.
- **Key Metrics & Evidence**:
  - Test pass rate for core end-to-end user workflows.
  - Step execution timings and DOM assertion verifications.
  - E2E execution report (HTML/JUnit) archived in `test-reports/e2e/`.

### 2.3 Area 3: Unit Testing & Mocking
- **Individual Owner**: Perera H.L.P.S. (`IT24101848`)
- **Directory**: [`unit-tests/`](../unit-tests/)
- **Objectives**:
  - Verify granular business logic, calculations, and domain state transitions in complete isolation.
  - Implement parameterized tests to validate equivalence classes and boundary values (e.g., pricing formulas, tax computations, discount tiers).
  - Employ test doubles (mocks, stubs, spies) to decouple business logic from databases, external HTTP services, and message brokers.
  - Validate exception-handling paths, invalid arguments, and recovery procedures.
- **Expected Test Procedures**:
  - Fast, in-memory automated test execution.
  - Mocking framework configuration verifying method invocations and arguments.
  - Coverage report generation (statement, branch, function coverage).
- **Key Metrics & Evidence**:
  - 100% pass rate on unit test suites.
  - Code coverage target: ≥ 80% line coverage for tested services.
  - Detailed unit test execution logs and coverage reports archived in `test-reports/unit/`.

### 2.4 Area 4: Load & Performance Testing
- **Individual Owner**: D.M.N. Presanjith (`IT24101505`)
- **Directory**: [`load-tests/`](../load-tests/)
- **Objectives**:
  - Benchmark performance characteristics of critical Cinnamon Bistro microservice endpoints under simulated user loads.
  - Design realistic workload profiles including ramp-up, steady-state peak, and ramp-down scenarios.
  - Measure response times, throughput (Requests Per Second - RPS), latency percentiles (p90, p95, p99), and HTTP error rates.
  - Identify system bottlenecks, concurrency limits, and breaking thresholds.
- **Expected Test Procedures**:
  - Automated load test script execution against running service endpoints (local or CI container).
  - Baseline load test (normal traffic) and stress test (peak/overload traffic).
- **Key Metrics & Evidence**:
  - SLA Compliance: Target p95 latency < 500ms under standard concurrency.
  - Error rate < 1% during baseline operational load.
  - Performance summary reports and latency distribution graphs archived in `test-reports/load/`.

---

## 3. Tooling Evaluation & Tech Stack Alignment

Tools are configured to integrate with the verified technology stack of Cinnamon Bistro CSP (.NET 10 Web APIs and React 19 / Vite):

| Testing Area | Individual Owner | Implemented / Target Frameworks | Selection Rationale |
| :--- | :--- | :--- | :--- |
| **Code Quality & Metrics** | Wijesinghe K | **ESLint (Flat Config) + Baseline Comparator + ReportGenerator (v5.5.11)** | Zero-regression quality gate preserving upstream immutability; aggregated statement & branch coverage HTML dashboard. |
| **Unit Testing & Mocking** | Perera H.L.P.S. | **xUnit 2.5.3 + Moq 4.20.70 + Coverlet (6.0.0)** | Native .NET 10 test SDK; in-memory isolation, test doubles, and Cobertura XML coverage generation. |
| **UI / E2E Testing** | H.R.M.A.A. Bandara | **Playwright (Node.js 20)** | High-reliability headless browser automation, trace captures, video on failure, and CI readiness. |
| **Load Testing** | D.M.N. Presanjith | **Grafana k6** | High-performance Go-based headless engine, JavaScript scripting, p95/p99 latency metrics, and SLA assertions. |
| **Shared CI Pipeline** | Group (Lead: Wijesinghe K) | **GitHub Actions** | Native GitHub workflow orchestration, dual repository checkout, tool caching, and unified step summaries. |

---

## 4. Phase 2 Enforced Quality Gates & Acceptance Thresholds

The following criteria are enforced within the active CI/CD pipeline:

| Pipeline Stage | Evaluated Metric | Enforced Threshold | Gate Classification | Action on Violation |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Static Analysis** | ESLint Errors beyond Authorized Baseline | Strict **0 New Errors** ($\Delta_{\text{new}} = 0$) | Mandatory Gate | Fail CI Build |
| **Backend Compilation** | ASP.NET Core Build Errors & Warnings | **0 Compilation Errors** | Mandatory Gate | Fail CI Build |
| **Backend Code Formatting** | C# Style Conformance (`dotnet format`) | Diagnostic Logging | Advisory Check | Log Warnings (Non-blocking) |
| **Dependency Vulnerabilities** | NuGet Published CVEs | **0 Vulnerable Packages** | Mandatory Gate | Fail CI Build |
| **Backend Unit Testing** | xUnit Test Pass Rate | **100% Pass Rate** (570/570 passing) | Mandatory Gate | Fail CI Build |
| **Backend Code Coverage** | Coverlet + ReportGenerator | **Line >= 40.0%**, **Branch >= 35.0%** | Coverage Floor Gate | Fail CI Build |

> **Current Operational Status**: Phase 2 is fully active. The pipeline executes ESLint regression gating, backend compilation, dependency auditing, 570 unit tests, and ReportGenerator coverage dashboard generation. Teammate suites (Unit, E2E, Load) are integration-ready.

---

## 5. Test Reports & Deliverable Artifacts

Each testing area outputs structured results to dedicated subdirectories within `test-reports/`:

```text
test-reports/
├── quality/      # Static analysis logs, security audit reports, complexity metrics
├── unit/         # Unit test runner logs, JUnit XML, lcov/HTML coverage reports
├── e2e/          # E2E test execution reports, failure screenshots, run videos
└── load/         # Performance summary JSON, latency histograms, k6 stdout summaries
```

The GitHub Actions workflow is designed to collect and upload these artifacts, ensuring that every build produces verifiable technical evidence for individual grading and group presentation.
