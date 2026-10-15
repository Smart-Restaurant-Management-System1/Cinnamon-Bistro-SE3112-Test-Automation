# Academic Demonstration & VIVA Defense Guide

**Project:** Cinnamon Bistro Automated Testing Pipeline (SE3112 Advanced Software Engineering)<br/>
**Assigned Student:** Wijesinghe K (`IT24102587`)<br/>
**Roles:** Group Leader / CI/CD Pipeline Lead & Code Quality & Metrics Lead<br/>
**Target Application:** Cinnamon Bistro SE3022 Cloud Services Platform (CSP) `develop` branch

---

## 1. Two-Minute Live Demonstration Pitch Script

Use this structured script during the 2-minute individual demonstration:

> **[0:00 - 0:25] Introduction & Responsibility Scope**
>
> *"Good morning/afternoon. I am Wijesinghe K (IT24102587). In our SE3112 group project, I hold dual responsibility: first, as the Group Leader orchestrating the shared GitHub Actions CI/CD automation pipeline; and second, as the individual owner of the **Code Quality & Metrics** testing dimension. Our goal is to enforce rigorous, automated quality gates against the live Cinnamon Bistro microservice repository without modifying upstream source code."*

> **[0:25 - 0:55] Frontend Static Analysis & Baseline-Aware Quality Gate**
>
> *"Our first major engineering challenge was the React frontend. Running standard ESLint against the unmodified CSP develop branch revealed 129 historical findings—40 errors and 89 warnings. Rather than suppressing rules or altering application code, I architected a **transparent, baseline-aware regression gate**. Findings are identified by a composite signature—normalized path, rule ID, and primary message—using multiset frequency matching. This makes the gate completely immune to line shifts. The pipeline permits zero new errors, guaranteeing no regressions while openly disclosing technical debt in our generated Markdown and JSON reports."*

> **[0:55 - 1:30] Backend Test Execution & Automated Code Coverage**
>
> *"On the backend, our pipeline restores and compiles both ASP.NET Core microservices (.NET 10), audits NuGet dependencies for CVEs, and automatically executes 570 real xUnit unit tests—122 for Identity Service and 448 for Reservation Service—achieving a 100% test pass rate. Using Coverlet and a version-pinned ReportGenerator tool, we aggregate statement and branch coverage into an interactive HTML dashboard. We measured an overall **44.9% line coverage** (1,478 of 3,288 lines) and **42.4% branch coverage** (393 of 926 branches), enforcing an automated regression floor at 40%."*

> **[1:30 - 2:00] Pipeline Leadership & Team Integration Readiness**
>
> *"As shared pipeline lead, I designed modular, non-interfering integration contracts for my teammates—Perera for Unit Testing, Bandara for UI/E2E, and Presanjith for Load Testing. All stages output deterministically to `test-reports/` and publish directly to GitHub Step Summaries. In summary, my contribution provides an enterprise-grade, reproducible quality foundation ready for full team delivery."*

---

## 2. Technical Decisions & Architectural Rationale

| Decision | Alternative Considered | Engineering Rationale |
| :--- | :--- | :--- |
| **Baseline-Aware ESLint Gate** | Modifying CSP code or using `eslint-disable` / `\|\| true` | Preserves the system-under-test as an external, immutable entity while providing strict regression protection without hiding technical debt. |
| **Path + Rule + Message Signature** | Line-number matching | Line numbers shift whenever upstream files are refactored or formatted, causing false-positive regression alerts. |
| **Multiset Frequency Matching** | Set existence matching | Accounts for multiple identical violations within a single file (e.g. multiple `setState` calls in `useEffect`). |
| **Pinned Local Tool Manifest (`.config/dotnet-tools.json`)** | Global dotnet tool install | Guarantees identical ReportGenerator version (`5.5.11`) across local developer workstations and CI runners without administrative privileges. |
| **Deterministic Result Directories** | Default `TestResults/` GUID folders | Enables reliable CI aggregation, report publishing, and predictable artifact upload targets. |
| **Advisory Formatting Check** | Blocking formatting gate | Prevents pipeline obstruction due to pre-existing whitespace discrepancies in baseline CSP repository. |

