# Quality Assurance & Testing Master Plan

## 1. Executive Summary

This Master Testing Plan establishes the testing strategy, standards, tooling frameworks, and quality gates for the **SE3112 Advanced Software Engineering** project, targeting the **Cinnamon Bistro SE3022 Cloud Services Platform (CSP)**.

The primary objective is to build an automated, repeatable, and scalable verification pipeline that enforces continuous quality across all microservice components.

---

## 2. Scope of Testing

The testing suite encompasses the following validation tiers:

### 2.1 Static Quality Checks & Code Hygiene
- **Purpose**: Prevent syntax defects, security vulnerabilities, and code smell accumulation before execution.
- **Scope**:
  - Static code analysis (linting, styling compliance).
  - Secret scanning and dependency vulnerability auditing (SAST).
  - Configuration and Dockerfile schema validation.

### 2.2 Unit Testing
- **Purpose**: Verify granular business logic and domain entities in total isolation.
- **Scope**:
  - Pricing, discount, tax, and order total calculations.
  - State machine transitions (e.g., Order `PENDING` -> `CONFIRMED` -> `PREPARING` -> `COMPLETED`).
  - Input validation, boundary checks, and error condition handlers.
  - Dependencies (databases, network APIs, queues) replaced via test doubles (mocks/stubs).

### 2.3 Mutation Testing
- **Purpose**: Audit the robustness and effectiveness of the unit test suite.
- **Scope**:
  - Introduce synthetic mutations (boundary flips, conditional swaps, return value alterations).
  - Measure the **Mutation Score Indicator (MSI)** = (Killed Mutants / Total Mutants) * 100.
  - Eliminate "vampire tests" (tests that run without effective assertions).

### 2.4 End-to-End (E2E) & Integration Testing
- **Purpose**: Validate cross-service business flows and API contract compliance.
- **Scope**:
  - Authentication flow (login -> JWT issuance -> authenticated request).
  - Customer ordering lifecycle: Menu item retrieval -> Order placement -> Stock/Table allocation -> Checkout.
  - Asynchronous event propagation verification.
  - HTTP status codes, payload contract validation, and response schema checks.

### 2.5 Load & Performance Testing
- **Purpose**: Evaluate service scalability, response times, and resilience under sustained and spiky traffic.
- **Scope**:
  - Baseline Performance: Measure nominal latency under standard operational traffic.
  - Stress Testing: Determine breaking points and resource exhaustion limits.
  - Spike Testing: Assess system recovery and behavior under sudden surges (e.g., peak dinner rush).
  - Endurance Testing: Detect memory leaks and degradation over prolonged operational windows.

---

## 3. Tooling Evaluation & Framework Selection

| Testing Tier | Candidate / Target Frameworks | Key Rationale |
| :--- | :--- | :--- |
| **Static Analysis** | ESLint / SonarLint / Hadolint / Trivy | Industry-standard linters and container/dependency vulnerability scanners. |
| **Unit Testing** | Jest / Mocha / PyTest / JUnit | Fast in-memory execution, rich mocking ecosystem, native coverage generation. |
| **Mutation Testing** | Stryker Mutator / Pitest | Robust mutation engines with HTML reporting and survived-mutant diagnostics. |
| **E2E & Integration** | Supertest / Playwright / Cypress / Postman-Newman | High expressiveness for RESTful HTTP assertions, scenario chaining, and CI execution. |
| **Load Testing** | Grafana k6 / Apache JMeter | Scriptable in JavaScript, lightweight headless execution, detailed p90/p95/p99 metrics. |

---

## 4. Quality Gates & Acceptance Criteria

To maintain an uncompromised standard of delivery, commits and pull requests must satisfy the following thresholds in the CI pipeline:

| Metric | Target Minimum | Blocking Action |
| :--- | :--- | :--- |
| **Build & Static Checks** | 0 High/Critical Vulnerabilities, 0 Lint Errors | Immediate Build Failure |
| **Unit Test Pass Rate** | 100% Passing | Immediate Build Failure |
| **Code Coverage** | ≥ 80% Statement / Line Coverage | Warning on PR (<75% Blocks Merge) |
| **Mutation Score (MSI)** | ≥ 70% Mutants Killed | Quality Advisory Gate |
| **E2E Critical Paths** | 100% Passing on Critical Journeys | Merge Blocked |
| **Load Test Latency** | p95 < 500ms under standard concurrency | SLA Failure Flag |

---

## 5. Test Artifacts & Deliverables

1. **Automated CI Pipeline**: Multi-stage GitHub Actions workflow executing checks on push/PR.
2. **Standardized Test Reports**: Consolidated output stored in `test-reports/` (JUnit XML, Cobertura/LCOV, Mutation Reports).
3. **Execution Scripts**: Standalone cross-platform runners inside `scripts/` enabling developers to reproduce test results locally.
4. **Traceability Matrix**: Mapping between functional requirements of Cinnamon Bistro CSP and automated test suites.

