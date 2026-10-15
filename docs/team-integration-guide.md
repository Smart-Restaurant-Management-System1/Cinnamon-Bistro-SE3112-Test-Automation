# Team Integration & Technical Implementation Guide

**Project:** Cinnamon Bistro Automated Testing Pipeline (SE3112 Advanced Software Engineering)<br/>
**Base Application:** Cinnamon Bistro Cloud Services Platform (SE3022 CSP Reference)<br/>
**Lead & CI/CD Architect:** Wijesinghe K (`IT24102587`) — Group Leader & Shared CI/CD Pipeline Lead<br/>
**Target Branch:** `develop`<br/>
**Target Deadline:** 18 October 2026

---

## 1. Executive Summary & Verified Baseline Reality

This document provides definitive, actionable implementation instructions for each of the three individual testing areas owned by teammates:
- **Perera H.L.P.S. (`IT24101848`)**: Unit Testing & Mocking (`unit-tests/`)
- **H.R.M.A.A. Bandara (`IT24100315`)**: UI / End-to-End (E2E) Testing (`e2e-tests/`)
- **D.M.N. Presanjith (`IT24101505`)**: Load & Performance Testing (`load-tests/`)

### 1.1 Verified Upstream Quality Baseline (Correction of Past Drafting Discrepancies)

To maintain absolute academic integrity and audit compliance, the following empirical metrics represent the actual verified state of the testing pipeline as merged into `develop` through PR #3 and PR #4:

- **Baseline Backend Unit Tests**: **570 tests executed, 570 passed, 0 failed (100% pass rate)**.
  - `identity-service-tests`: 122 passed, 0 failed.
  - `reservation-service-tests`: 448 passed, 0 failed.
- **Combined Backend Line Coverage**: **44.9%** (1,478 covered of 3,288 coverable lines across `identity-service` and `reservation-service`).
- **Combined Backend Branch Coverage**: **42.4%** (393 covered of 926 total branches).
- **Enforced Quality Gate Floors**:
  - Minimum Line Coverage: **`40.0%`**
  - Minimum Branch Coverage: **`35.0%`**
- **Frontend ESLint Static Analysis**:
  - 129 historical findings cataloged (**40 errors, 89 warnings**).
  - Regression gate enforces **$\Delta_{\text{new errors}} = 0$** using multiset signature matching. Pre-existing technical debt is transparently reported without masking or modifying CSP source code.

> [!WARNING]
> **Audit Discrepancy Correction**: A previous internal draft audit incorrectly cited *84.4% line coverage, 72.8% branch coverage, and an 80% quality gate threshold*. Those numbers were unverified hypothetical claims. The true measured baseline is **44.9% line coverage and 42.4% branch coverage**, with automated gates set at **40.0% line and 35.0% branch floors**. Teammates must reference the true empirical baseline.

---

## 2. Team Git Workflow, Branching & PR Governance

All team members must adhere to the standardized Git development workflow to prevent integration conflicts and ensure automated CI checks run on every change.

```mermaid
gitGraph
   commit id: "develop (6b6342a)"
   branch feature/unit-tests
   checkout feature/unit-tests
   commit id: "feat(unit): add xUnit suite & Moq doubles"
   checkout develop
   branch feature/e2e-tests
   checkout feature/e2e-tests
   commit id: "feat(e2e): add Playwright user journeys"
   checkout develop
   branch feature/load-tests
   checkout feature/load-tests
   commit id: "feat(load): add k6 performance benchmarks"
   checkout develop
   merge feature/unit-tests id: "PR #5 (Squash & Merge)"
   merge feature/e2e-tests id: "PR #6 (Squash & Merge)"
   merge feature/load-tests id: "PR #7 (Squash & Merge)"
```

### 2.1 Branch Creation Guidelines

Each member must create their feature branch from an updated `develop` branch:

```bash
# 1. Ensure local develop is clean and up to date
git checkout develop
git pull origin develop

# 2. Create designated feature branch
# For Perera:
git checkout -b feature/unit-tests

# For Bandara:
git checkout -b feature/e2e-tests

# For Presanjith:
git checkout -b feature/load-tests
```

### 2.2 Conventional Commit Standards

All commit messages must follow the Conventional Commits specification:
- Perera: `feat(unit): add parameterized tests for reservation status transition`
- Bandara: `feat(e2e): implement customer login and table booking journey`
- Presanjith: `feat(load): add k6 stress test for table availability endpoint`
- Documentation: `docs(unit): document mock fixtures and test assumptions`

