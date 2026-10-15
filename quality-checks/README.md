# Code Quality, Testing & Metrics Harness (Phase 2)

**Individual Testing Area 1:** Code Quality & Metrics  
**Responsible Owner:** Wijesinghe K (`IT24102587`) — Group Leader & Quality Lead  
**Target Repository:** Cinnamon Bistro SE3022 CSP (`develop` branch)

---

## 1. Overview & Objectives

The `quality-checks/` module implements automated static code analysis, code hygiene verification, baseline-aware regression gating, dependency vulnerability auditing, automated backend unit testing, and statement/branch code coverage measurement for the Cinnamon Bistro microservice ecosystem.

As part of the **Phase 2 implementation**, this module integrates:
1. Automated execution of 570 backend xUnit unit tests across `identity-service` and `reservation-service`.
2. Coverlet XPlat Code Coverage data collection with explicit assembly filtering.
3. Consolidated HTML coverage reporting and XML artifact generation via version-pinned ReportGenerator (`5.5.11`).
4. An automated code coverage quality gate enforcing baseline floors (40.0% line coverage, 35.0% branch coverage) to prevent regressions.

---

## 2. Implemented Quality & Testing Gates (Phase 2)

| Stage # | Check Category | Target Component | Tool / Engine | Gate Classification | Evaluation Policy |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Frontend Static Analysis** | React 19 / Vite Web App (`frontend/restaurant-web`) | ESLint (Flat Config) + Baseline Comparator | **Baseline-Aware Regression Gate** | **Strict 0 New Errors** beyond authorized baseline. 129 historical findings transparently disclosed. |
| **2** | **Backend Static Analysis & Build** | ASP.NET Core Web APIs (`backend/*/*.csproj`) | `dotnet build` (Release) with compiler analyzers | **Mandatory Gate** | Fails CI job on compilation or semantic errors (0 errors required). |
| **3** | **Backend Code Formatting** | C# Source Files | `dotnet format --verify-no-changes` | **Advisory Check** | Non-blocking style diagnostics logged (avoids rejecting baseline code). |
| **4** | **Dependency Security Audit** | NuGet Dependencies | `dotnet list package --vulnerable` | **Mandatory Gate** | Fails CI job on known vulnerable dependencies (0 CVEs required). |
| **5** | **Backend Automated Unit Tests** | xUnit Test Suites (`tests/unit/*/*.csproj`) | `dotnet test` (Release) | **Mandatory Gate** | **100% Test Pass Rate**: All 570 unit tests must pass (0 failures). |
| **6** | **Backend Automated Code Coverage** | ASP.NET Core Microservices | Coverlet + ReportGenerator (`5.5.11`) | **Coverage Floor Gate** | Enforces minimum baseline floor: **Line >= 40.0%**, **Branch >= 35.0%**. |

---

## 3. Frontend Baseline-Aware Quality Gate Architecture

### 3.1 The Problem: Baseline Technical Debt in the Original CSP Codebase
Direct execution of ESLint against the unmodified `develop` branch of the original Cinnamon Bistro CSP repository (`Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System`) reveals **129 total findings** across 57 files:
- **40 Errors**:
  - `react-hooks/set-state-in-effect`: 28 errors (calling `setState` synchronously within `useEffect` bodies)
  - `no-undef`: 8 errors (referencing undeclared browser/library symbols like `paypal`, `google`, `FB`)
  - `react-hooks/immutability`: 2 errors (direct mutation of state references)
  - `no-useless-assignment`: 1 error
  - `no-empty`: 1 error
- **89 Warnings**:
  - `no-unused-vars`: 74 warnings (unused imports, unused state declarations)
  - `react-hooks/exhaustive-deps`: 13 warnings (missing hook dependencies)
  - `react-refresh/only-export-components`: 2 warnings

### 3.2 Engineering Design Decisions
To maintain testing pipeline integrity without modifying original application code or masking issues:
1. **No Application Modification**: The CSP application code is treated as an external, immutable system-under-test.
2. **No Global Rule Suppression**: Rules in `eslint.config.js` are **not** disabled, weakened, or bypassed via `|| true`.
3. **Structured Machine-Readable Output**: ESLint is invoked with `--format json`, redirecting stdout to `test-reports/quality/eslint-results.json` and stderr to `frontend-lint.log`. Nonzero exit codes resulting from lint violations do not prevent JSON report generation.
4. **Stable Finding Identity & Multiset Frequency Matching**:
   Findings are tracked using a composite identity key:
   $$\text{Signature} = \text{NormalizedFilePath} \mathbin{::} \text{RuleId} \mathbin{::} \text{PrimaryMessage}$$
   - Line and column numbers are excluded from the identity key to prevent line drift.
   - Findings sharing identical keys within a file are tracked using **multiset frequency counts**. If $\text{CurrentCount} > \text{BaselineCount}$, the excess count is flagged as a new regression.
5. **Dual Evaluation Reporting**:
   - **Clean Lint Status**: Evaluates whether zero total errors and warnings exist in the codebase (`FAILED` due to historical baseline).
   - **Regression Gate Status**: Evaluates whether $\Delta_{\text{new errors}} = 0$ (`PASSED` when zero new errors are introduced).

