# Test Automation Architecture & System Overview

## 1. Introduction & Context

This document outlines the testing architecture for the **SE3112 Advanced Software Engineering** quality assurance initiative, targeting the **Cinnamon Bistro SE3022 Cloud Services Platform (CSP)**.

Cinnamon Bistro is an enterprise-grade restaurant management and customer ordering platform designed as a distributed microservice system. To ensure zero-downtime reliability, data integrity, and strict SLA compliance, this repository decouples testing harnesses, synthetic workloads, and verification pipelines from the operational codebase.

---

## 2. System Under Test (SUT): Cinnamon Bistro CSP

The Cinnamon Bistro CSP microservice architecture typically consists of distinct distributed domains:

```mermaid
flowchart TD
    Client["Clients (Web / Mobile / Admin)"] --> Gateway["API Gateway / Reverse Proxy"]
    
    subgraph Core Services
        Gateway --> Auth["Authentication & User Service"]
        Gateway --> Menu["Menu & Catalog Service"]
        Gateway --> Order["Order Management Service"]
        Gateway --> Table["Table Reservation Service"]
        Gateway --> Billing["Payment & Billing Service"]
    end

    subgraph Asynchronous & Event Bus
        Order -.-> Broker["Message Broker / Event Stream"]
        Broker -.-> Notification["Notification Service"]
        Broker -.-> Analytics["Reporting & Analytics"]
    end

    subgraph Data Stores
        Auth --- AuthDB[("Auth DB")]
        Menu --- MenuDB[("Menu DB")]
        Order --- OrderDB[("Order DB")]
        Table --- TableDB[("Table DB")]
        Billing --- BillingDB[("Billing DB")]
    end
```

### Key Architectural Characteristics
- **Loosely Coupled Services**: Microservices communicate over RESTful APIs and asynchronous message queues.
- **Polyglot & Isolated Persistence**: Microservices maintain independent databases preventing cross-domain schema coupling.
- **Dynamic Routing & Security**: Centralized API Gateway handles rate limiting, authentication verification, and route proxying.

---

## 3. Test Automation Pipeline Architecture

The automated testing harness operates as an external, multi-tier validation layer interacting with the Cinnamon Bistro CSP microservices across various deployment environments (Local Mock, CI Ephemeral Containers, and Staging).

```mermaid
flowchart LR
    subgraph Test Harness Architecture
        QC["Static Quality Checks\n(Lint, SAST, Audit)"]
        Unit["Unit Tests\n(Mocked Dependencies)"]
        Mutation["Mutation Engine\n(Fault Injection)"]
        E2E["E2E & Integration Harness\n(API Contracts, Scenarios)"]
        Load["Load & Performance Engine\n(k6 / Virtual Users)"]
    end

    subgraph Execution & CI/CD
        Workflow["GitHub Actions CI Pipeline"]
        Artifacts["Aggregated Reports\n(HTML, JUnit, Coverage)"]
    end

    subgraph Target Environments
        Docker["Docker Compose / Test Containers"]
        CSP["Cinnamon Bistro CSP Microservices"]
    end

    Workflow --> QC
    Workflow --> Unit
    Workflow --> Mutation
    Workflow --> E2E
    Workflow --> Load

    E2E --> Docker
    Load --> Docker
    Docker --> CSP

    QC --> Artifacts
    Unit --> Artifacts
    Mutation --> Artifacts
    E2E --> Artifacts
    Load --> Artifacts
```

---

## 4. Layered Quality Strategy

| Test Layer | Target Boundary | Isolation Strategy | Verification Goal |
| :--- | :--- | :--- | :--- |
| **Quality Checks** | Source Code & Configs | Static (no execution) | Ensure code style, catch common vulnerabilities, and maintain dependency hygiene. |
| **Unit Testing** | Classes, Methods, Business Logic | Full Isolation (stubs, mocks, fakes) | Verify algorithms, state transitions, validation rules, and error handling. |
| **Mutation Testing** | Unit Test Assertions & Logic | Fault Injection | Validate that test assertions fail when code mutants are introduced (killing mutants). |
| **End-to-End (E2E)** | API Gateway & Service Chains | Ephemeral containerized instances | Ensure integrated user workflows (e.g., browse menu -> reserve table -> place order -> bill payment). |
| **Load Testing** | Ingress, Endpoints, Persistence | Target service instances under load | Benchmark throughput (RPS), p95/p99 latency, degradation thresholds, and stability under peak traffic. |

---

## 5. Artifact & Report Management

All testing tools are configured to output machine-readable and human-readable reports to the centralized `test-reports/` directory.

During CI execution in GitHub Actions:
1. Each job writes test outcomes (e.g., JUnit XML, lcov coverage, HTML dashboards).
2. The CI pipeline bundles these outputs into persistent downloadable workflow artifacts.
3. Quality gates evaluate coverage and pass/fail thresholds before signaling merge readiness.