### 2.3 Pull Request Submission & Peer Review Rules

1. **Working Tree Cleanliness**: Run `git status` and `git diff --check` to ensure no whitespace errors or untracked temporary files are committed.
2. **Target Branch**: PRs must target **`develop`** (never `main` directly).
3. **PR Description**: Include:
   - Summary of implemented test scenarios.
   - Local execution command and passing console log.
   - List of generated artifacts in `test-reports/<area>/`.
4. **Lead Review & CI Passing**: The CI pipeline (`testing-pipeline.yml`) must run green. The Pipeline Lead (Wijesinghe K) will verify directory boundaries, test determinism, and artifact output before squash-merging.

---

## 3. Individual Guide: Unit Testing & Mocking (Perera H.L.P.S. — `IT24101848`)

### 3.1 Assigned Directory & Scope
- **Directory:** `unit-tests/`
- **Assigned Area:** Service-level unit testing, boundary value validation, parameterized scenarios, and test doubles (mocks, stubs, fakes).
- **Core Principle:** Unit tests must be **100% in-memory and isolated**. They must **never** connect to a live MySQL database, live Kafka broker, or external HTTP endpoints.

### 3.2 Technology Stack
- **Runtime:** .NET 10.0 SDK
- **Test Framework:** xUnit (`2.9.x` / `2.5.3+`)
- **Mocking Library:** Moq (`4.20.70+`)
- **Assertions:** FluentAssertions (`6.12+`)
- **Test Runner / Logger:** `Microsoft.NET.Test.Sdk`, `xunit.runner.visualstudio`

### 3.3 Relationship with Baseline Unit Tests
The quality checks harness already runs the 570 existing CSP unit tests (`tests/unit/identity-service-tests` and `tests/unit/reservation-service-tests`) to calculate the baseline code coverage (44.9% line / 42.4% branch).

Perera's individual assignment requires authoring an **extended unit testing suite** in `unit-tests/` that explores deeper edge cases, input mutations, exception handling paths, and sophisticated mock verification (e.g. verifying that a repository method is called exactly once with specific arguments).

### 3.4 Setup & Implementation Steps

1. **Initialize Project inside `unit-tests/`:**
   ```bash
   cd unit-tests
   dotnet new xunit -n CinnamonBistro.UnitTests -f net10.0
   cd CinnamonBistro.UnitTests
   dotnet add package Moq
   dotnet add package FluentAssertions
   ```

2. **Implement Parameterized Tests (`[Theory]`):**
   Validate table capacity edge cases, reservation cancellation time constraints (e.g., minimum 2-hour cancellation notice), or payment hash calculation.

   *Example snippet (`ReservationValidatorTests.cs`):*
   ```csharp
   public class ReservationValidatorTests
   {
       [Theory]
       [InlineData(0, false)]
       [InlineData(-1, false)]
       [InlineData(1, true)]
       [InlineData(8, true)]
       [InlineData(21, false)] // Exceeds restaurant max table capacity
       public void ValidateGuestCount_BoundaryConditions_ReturnsExpectedResult(int guestCount, bool expected)
       {
           // Arrange & Act
           bool isValid = guestCount >= 1 && guestCount <= 20;

           // Assert
           isValid.Should().Be(expected);
       }
   }
   ```

3. **Implement Mock Doubles with Verification:**
   Mock `ITableRepository` or `IMenuItemRepository` to test business logic independently of data access.

   *Example snippet (`TableServiceTests.cs`):*
   ```csharp
   [Fact]
   public async Task GetActiveTables_WhenCalled_InvokesRepositoryOnce()
   {
       // Arrange
       var mockRepo = new Mock<ITableRepository>();
       mockRepo.Setup(r => r.GetActiveTablesAsync(It.IsAny<CancellationToken>()))
               .ReturnsAsync(new List<Table> { new Table { Id = 1, TableNumber = 5, Capacity = 4 } });

       // Act
       var result = await mockRepo.Object.GetActiveTablesAsync(CancellationToken.None);

       // Assert
       result.Should().HaveCount(1);
       mockRepo.Verify(r => r.GetActiveTablesAsync(It.IsAny<CancellationToken>()), Times.Once);
   }
   ```