---

## 4. Backend Automated Unit Testing & Code Coverage (Phase 2)

### 4.1 Actual Unit Test Execution Results
The quality harness discovers and executes all existing backend unit test projects under `tests/unit/`:

| Test Project | Target Service | Framework | Total Tests | Passed | Failed | Skipped |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `identity-service-tests.csproj` | `backend/identity-service` | xUnit 2.5.3 / Moq 4.20.70 | 122 | 122 | 0 | 0 |
| `reservation-service-tests.csproj` | `backend/reservation-service` | xUnit 2.5.3 / Moq 4.20.70 | 448 | 448 | 0 | 0 |
| **Combined Backend Total** | **Both Services** | **xUnit + Coverlet** | **570** | **570** | **0** | **0** |

### 4.2 Measured Code Coverage Metrics
Collected via `coverlet.collector` and aggregated using `dotnet-reportgenerator-globaltool` (v5.5.11):

| Coverage Dimension | Combined Baseline | `identity-service` | `reservation-service` | Quality Gate Threshold | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Line Coverage** | **44.9%** (1,478 / 3,288) | **46.6%** (227 / 487) | **44.6%** (1,251 / 2,801) | Baseline Floor: **>= 40.0%** | **PASSED** |
| **Branch Coverage** | **42.4%** (393 / 926) | **33.6%** (35 / 104) | **43.6%** (358 / 822) | Baseline Floor: **>= 35.0%** | **PASSED** |
| **Method Coverage** | **58.6%** (179 / 305) | **73.1%** (30 / 41) | **56.4%** (149 / 264) | Advisory Diagnostic | INFORMATIONAL |
| **Tested Code Volume** | **1,478 lines** | 227 lines | 1,251 lines | Verified Executable Volume | MEASURED |
| **Untested Code Gap** | **1,810 lines** | 260 lines | 1,550 lines | Technical Debt Disclosure | MEASURED |

### 4.3 Assembly Inclusion & Exclusion Settings
Configured via [`quality-checks/coverlet.runsettings`](coverlet.runsettings):
- **Included Assemblies:** `[identity-service]*`, `[reservation-service]*`
- **Excluded Assemblies:** `[*tests*]*` (unit test assemblies), `[xunit*]*`, `[Moq*]*`
- **Excluded Code:** `[*]*.Migrations.*` (EF Core database migrations), `[CompilerGeneratedAttribute]`, `[GeneratedCodeAttribute]`

---

## 5. Scripts & Tooling Inventory

- `quality-checks/coverlet.runsettings`: Runsettings configuration enforcing assembly inclusions and exclusions.
- `quality-checks/compare-eslint-baseline.js`: Portable Node.js baseline comparator and regression gate evaluator.
- `quality-checks/process-coverage.js`: Node.js processor for ReportGenerator `Summary.json`, enforcing coverage floors.
- `quality-checks/run-quality-checks.ps1`: Windows PowerShell harness runner.
- `quality-checks/run-quality-checks.sh`: Linux / CI/CD POSIX Bash harness runner.
- `.config/dotnet-tools.json`: Pinned local tool manifest for `dotnet-reportgenerator-globaltool` (v5.5.11).

---

## 6. Local Execution Guide

### On Windows PowerShell:
```powershell
# Restore pinned tools
dotnet tool restore

# Execute full Phase 2 harness against reference repository
powershell -ExecutionPolicy Bypass -File .\quality-checks\run-quality-checks.ps1 -TargetDir "..\Cinnamon-Bistro-CSP-Reference"
```

### On Linux / macOS / Git Bash:
```bash
# Restore pinned tools
dotnet tool restore

# Execute full Phase 2 harness
bash quality-checks/run-quality-checks.sh [optional-target-path]
```

### Viewing the Interactive HTML Coverage Dashboard:
Open the generated HTML report in your default browser:
```powershell
# Windows
Start-Process "test-reports/coverage/reports/index.html"

# Linux
xdg-open test-reports/coverage/reports/index.html
```

---

## 7. Generated Artifacts & Reports

Results are deterministically written to `test-reports/`:
- `test-reports/quality/quality-summary.md`: Consolidated summary of all 6 quality and testing stages.
- `test-reports/quality/eslint-summary.md`: ESLint findings breakdown by rule and regression delta.
- `test-reports/coverage/coverage-summary.md`: Formatted coverage tables, microservice breakdowns, and gate status.
- `test-reports/coverage/reports/index.html`: Human-readable interactive HTML coverage dashboard.
- `test-reports/coverage/reports/Cobertura.xml`: Aggregated machine-readable Cobertura XML report.
- `test-reports/coverage/reports/Summary.json`: Structured coverage metrics JSON.
- `test-reports/quality/*.log`: Raw execution logs (`frontend-lint.log`, `backend-build.log`, `backend-format.log`, `backend-vulnerabilities.log`, `backend-tests.log`, `backend-coverage.log`).