---

## 3. Potential VIVA Questions & Rigorous Short Answers

### Q1: Why did you implement a baseline-aware quality gate instead of fixing the 40 ESLint errors in the application?
**Answer:** *"In enterprise QA automation and SE3112 guidelines, the application under test is treated as an external, immutable artifact. Modifying application code in the testing repository violates separation of concerns. The baseline-aware gate ensures zero new errors are introduced by new commits while cataloging historical technical debt transparently."*

### Q2: Why exclude line numbers from the ESLint finding signature?
**Answer:** *"If a developer adds a three-line comment at the top of a file, every subsequent line number shifts by three. A naive line-based diff would falsely flag all pre-existing findings as new regressions. By indexing on normalized path, rule ID, and message, findings remain stable regardless of line shifts."*

### Q3: What is the difference between Clean Lint Status and Regression Gate Status?
**Answer:** *"Clean Lint Status evaluates whether total errors and warnings equal zero, which is currently FAILED (129 findings) reflecting true upstream state. Regression Gate Status evaluates whether $\Delta_{\text{new errors}} = 0$, which is currently PASSED, verifying that recent changes introduced zero new bugs."*

### Q4: Why is the backend line coverage 44.9% and not 80% or 90%?
**Answer:** *"The 44.9% line coverage and 42.4% branch coverage represent the authentic, measured baseline across 570 real unit tests in the CSP repository. Fabricating fake tests or mocking entire assemblies to reach an arbitrary 80% violates academic integrity. Our quality gate enforces a 40.0% regression floor to ensure future commits only improve coverage."*

### Q5: How do you prevent test code from skewing production coverage figures?
**Answer:** *"Through `quality-checks/coverlet.runsettings`, we explicitly include only production assemblies `[identity-service]*` and `[reservation-service]*`, while excluding test assemblies `[*tests*]*`, test runners `[xunit*]*`, mocks `[Moq*]*`, and EF Core database migrations `[*]*.Migrations.*`."*

### Q6: How does the CI pipeline accommodate your three teammates?
**Answer:** *"I authored formal integration contracts in `docs/team-contribution.md` specifying target directories (`unit-tests/`, `e2e-tests/`, `load-tests/`), entry-point commands, required environment variables, and artifact destinations (`test-reports/<area>/`). Their pipeline jobs are preserved with explicit integration-ready statuses."*

---

## 4. Evidence Capture Checklist for Final Submission

Ensure the following artifacts and screenshots are captured for the individual report and demonstration:

- [ ] **GitHub Actions Workflow Run**: Successful green run of `quality-checks` job showing all 6 stages passing.
- [ ] **GitHub Step Summary**: Screenshot of consolidated Markdown dashboard showing the 6 gate statuses and coverage tables.
- [ ] **Interactive HTML Coverage Dashboard**: Screenshot of `test-reports/coverage/reports/index.html` showing overall line coverage (44.9%) and assembly breakdowns.
- [ ] **Risk Hotspots View**: Screenshot from ReportGenerator HTML showing uncovered methods and CRAP scores.
- [ ] **ESLint Baseline Breakdown**: Screenshot of `test-reports/quality/eslint-summary.md` showing 40 errors, 89 warnings, 0 regressions.
- [ ] **Unit Test Execution Log**: Terminal output proving 570 passed tests (122 in identity-service, 448 in reservation-service).
- [ ] **Fault Injection Demonstration**: Screenshot showing CI failure when a synthetic error or low coverage threshold is injected.
- [ ] **Git Log & Clean Tree**: Terminal output of `git log -n 5 --oneline` and `git status` verifying clean branch state.