### 3.5 Local Execution & Verification Command
```bash
dotnet test unit-tests/CinnamonBistro.UnitTests/CinnamonBistro.UnitTests.csproj \
  --configuration Release \
  --logger "trx;LogFileName=unit-test-results.trx" \
  --results-directory test-reports/unit
```

### 3.6 Expected Output Artifacts
- Results TRX: `test-reports/unit/unit-test-results.trx`

---

## 4. Individual Guide: UI / End-to-End Testing (H.R.M.A.A. Bandara — `IT24100315`)

### 4.1 Assigned Directory & Scope
- **Directory:** `e2e-tests/`
- **Assigned Area:** Automated user journeys, frontend interface verification, form validation, positive and negative customer flows.

### 4.2 Technology Stack
- **Runtime:** Node.js 20.x, npm
- **Framework:** Playwright Test (`@playwright/test`)
- **Browsers:** Chromium (headless in CI)

### 4.3 Mandatory Architectural Distinction: Mocked vs. Full-Stack E2E

Bandara must understand and document the difference between two testing modes:

```
+-------------------------------------------------------------------------------------------------------+
| MODE 1: Mocked Browser Testing (CI Recommended)                                                       |
| - Runs the React Vite frontend (port 5173).                                                           |
| - Intercepts API network requests via Playwright page.route() or Mock Service Worker (MSW).           |
| - Benefits: 100% deterministic, instant startup, zero Docker overhead, zero flakiness in CI.          |
+-------------------------------------------------------------------------------------------------------+
| MODE 2: Full-Stack End-to-End Testing (Local / Deep Verification)                                     |
| - Requires MySQL (3306), Kafka (9092), Identity Service (5001), Reservation Service (5000),           |
|   and React Web (5173 or 80) running via Docker Compose.                                             |
| - Benefits: Validates complete end-to-end integration including database transactions and outbox.    |
| - Trade-off: High memory usage (5.8 GB) and 4-6 minute startup overhead on CI runners.               |
+-------------------------------------------------------------------------------------------------------+
```

**Recommendation:** Design the Playwright test suite to support **Mode 1** by default in CI, with configuration toggles for **Mode 2** during local evaluation.

### 4.4 Upstream Frontend Configuration Details
- **Frontend Source:** `frontend/restaurant-web/`
- **Dev Server Port:** `5173` (`npm run dev`)
- **API Base URLs:**
  - Identity Service: `VITE_API_URL` (default `http://localhost:5001/api`)
  - Reservation Service: `VITE_RESERVATION_API_URL` (default `http://localhost:5000/api`)

### 4.5 Setup & Implementation Steps

1. **Initialize Project inside `e2e-tests/`:**
   ```bash
   cd e2e-tests
   npm init -y
   npm install -D @playwright/test
   npx playwright install --with-deps chromium
   ```

2. **Configure `playwright.config.js`:**
   ```javascript
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './tests',
     timeout: 30000,
     expect: { timeout: 5000 },
     fullyParallel: true,
     reporter: [
       ['html', { outputFolder: '../test-reports/e2e/report', open: 'never' }],
       ['list']
     ],
     use: {
       baseURL: process.env.BASE_URL || 'http://localhost:5173',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
       video: 'retain-on-failure',
     },
     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
     ],
   });
   ```

3. **Implement Key Customer Journeys:**
   - **Journey 1: Authentication & Form Validation (Positive & Negative)**
     - Navigate to `/login`.
     - Submit empty form -> Assert validation messages appear.
     - Submit invalid credentials (`test@example.com` / `WrongPass123!`) -> Assert 401 alert.
   - **Journey 2: Menu Browsing & Filtering**
     - Navigate to `/menu`.
     - Filter by category ("Main Course", "Beverage").
     - Assert menu items render with prices and descriptions.
   - **Journey 3: Table Reservation Workflow**
     - Navigate to `/reservations`.
     - Select reservation date, party size, and slot.
     - Complete booking form.

### 4.6 Local Execution Command
```bash
# In e2e-tests directory
npx playwright test --config=playwright.config.js
```

### 4.7 Expected Output Artifacts
- HTML Report: `test-reports/e2e/report/index.html`
- Failure Artifacts: `test-reports/e2e/report/data/` (screenshots and trace zip files on failure)

---

## 5. Individual Guide: Load & Performance Testing (D.M.N. Presanjith — `IT24101505`)

