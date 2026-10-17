# Cinnamon Bistro SE3112 Automated Testing Pipeline

[![CI Pipeline Status](https://img.shields.io/badge/CI%20Pipeline-Active%20%28Passing%29-brightgreen.svg)](#)
[![Module](https://img.shields.io/badge/Module-SE3112%20Advanced%20Software%20Engineering-orange.svg)](#)
[![Base Project](https://img.shields.io/badge/Base%20Project-SE3022%20Cinnamon%20Bistro%20CSP-green.svg)](#)
[![Branch](https://img.shields.io/badge/Branch-develop-blue.svg)](#)
[![Verified Commit](https://img.shields.io/badge/Verified%20Commit-489e4fe-blueviolet.svg)](#)

---

## 1. Project Overview & Decoupled Architecture

This repository hosts the centralized **Automated Testing & Quality Assurance Pipeline** developed for **SE3112: Advanced Software Engineering**.

It validates the **Cinnamon Bistro Cloud Services Platform (CSP)**, an enterprise distributed restaurant system built during SE3022. The application architecture consists of:
- **Frontend:** React 19 Single Page Application (`Vite`, `Tailwind CSS`, Port `5173`).
- **Identity Microservice:** ASP.NET Core (.NET 10 SDK, JWT Authentication, BCrypt, Port `5001`).
- **Reservation Microservice:** ASP.NET Core (.NET 10 SDK, Table Inventory & Booking Engine, Port `5000`).
- **Data & Messaging:** MySQL 8 Relational Database (Port `3306`) and Apache Kafka Event Streaming Bus (Port `9092`).

### Decoupled Testing Strategy
Rather than embedding testing harnesses inside the production application, this repository operates as a **100% decoupled, standalone quality engineering harness**:
- **Zero Production Intrusion:** Upstream application source code (`Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System`) remains pristine and unmodified.
- **Dynamic Multi-Repo Orchestration:** The GitHub Actions CI runner dynamically checks out the external CSP repository into an ephemeral directory (`target-app/`) during workflow execution.
- **Independent Lifecycles:** Testing tooling, benchmark runners (Grafana k6), browser binaries (Playwright), and coverage instrumentation (Coverlet) evolve without triggering artificial application deployments.

---

## 2. Testing Areas & Assessment Allocation

In accordance with SE3112 curriculum guidelines, the testing strategy is structured into **four distinct individually assessed testing areas**, coordinated by a **shared group CI/CD automation pipeline**:

| Testing Area | Repository Directory | Ownership Classification | Individual / Lead Owner | Primary Scope & Objectives | Implementation Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Code Quality & Metrics** | [`quality-checks/`](quality-checks/) | **Individual Area 1** | **Wijesinghe K**<br>`IT24102587` | Static code analysis, linters, baseline regression gating, Coverlet coverage, and quality gate enforcement. | **VERIFIED & ACTIVE** |
| **UI / End-to-End Testing** | [`e2e-tests/`](e2e-tests/) | **Individual Area 2** | **H.R.M.A.A. Bandara**<br>`IT24100315` | Automated browser journeys (Auth, Menu, Table Booking) using Playwright & headless Chromium. | *Integration Ready (Pending PR)* |
| **Unit Testing & Mocking** | [`unit-tests/`](unit-tests/) | **Individual Area 3** | **Perera H.L.P.S.**<br>`IT24101848` | Service-level unit tests, parameterized tests (`[Theory]`), and Moq test doubles in memory. | *Integration Ready (Pending PR)* |
| **Load & Performance Testing**| [`load-tests/`](load-tests/) | **Individual Area 4** | **D.M.N. Presanjith**<br>`IT24101505` | Microservice load testing, concurrency profiles (Smoke, Baseline, Load, Stress), and SLA threshold evaluation. | **VERIFIED & ACTIVE** |
| **Test Automation Pipeline** | [`.github/workflows/`](.github/workflows/) | **Shared Group Requirement** | **Wijesinghe K** *(Lead)*<br>*(All Members Contribute)* | Unified CI/CD workflow orchestration, automated test execution, step summaries, and downloadable CI artifacts. | **VERIFIED & ACTIVE** |
| *Mutation Testing* | [`mutation-tests/`](mutation-tests/) | *Exploratory / Unassigned* | *None (Reserved)* | Retained in directory structure for potential exploration; **not** an individually assessed scope. | *Reserved Scope* |

---

## 3. Repository Structure

```text
Cinnamon-Bistro-SE3112-Test-Automation/
├── .github/
│   └── workflows/
│       └── testing-pipeline.yml   # Multi-stage GitHub Actions CI/CD workflow
├── .config/
│   └── dotnet-tools.json          # Pinned local tool manifest (ReportGenerator 5.5.11)
├── docs/
│   ├── architecture.md            # SUT architecture & test harness design model
│   ├── testing-plan.md            # Master QA strategy, tooling & quality gates
│   ├── team-contribution.md       # Team responsibilities, RACI & demo deliverables
│   ├── team-integration-guide.md  # Detailed team handover contracts & isolation rules
│   └── academic-demo-guide.md     # Spoken pitch script & technical defense guide
├── quality-checks/                # Phase 1 & 2 Static analysis, coverage gates & runners
│   ├── baselines/
│   │   └── eslint-baseline.json   # Flat ESLint historical baseline signatures (129 findings)
│   ├── compare-eslint-baseline.js # Composite multiset signature regression gate evaluator
│   ├── coverlet.runsettings       # Coverlet assembly filtering configuration
│   ├── process-coverage.js        # Automated coverage threshold gate evaluator
│   ├── run-quality-checks.sh      # Cross-platform Bash pipeline harness
│   └── run-quality-checks.ps1     # Cross-platform PowerShell pipeline harness
├── load-tests/                    # Load & performance test suites (D.M.N. Presanjith)
│   ├── scripts/
│   │   ├── smoke.js               # 1 VU, 10s sanity & healthcheck script
│   │   ├── baseline.js            # 2 VUs, 30s low-concurrency baseline script
│   │   ├── reservation-load.js    # Ramp to 20 VUs, 60s load benchmark script
│   │   ├── stress.js              # Ramp to 40 VUs, 65s concurrency stress script
│   │   └── shared.js              # Shared HTTP 200, valid JSON, and available checks
│   ├── evidence/                  # Raw execution logs, SVG comparison chart & evidence index
│   ├── LOAD_TESTING_REPORT.md     # Comprehensive technical performance test report
│   └── results-summary.md         # Multi-profile latency and throughput comparison summary
├── unit-tests/                    # Isolated xUnit domain tests & Moq doubles (Perera H.L.P.S.)
├── e2e-tests/                     # Playwright automated customer journeys (H.R.M.A.A. Bandara)
├── mutation-tests/                # Reserved exploratory scope (Not individually assessed)
├── scripts/                       # Automation and runner helper scripts
│   ├── process-load-summary.js    # k6 summary JSON parser & GITHUB_STEP_SUMMARY generator
│   └── README.md                  # Script guidelines, standards, and utilities documentation
├── test-reports/                  # Consolidated output directory for CI artifacts (.gitkeep)
├── .gitignore                     # Git exclusion rules (private logs, test-reports, caches)
└── README.md                      # Project overview, team roles & documentation hub
```

---

## 4. Team Contributions & Governance Roster

Each team member owns exactly one distinct individual testing area. The shared CI/CD pipeline is coordinated by the Group Leader with active integration by all members:

| Student Name | Student ID | Individual Testing Area | Group Role | Implementation Deliverables & Verifiable PRs |
| :--- | :---: | :--- | :--- | :--- |
| **Wijesinghe K** | `IT24102587` | **Code Quality & Metrics** | **Group Leader & CI Pipeline Lead** | • Decoupled repository architecture and branching governance.<br>• Multi-stage GitHub Actions pipeline (`testing-pipeline.yml`).<br>• ESLint baseline regression gate ($\Delta_{\text{new errors}} = 0$).<br>• Automated execution of 570 unit tests & Coverlet coverage.<br>• Automated k6 CI smoke suite integration (PR #9).<br>• Authored team handover guide (`docs/team-integration-guide.md`, PR #5). |
| **D.M.N. Presanjith**| `IT24101505` | **Load & Performance Testing**| QA Automation Engineer | • Authored Grafana k6 performance suite (`load-tests/scripts/`).<br>• Executed 4 local workload profiles (Smoke, Baseline, Load, Stress).<br>• Measured throughput and latency percentiles (p95/p99).<br>• Authored `LOAD_TESTING_REPORT.md` and `results-summary.md` (PR #8). |
| **Perera H.L.P.S.** | `IT24101848` | **Unit Testing & Mocking** | QA Automation Engineer | • Authoring service-level unit tests and boundary analysis (`[Theory]`).<br>• In-memory Moq test doubles isolating repository dependencies.<br>• *Integration Status:* Integration ready under `unit-tests/` (Pending PR). |
| **H.R.M.A.A. Bandara**| `IT24100315` | **UI / End-to-End Testing** | QA Automation Engineer | • Authoring customer journey tests using Playwright & headless Chromium.<br>• Mode 1 (Mocked Browser Testing via `page.route()`) for deterministic CI.<br>• *Integration Status:* Integration ready under `e2e-tests/` (Pending PR). |

---

## 5. GitHub Actions CI/CD Pipeline Implementation

The CI/CD pipeline definition ([`.github/workflows/testing-pipeline.yml`](.github/workflows/testing-pipeline.yml)) runs on `ubuntu-latest` and is triggered on every `push` and `pull_request` targeting `develop` and `main`.

### Pipeline DAG Workflow Topology
```text
[1. foundation-check] ──► [2. quality-checks] ──► Parallel Execution:
       (PASSED)                  (PASSED)               ├──► [3. unit-tests (Placeholder)] ──► [4. mutation-tests (Notice)]
                                                        ├──► [5. e2e-tests  (Placeholder)]
                                                        └──► [6. load-tests (k6 Smoke - PASSED)]
                                                                     │
[7. publish-reports] ◄───────────────────────────────────────────────┘
       (PASSED)
```

### Stage Execution Breakdown
1. **`foundation-check` (`PASSED`, ~8s):** Validates directory structure taxonomy, script executability, and workspace cleanliness.
2. **`quality-checks` (`PASSED`, ~2m 01s):**
   - Dynamically checks out the CSP application into `target-app/`.
   - Restores .NET 10 SDK and repository-local tools manifest (`ReportGenerator` v5.5.11).
   - Audits React frontend via baseline-aware ESLint gate: catalogs 129 legacy findings, verifies **$\Delta_{\text{new errors}} = 0$**.
   - Validates .NET 10 static build and audits NuGet dependencies (**0 vulnerabilities detected**).
   - Automatically executes **570 pre-existing CSP unit tests** (100% pass rate: 122 Identity, 448 Reservation).
   - Collects Coverlet coverage and enforces automated quality gate floors via `process-coverage.js` (**44.9% Line**, **42.4% Branch**).
   - Generates interactive HTML dashboard and uploads `quality-and-coverage-reports` artifact bundle.
3. **`unit-tests` (`Integration Ready Placeholder`):** Configured with integration contract; awaiting check-in of Perera's xUnit suite.
4. **`mutation-tests` (`Reserved / Notice Only`):** Explicitly logs notice confirming mutation testing is an unassigned exploratory scope.
5. **`e2e-tests` (`Integration Ready Placeholder`):** Configured with integration contract; awaiting check-in of Bandara's Playwright suite.
6. **`load-tests` (`PASSED`, ~52s — PR #9):**
   - Launches isolated `reservation-service` in the background with `Kafka__PublisherEnabled=false` and `OrderExpiry__Enabled=false`.
   - Runs a 30-second bounded `curl` healthcheck probe against `GET /api/tables/availability`.
   - Executes pinned Grafana k6 (`v0.54.0`) smoke suite: 20 requests over 10 seconds.
   - Evaluates latency thresholds via `scripts/process-load-summary.js` (**p95: 11.53ms < 1000ms SLA**, **0.00% error rate**, **60/60 checks passed**).
   - Safely terminates background process via PID and uploads `load-testing-reports` artifact bundle.
7. **`publish-reports` (`PASSED`, ~5s):** Publishes executive quality table and load testing metrics to `$GITHUB_STEP_SUMMARY`.

### Downloadable CI Artifact Bundles
Every passing pipeline execution packages and uploads consolidated artifacts accessible from the GitHub Actions run summary:
- **`quality-and-coverage-reports.zip`:** Contains raw Cobertura XMLs, ESLint JSON findings, `process-coverage.js` evaluation logs, and the complete ReportGenerator interactive HTML dashboard.
- **`load-testing-reports.zip`:** Contains backend startup logs, k6 console logs, `smoke-summary.json`, and rendered Markdown performance tables.

---

## 6. Verified Empirical Quality & Performance Metrics

All metrics reported below have been empirically measured and verified on branch `develop` (HEAD: `489e4fe`):

### 6.1 Code Quality & Coverage Metrics (Wijesinghe K)
- **Backend Unit Tests:** **570 / 570 Passed (100% pass rate)**.
  - *Academic Note:* These 570 tests exist in the base CSP application; the assessed contribution is automating their compilation, execution, Coverlet coverage instrumentation, and gate enforcement.
- **Combined Line Coverage:** **`44.9%`** (1,478 / 3,288 lines) vs. **$\ge 40.0\%$ Quality Gate Floor** -> **`PASSED`**.
- **Combined Branch Coverage:** **`42.4%`** (393 / 926 branches) vs. **$\ge 35.0\%$ Quality Gate Floor** -> **`PASSED`**.
- **Frontend ESLint Regression Gate:** **`PASSED`** ($\Delta_{\text{new errors}} = 0$ against 129 cataloged historical findings).
- **NuGet Vulnerability Audit:** **0 CVEs Detected** across all transitive dependencies.

### 6.2 Load & Performance Testing Metrics (D.M.N. Presanjith)
- **Four Local Workload Profiles (PR #8):**
  - *Smoke (1 VU, 10s):* 20 requests, 1.99 req/s, p95: **`1.37 ms`**, 0.00% failures, 100% checks passed (**PASSED**).
  - *Baseline (2 VUs, 30s):* 120 requests, 3.99 req/s, p95: **`1.06 ms`**, 0.00% failures, 100% checks passed (**PASSED**).
  - *Load (20 VUs, 60s):* 1,120 requests, 18.61 req/s, p95: **`1.08 ms`**, 0.00% failures, 100% checks passed (**PASSED**).
  - *Stress (40 VUs, 65s):* 2,533 requests, 38.86 req/s, p95: **`1.19 ms`**, 0.00% failures, 100% checks passed (**PASSED**).
- **Automated GitHub Actions CI Smoke Gate (PR #9):**
  - 1 VU for 10.0 seconds, 20 HTTP requests, **1.98 requests/second**.
  - **p95 Latency:** **`11.53 ms`** (Threshold: $p(95) < 1000\text{ms}$ -> **`PASSED`**, 86.7x safety margin).
  - **HTTP Failures:** **`0.00%`** (0 / 20 failed) | **Checks:** **`60 / 60 passed (100.0%)`**.
  - **Scope Delineation:** Only the Smoke profile executes in CI to prevent runner contention; multi-user profiles are local capacity benchmarks.

---

## 7. Local Setup & Execution Guide

### Prerequisites
- **Git** (2.40+)
- **.NET SDK 10.0** (`dotnet --version`)
- **Node.js 20.x or 22.x** and **npm** (`node --version`)
- *(Optional for local performance runs)* **Grafana k6** v0.54+ (`k6 version`)

### 1. Clone the Repositories
Clone the testing repository and the target CSP application into sibling directories:
```bash
git clone https://github.com/Smart-Restaurant-Management-System1/Cinnamon-Bistro-SE3112-Test-Automation.git
git clone https://github.com/Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System.git target-app
```

### 2. Run Code Quality & Coverage Checks Locally
Restore pinned local tools, then execute the cross-platform harness:

**On Linux / macOS (Bash):**
```bash
cd Cinnamon-Bistro-SE3112-Test-Automation
dotnet tool restore
chmod +x quality-checks/run-quality-checks.sh
./quality-checks/run-quality-checks.sh ../target-app
```

**On Windows (PowerShell):**
```powershell
cd Cinnamon-Bistro-SE3112-Test-Automation
dotnet tool restore
.\quality-checks\run-quality-checks.ps1 -TargetAppPath ..\target-app
```
*Generated reports will be available under `test-reports/quality/` and `test-reports/coverage/reports/index.html`.*

### 3. Run Load & Performance Tests Locally
Start the reservation microservice locally in an isolated terminal:
```bash
cd target-app/backend/reservation-service
export Kafka__PublisherEnabled=false
export OrderExpiry__Enabled=false
dotnet run --urls "http://localhost:5000"
```

In another terminal, execute k6 test profiles from the testing repository:
```bash
cd Cinnamon-Bistro-SE3112-Test-Automation

# Smoke Profile (1 VU, 10s)
k6 run --summary-export=test-reports/load/smoke-summary.json load-tests/scripts/smoke.js

# Baseline Profile (2 VUs, 30s)
k6 run --summary-export=test-reports/load/baseline-summary.json load-tests/scripts/baseline.js

# Load Profile (Ramp to 20 VUs, 60s)
k6 run --summary-export=test-reports/load/load-summary.json load-tests/scripts/reservation-load.js

# Stress Profile (Ramp to 40 VUs, 65s)
k6 run --summary-export=test-reports/load/stress-summary.json load-tests/scripts/stress.js
```

### 4. Process Metric Summaries via Helper Scripts
```bash
# Evaluate coverage thresholds (Line >= 40%, Branch >= 35%)
node scripts/process-coverage.js test-reports/coverage/reports/Summary.json --min-line-coverage 40.0 --min-branch-coverage 35.0

# Parse k6 summary JSON and evaluate SLA thresholds
node scripts/process-load-summary.js test-reports/load/smoke-summary.json
```

---

## 8. Documentation Hub & Key Links

- **Testing Repository:** [Cinnamon-Bistro-SE3112-Test-Automation](https://github.com/Smart-Restaurant-Management-System1/Cinnamon-Bistro-SE3112-Test-Automation)
- **Target CSP Application:** [Smart-Restaurant-Management-System](https://github.com/Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System)
- **CI/CD Workflow Definition:** [`.github/workflows/testing-pipeline.yml`](.github/workflows/testing-pipeline.yml)
- **Architecture Specification:** [`docs/architecture.md`](docs/architecture.md)
- **Quality Assurance Master Plan:** [`docs/testing-plan.md`](docs/testing-plan.md)
- **Team Ownership & RACI Matrix:** [`docs/team-contribution.md`](docs/team-contribution.md)
- **Team Integration Handover Guide:** [`docs/team-integration-guide.md`](docs/team-integration-guide.md)
- **Code Quality Harness Documentation:** [`quality-checks/README.md`](quality-checks/README.md)
- **Load Testing Suite Documentation:** [`load-tests/README.md`](load-tests/README.md)
- **Load Testing Empirical Report:** [`load-tests/LOAD_TESTING_REPORT.md`](load-tests/LOAD_TESTING_REPORT.md)
- **Load Testing Results Summary:** [`load-tests/results-summary.md`](load-tests/results-summary.md)
- **Automation Scripts Documentation:** [`scripts/README.md`](scripts/README.md)

---

*Repository maintained by Wijesinghe K (`IT24102587`), CI/CD Pipeline Lead & Group Leader.*
