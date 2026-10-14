# Cinnamon Bistro SE3112 Automated Testing Pipeline

[![CI Pipeline Status](https://img.shields.io/badge/CI-Pipeline%20Foundation-blue.svg)](#)
[![Module](https://img.shields.io/badge/Module-SE3112%20Advanced%20Software%20Engineering-orange.svg)](#)
[![Base Project](https://img.shields.io/badge/Base%20Project-SE3022%20Cinnamon%20Bistro%20CSP-green.svg)](#)

## 1. Project Overview

This repository hosts the centralized **Automated Testing & Quality Assurance Pipeline** developed for **SE3112: Advanced Software Engineering**. 

It builds upon the microservice ecosystem engineered during the **SE3022 Cinnamon Bistro Cloud Services Platform (CSP)** project. While the core application repository manages the business logic, API gateways, and domain services, this repository serves as a dedicated, decoupled quality engineering harness designed to test, validate, benchmark, and enforce software resilience across the distributed architecture.

---

## 2. Purpose & Objectives of Automated Quality Assurance

In modern distributed microservice architectures like Cinnamon Bistro, manual testing and ad-hoc verification are insufficient for ensuring reliability, fault tolerance, and predictable performance. 

Implementing an automated quality assurance framework achieves the following critical engineering objectives:
- **Shift-Left Quality**: Identify regression bugs, logical flaws, and edge-case exceptions early in the development lifecycle before reaching staging or production.
- **Continuous Feedback**: Provide instantaneous feedback on pull requests and commits to maintain a healthy build status across all microservice boundaries.
- **Fault Tolerance & Resilience Verification**: Systematically evaluate how services degrade under simulated network partitions, service outages, and invalid payloads.
- **Code Health & Mutability**: Prevent false confidence from raw line coverage by executing mutation testing to guarantee assertion efficacy.
- **Performance Profiling**: Benchmark SLA compliance, throughput, latency distributions, and concurrency limits under heavy transactional loads.

---

## 3. Testing Categories & Target Scope

The testing repository is modularized into distinct testing strategies, each addressing specific layers of the testing pyramid and quality engineering standards:

| Category | Directory | Description & Target Scope |
| :--- | :--- | :--- |
| **Unit Testing** | [`unit-tests/`](unit-tests/) | Isolated component and class-level tests validating business rules, calculations, and domain entities with mocked external dependencies. |
| **Mutation Testing** | [`mutation-tests/`](mutation-tests/) | Fault-injection suite measuring test quality by introducing syntactic mutants to verify test suite fault-detection capabilities. |
| **Load & Performance Testing** | [`load-tests/`](load-tests/) | Simulation of concurrent user workloads, peak-hour orders, stress limits, endurance, and spike profiles against API endpoints. |
| **End-to-End (E2E) Testing** | [`e2e-tests/`](e2e-tests/) | Integrated user journeys spanning API Gateway, authentication, ordering, inventory, billing, and notification microservices. |
| **Quality Checks & Static Analysis** | [`quality-checks/`](quality-checks/) | Static code analysis, security scanning, linting, formatting enforcement, and dependency vulnerability audits. |

---

## 4. Repository Structure

```text
.
├── .github/
│   └── workflows/
│       └── testing-pipeline.yml   # CI/CD automated workflow definition
├── docs/
│   ├── architecture.md            # System under test & test harness architecture
│   ├── testing-plan.md            # Test strategy, metrics, and execution plans
│   └── team-contribution.md       # Team responsibilities, branch policies & matrix
├── e2e-tests/                     # Integration and End-to-End workflow tests
├── load-tests/                    # Load, stress, and performance test suites
├── mutation-tests/                # Mutation testing configuration and test suites
├── quality-checks/                # Linters, security scanners, and static checks
├── scripts/                       # Automation scripts for setup and execution
│   └── README.md                  # Script catalogue and usage instructions
├── test-reports/                  # Output directory for test results and coverage
├── unit-tests/                    # Isolated unit test suites
├── .gitignore                     # Git ignore rules for reports, logs, dependencies
└── README.md                      # Project documentation and guidelines
```

---

## 5. Team Contributions & Governance

Quality assurance across the microservice suite is collaboratively owned by the engineering team. Individual contributions, branch workflows, and review standards are managed under strict pair programming and code review policies.

| Team Member | Role / Focus Area | Primary Responsibilities |
| :--- | :--- | :--- |
| *[Member 1 Name / Student ID]* | Quality Engineering Lead | CI/CD Pipeline, Quality Gates & Architecture |
| *[Member 2 Name / Student ID]* | Functional Testing Specialist | Unit Testing & Mutation Testing Framework |
| *[Member 3 Name / Student ID]* | Integration Testing Specialist | Microservice E2E & Contract Testing |
| *[Member 4 Name / Student ID]* | Performance & Security Engineer | Load, Stress Testing & Vulnerability Checks |

For detailed contribution guidelines, branch conventions, and grading accountability records, refer to [`docs/team-contribution.md`](docs/team-contribution.md).

---

## 6. Execution & Getting Started (Foundation Phase)

> **Note**: This repository currently establishes the initial architectural and CI/CD foundation. Test implementations and runner scripts will be populated in subsequent iterations in alignment with the [Testing Plan](docs/testing-plan.md).

To inspect the pipeline and repository documentation:
- Architecture Overview: [`docs/architecture.md`](docs/architecture.md)
- Testing Master Plan: [`docs/testing-plan.md`](docs/testing-plan.md)
- Pipeline Definition: [`.github/workflows/testing-pipeline.yml`](.github/workflows/testing-pipeline.yml)