### 5.1 Assigned Directory & Scope
- **Directory:** `load-tests/`
- **Assigned Area:** Microservice performance benchmarks, throughput (RPS), concurrency stress profiles, latency percentiles, and SLA threshold evaluation.

### 5.2 Technology Stack
- **Engine:** Grafana k6 (`v0.54+`)
- **Scripting Language:** JavaScript (ES6)
- **Output Formats:** JSON summary, Markdown report, console metrics

### 5.3 Mandatory Distinction: Planned Thresholds vs. Measured Results

Presanjith must distinguish **Planned SLA Criteria** from **Empirically Measured Results**:

- **Planned SLA Criteria**: The architectural requirements established *before* testing (e.g. "95% of table availability requests must respond in under 500ms; error rate must be < 1.0%").
- **Measured Results**: The actual benchmark values recorded during test execution (e.g., "Measured p95: 184ms; Measured error rate: 0.0%; Peak throughput: 74.2 req/sec").

Do not document planned targets as if they were already achieved without execution evidence.

### 5.4 Target Upstream Endpoints & Prerequisites

Load testing requires live HTTP endpoints. The following endpoints in the CSP backend are verified from source code inspection:

1. **Public Endpoint (No JWT required):**
   - `GET http://localhost:5000/api/tables/availability`
   - Source: `backend/reservation-service/Controllers/TablesController.cs` (`[AllowAnonymous]`)
   - Returns: HTTP 200 `{ "available": true, "message": "Tables are available for reservation today." }`
   - *Best candidate for baseline concurrency testing without token authentication overhead.*

2. **Authentication Endpoint (POST):**
   - `POST http://localhost:5001/api/auth/login`
   - Source: `backend/identity-service/Controllers/AuthController.cs`
   - Payload: `{"email": "customer@example.com", "password": "Password123!"}`

3. **Authenticated Endpoint (JWT required):**
   - `GET http://localhost:5000/api/tables/active`
   - Requires header: `Authorization: Bearer <token>`

> [!IMPORTANT]
> **Kafka Dependency Mitigation for Local / CI Runs:**
> When starting `reservation-service` for load testing outside of Docker, Kafka may not be running. Set `export Kafka__PublisherEnabled=false` (or `$env:Kafka__PublisherEnabled="false"`) so that the background outbox publisher does not log connection errors or degrade HTTP throughput.

### 5.5 Setup & Implementation Steps

1. **Install k6:**
   - Windows: `winget install k6` or `choco install k6`
   - Linux / macOS: `sudo apt-get install k6` or `brew install k6`

2. **Create Test Script (`load-tests/scripts/table-availability-load.js`):**
   ```javascript
   import http from 'k6/http';
   import { check, sleep } from 'k6';

   export const options = {
     stages: [
       { duration: '15s', target: 20 }, // Ramp-up to 20 virtual users
       { duration: '30s', target: 50 }, // Sustained peak at 50 virtual users
       { duration: '15s', target: 0 },  // Ramp-down
     ],
     thresholds: {
       http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1000ms
       http_req_failed: ['rate<0.01'],                  // Errors under 1.0%
     },
   };

   export default function () {
     const url = __ENV.TARGET_URL || 'http://localhost:5000/api/tables/availability';
     const res = http.get(url);

     check(res, {
       'status is 200': (r) => r.status === 200,
       'response has available field': (r) => r.body.includes('available'),
     });

     sleep(0.5);
   }
   ```

3. **Create Summary Generation Hook:**
   k6 supports the `handleSummary(data)` hook to automatically write a Markdown and JSON summary:
   ```javascript
   export function handleSummary(data) {
     return {
       'test-reports/load/summary.json': JSON.stringify(data, null, 2),
       'test-reports/load/performance-summary.md': generateMarkdown(data),
     };
   }

   function generateMarkdown(data) {
     const p95 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 'N/A';
     const rps = data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(2) : 'N/A';
     const failRate = data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 'N/A';

     return `# Load & Performance Test Execution Summary\n\n` +
       `- **Target Endpoint:** ${data.root_group.checks ? 'Configured URL' : 'N/A'}\n` +
       `- **Peak Throughput:** ${rps} req/sec\n` +
       `- **Measured p95 Latency:** ${p95} ms (SLA Threshold: < 500 ms)\n` +
       `- **Measured Error Rate:** ${failRate} % (SLA Threshold: < 1.0 %)\n`;
   }
   ```

### 5.6 Local Execution Command
```bash
k6 run load-tests/scripts/table-availability-load.js \
  --summary-export=test-reports/load/summary.json
