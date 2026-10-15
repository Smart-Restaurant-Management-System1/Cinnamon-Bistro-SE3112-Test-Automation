# Cinnamon Bistro SE3112 Automated Testing Pipeline

[![CI Pipeline Status](https://img.shields.io/badge/CI-Pipeline%20Foundation-blue.svg)](#)
[![Module](https://img.shields.io/badge/Module-SE3112%20Advanced%20Software%20Engineering-orange.svg)](#)
[![Base Project](https://img.shields.io/badge/Base%20Project-SE3022%20Cinnamon%20Bistro%20CSP-green.svg)](#)

## 1. Project Overview

This repository hosts the centralized **Automated Testing & Quality Assurance Pipeline** developed for **SE3112: Advanced Software Engineering**. 

It builds upon the microservice ecosystem designed during the **SE3022 Cinnamon Bistro Cloud Services Platform (CSP)** project. While the core application repository manages operational services, domain logic, and persistent storage, this repository serves as a dedicated, decoupled quality engineering harness to validate, benchmark, and enforce software resilience across the distributed system.

---

## 2. Purpose & Objectives of Automated Quality Assurance

In modern distributed microservice architectures like Cinnamon Bistro, manual testing and ad-hoc verification are insufficient for ensuring reliability, data integrity, and strict SLA compliance. 

Implementing an automated quality assurance framework achieves the following critical engineering objectives:
- **Shift-Left Quality**: Identify regression bugs, logical flaws, and edge cases early in the development lifecycle before deployment.
- **Continuous Feedback**: Provide automated feedback on pull requests and commits to maintain a healthy build status across all service boundaries.
- **Service Isolation & Contract Verification**: Validate business logic and component interactions independently using mock objects and contract boundaries.
- **Real-World User Journey Validation**: Verify end-to-end customer workflows through automated UI and integration flows.
- **Performance & Capacity Profiling**: Benchmark SLA compliance, throughput, latency distributions (p90/p95/p99), and concurrency limits under heavy transactional loads.
- **Code Quality & Metric Visibility**: Enforce uniform coding standards, static analysis rules, and test coverage thresholds via automated pipeline gates.

---

## 3. Testing Categories & Assessment Scope

For **SE3112**, the testing strategy is structured into **four distinct individually assessed testing areas**, supported by a **shared group CI/CD automation pipeline**:

| Testing Area | Repository Directory | Ownership Classification | Individual / Lead Owner | Primary Scope & Objectives |
| :--- | :--- | :--- | :--- | :--- |
| **Code Quality & Metrics** | [`quality-checks/`](quality-checks/) | **Individual Area 1** | **Wijesinghe K**<br>`IT24102587` | Static code analysis, linters, code complexity metrics, security audits, and quality gate enforcement. |
| **UI / End-to-End (E2E) Testing** | [`e2e-tests/`](e2e-tests/) | **Individual Area 2** | **H.R.M.A.A. Bandara**<br>`IT24100315` | Automated frontend/UI testing, realistic customer workflows (auth, menu, orders, reservations where supported), positive & negative scenarios. |
| **Unit Testing & Mocking** | [`unit-tests/`](unit-tests/) | **Individual Area 3** | **Perera H.L.P.S.**<br>`IT24101848` | Service-level unit tests, parameterized tests, test doubles (mocks/stubs), business rules, boundary values, and exception paths. |
| **Load & Performance Testing** | [`load-tests/`](load-tests/) | **Individual Area 4** | **D.M.N. Presanjith**<br>`IT24101505` | Endpoint performance testing, concurrency and workload profiling, response times, throughput (RPS), and failure rate thresholds. |
| **Test Automation Pipeline** | [`.github/workflows/`](.github/workflows/) | **Shared Group Requirement** | **Wijesinghe K** *(Lead)*<br>*(All Members Contribute)* | Unified CI/CD workflow orchestration, automated test stage execution, artifact publishing, and PR status checks. |
| *Mutation Testing* | [`mutation-tests/`](mutation-tests/) | *Exploratory / Unassigned* | *None (Reserved)* | Retained in directory structure for potential exploration; **not** an individually assessed scope nor a completed group deliverable. |

---

## 4. Repository Structure

```text
.
├── .github/
│   └── workflows/
│       └── testing-pipeline.yml   # Staged GitHub Actions CI workflow skeleton
├── docs/
│   ├── architecture.md            # SUT architecture, testing harness design & ownership
│   ├── testing-plan.md            # Detailed QA plan for the 4 testing areas & quality gates
│   └── team-contribution.md       # Team responsibilities, RACI matrix & demo evidence
├── e2e-tests/                     # UI and End-to-End workflow tests (Owned by H.R.M.A.A. Bandara)
├── load-tests/                    # Load and performance test suites (Owned by D.M.N. Presanjith)
├── mutation-tests/                # Reserved / exploratory testing directory (Not individually assigned)
├── quality-checks/                # Linters, security scans & quality metrics (Owned by Wijesinghe K)
├── scripts/                       # Automation and runner helper scripts
│   └── README.md                  # Script guidelines, standards and planned utilities
├── test-reports/                  # Consolidated test execution and coverage outputs
├── unit-tests/                    # Isolated unit tests and mocks (Owned by Perera H.L.P.S.)
├── .gitignore                     # Git ignore rules for reports, logs, and dependencies
└── README.md                      # Project overview, team roles & documentation hub
```

---

## 5. Team Contributions & Governance

### 5.1 Official Team Roster & Individual Ownership

In accordance with SE3112 guidelines, each team member owns exactly one distinct individual testing area. The overall CI/CD pipeline is a shared collaborative responsibility, coordinated by the Group Leader.

| Student Name | Student Registration No. | Individual Testing Area | Additional Group Role | Core Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Wijesinghe K** | `IT24102587` | **Code Quality & Metrics** | **Group Leader / Pipeline Lead** | GitHub repository & branch management, CI/CD orchestration, static analysis configuration, quality gate thresholds, unified reporting, and group demo coordination. |
| **H.R.M.A.A. Bandara** | `IT24100315` | **UI / End-to-End (E2E) Testing** | QA Engineer (UI/E2E) | Automated frontend testing, customer journey verification (authentication, menu, ordering, reservations where supported), positive/negative UI scenarios, and E2E demo evidence. |
| **Perera H.L.P.S.** | `IT24101848` | **Unit Testing & Mocking** | QA Engineer (Unit/Mocking) | Service-level unit tests, parameterized test suites, test doubles (mocks/stubs), business rule validation, exception handling tests, and unit execution evidence. |
| **D.M.N. Presanjith** | `IT24101505` | **Load & Performance Testing** | QA Engineer (Performance) | Microservice endpoint load testing, realistic concurrency and workload profiles, latency (p90/p95/p99), throughput, error rate analysis, and performance demo evidence. |

### 5.2 Governance & Quality Collaboration
- **Shared Group Responsibility**: The GitHub Actions CI/CD pipeline integrates all four individual testing components into a cohesive automated workflow. Every member is responsible for ensuring their test suite passes within the CI environment.
- **Individual Accountability**: Each member is independently assessed on their designated testing area, including test design, implementation quality, CI execution, and demonstration evidence.
- For complete branching policies, Conventional Commit standards, RACI matrix, and individual demonstration guidelines, refer to [`docs/team-contribution.md`](docs/team-contribution.md).

---

## 6. Implementation Status & Getting Started

> **Current Status: Phase 2 Operational (Code Quality, Unit Testing & Code Coverage)**
>
> - **CI/CD Integration**: The shared GitHub Actions pipeline ([`.github/workflows/testing-pipeline.yml`](.github/workflows/testing-pipeline.yml)) checks out this testing repository alongside the original CSP repository from its `develop` branch into `target-app/`, restores pinned tools, and runs the unified quality and testing harness.
> - **Code Quality & Metrics**: Phase 2 automation is active under [`quality-checks/`](quality-checks/). It enforces baseline-aware ESLint checks (0 new regressions), backend .NET compilation & security audits, automated execution of 570 backend unit tests (100% pass rate), and ReportGenerator code coverage aggregation (44.9% line, 42.4% branch coverage) with an interactive HTML dashboard.
> - **Individual Testing Areas**: Explicit integration contracts and entry points are established in [`docs/team-contribution.md`](docs/team-contribution.md) for teammates' pending suites (Unit Testing & Mocking, UI/E2E Testing, Load Testing).
> - **Mutation Testing**: Preserved as an unassigned/exploratory directory; not claimed as an assessed or completed group requirement.

To explore project specifications and execution:
- **Code Quality Harness**: [`quality-checks/README.md`](quality-checks/README.md)
- **CI/CD Pipeline Definition**: [`.github/workflows/testing-pipeline.yml`](.github/workflows/testing-pipeline.yml)
- **System & Test Architecture**: [`docs/architecture.md`](docs/architecture.md)
- **Quality Assurance Master Plan**: [`docs/testing-plan.md`](docs/testing-plan.md)
- **Team Ownership & RACI Matrix**: [`docs/team-contribution.md`](docs/team-contribution.md)
- **Script Guidelines & Standards**: [`scripts/README.md`](scripts/README.md)