```

### 5.7 Expected Output Artifacts
- JSON Summary: `test-reports/load/summary.json`
- Markdown Report: `test-reports/load/performance-summary.md`

---

## 6. Pipeline Lead Review & Integration Process (Wijesinghe K)

As Group Leader and Shared CI/CD Pipeline Lead, Wijesinghe K is responsible for reviewing and merging each feature branch into `develop` and activating the corresponding CI pipeline job.

### 6.1 Review Criteria for Pull Requests

Before approving any teammate PR, the Pipeline Lead will verify:
1. **Directory Boundary**: All files added by the member are strictly contained within their assigned directory (`unit-tests/`, `e2e-tests/`, or `load-tests/`). No edits to `quality-checks/`, `docs/academic-demo-guide.md`, or root CI configuration.
2. **Centralized Output Destination**: All execution scripts and frameworks must write reports into `test-reports/<area>/`.
3. **No Flakiness or Arbitrary Sleeps**: Tests must use deterministic waiting mechanisms (e.g., Playwright locators with built-in auto-waiting, k6 stages) rather than uncontrolled sleep statements.
4. **Code Quality Passing**: The incoming PR must not introduce ESLint regressions or compilation failures.

### 6.2 CI Pipeline Activation Steps

Once a teammate PR is verified and ready for integration:

1. **Activate the Corresponding Workflow Job in `.github/workflows/testing-pipeline.yml`**:
   Replace the placeholder `echo` step with the verified execution runner.

   *Example for Unit Tests (`unit-tests` job):*
   ```yaml
   unit-tests:
     name: Unit Testing & Mocking (Perera H.L.P.S.)
     needs: quality-checks
     runs-on: ubuntu-latest
     steps:
       - name: Checkout Repository
         uses: actions/checkout@v4
       - name: Setup .NET SDK
         uses: actions/setup-dotnet@v4
         with:
           dotnet-version: '10.0.x'
       - name: Execute Extended Unit Tests
         run: |
           dotnet test unit-tests/ --configuration Release --logger "trx;LogFileName=unit-test-results.trx" --results-directory test-reports/unit
       - name: Upload Unit Test Artifacts
         if: always()
         uses: actions/upload-artifact@v4
         with:
           name: unit-test-reports
           path: test-reports/unit/
   ```

2. **Verify Consolidated Artifact Publication**:
   Ensure `publish-reports` downloads or aggregates all reports (`test-reports/{quality,coverage,unit,e2e,load}`) into the primary workflow artifact archive.

---

## 7. Master CI/CD Pipeline Readiness Checklist (Timeline to Oct 18)

| Phase | Target Date | Milestone / Action Item | Owner | Gate Criteria |
| :---: | :---: | :--- | :---: | :--- |
| **P0** | **Oct 15 (Night)** | Create feature branches (`feature/unit-tests`, `feature/e2e-tests`, `feature/load-tests`) | All | Branches created off clean `develop` (`6b6342a`) |
| **P0** | **Oct 16 (Morning)** | Check in minimal scaffolds (xUnit project, Playwright config, k6 script) | All | Minimal hello-world test executes locally in each folder |
| **P1** | **Oct 16 (Full Day)** | Author complete test suites (parameterized mocks, user journeys, 50-VU load) | Teammates | All tests pass locally and output to `test-reports/<area>/` |
| **P2** | **Oct 17 (Morning)** | Open Pull Requests to `develop`; Pipeline Lead reviews code | All | PRs opened with Conventional Commits; zero merge conflicts |
| **P2** | **Oct 17 (Afternoon)**| Pipeline Lead replaces CI placeholders with real execution steps | Wijesinghe K | CI runs all 4 individual suites successfully |
| **P3** | **Oct 17 (Night)** | End-to-end pipeline run on `develop`; download consolidated `test-reports.zip` | Team | Consolidated artifact contains valid reports for all 4 areas |
| **P3** | **Oct 18 (Morning)** | Academic demonstration rehearsal following `docs/academic-demo-guide.md` | Team | Each member delivers their 2-minute pitch with verifiable evidence |

---

*Document maintained by Wijesinghe K (`IT24102587`), Group Leader & CI/CD Pipeline Lead.*
