# Code Quality & Metrics Harness (Phase 1)

**Individual Testing Area 1:** Code Quality & Metrics  
**Responsible Owner:** Wijesinghe K (`IT24102587`) — Group Leader & Quality Lead  
**Target Repository:** Cinnamon Bistro SE3022 CSP (`develop` branch)

---

## 1. Overview & Objectives

The `quality-checks/` module implements automated static code analysis, code hygiene verification, baseline-aware regression gating, and dependency security audits for the Cinnamon Bistro microservice ecosystem.

As part of the Phase 1 implementation, this harness establishes an objective, transparent quality gate that runs as the initial stage in the CI/CD pipeline, catching structural bugs, syntax errors, and supply-chain vulnerabilities before downstream testing jobs execute.

---

## 2. Implemented Quality Checks & Gate Classifications

| Check Category | Target Component | Tool / Engine | Gate Classification | Evaluation Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Static Analysis** | React 19 / Vite Web App (`frontend/restaurant-web`) | ESLint (Flat Config via `eslint.config.js`) + Baseline Comparator | **Baseline-Aware Regression Gate** | **Strict 0 New Errors** beyond authorized baseline. Historical debt is transparently reported. |
| **Backend Static Analysis & Build** | ASP.NET Core Web APIs (`backend/*/*.csproj`) | `dotnet build` with compiler static analysis | **Mandatory Gate** | Fails CI job on compilation or semantic errors (0 errors required). |
| **Backend Code Formatting** | C# Source Files | `dotnet format --verify-no-changes` | **Advisory Check** | Non-blocking style diagnostics logged (avoids rejecting baseline code). |
| **Dependency Security Audit** | NuGet Dependencies | `dotnet list package --vulnerable` | **Mandatory Gate** | Fails CI job on known vulnerable dependencies (0 CVEs required). |

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
   - Line and column numbers are excluded from the identity key to prevent line drift (e.g. adding a comment on line 1 does not flag existing issues on lines 50-100 as new regressions).
   - Findings sharing identical keys within a file (e.g. two separate `setState` calls in the same component) are tracked using **multiset frequency counts**. If $\text{CurrentCount} > \text{BaselineCount}$, the excess count is flagged as a new regression.
5. **Dual Evaluation Reporting**:
   - **Clean Lint Status**: Evaluates whether zero total errors and warnings exist in the codebase. Accurately reports `FAILED (Historical baseline findings present)` until upstream technical debt is remediated.
   - **Regression Gate Status**: Evaluates whether $\Delta_{\text{new errors}} = 0$. Reports `PASSED (Zero new errors introduced)` if no new violations are introduced, or `FAILED (New regressions detected)` if 1+ new errors appear.

### 3.3 Authorized Baseline Provenance
The authorized baseline is stored in [`quality-checks/baselines/eslint-baseline.json`](baselines/eslint-baseline.json):
- **Upstream Repository:** `Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System`
- **Target Branch:** `develop`
- **Baseline Commit SHA:** `ee41765622ac458399bd208171d930dcb6a070a9`
- **ESLint Version:** `10.9.1` (Flat Config)
- **Total Cataloged Findings:** 129 (40 errors, 89 warnings across 57 files)

---

## 4. Scripts & Execution

### 4.1 Script Inventory
- `quality-checks/compare-eslint-baseline.js`: Portable Node.js baseline comparator and quality gate evaluator.
- `quality-checks/run-quality-checks.sh`: Cross-platform Bash runner for CI/CD and Linux/macOS environments.
- `quality-checks/run-quality-checks.ps1`: Native PowerShell runner for Windows developer environments.

### 4.2 Local Execution

#### Linux / macOS / Git Bash:
```bash
# Run against local target directory or default reference repo
bash quality-checks/run-quality-checks.sh [optional-target-path]
```

#### Windows PowerShell:
```powershell
# Run against local target directory or default reference repo
powershell -ExecutionPolicy Bypass -File .\quality-checks\run-quality-checks.ps1 -TargetDir "..\Cinnamon-Bistro-CSP-Reference"
```

#### Direct Baseline Comparator Usage:
```bash
# Evaluate existing results against baseline
node quality-checks/compare-eslint-baseline.js \
  --results test-reports/quality/eslint-results.json \
  --baseline quality-checks/baselines/eslint-baseline.json \
  --summary test-reports/quality/eslint-summary.md

# Regenerate authorized baseline (maintenance mode)
node quality-checks/compare-eslint-baseline.js \
  --results test-reports/quality/eslint-results.json \
  --baseline quality-checks/baselines/eslint-baseline.json \
  --generate-baseline
```

---

## 5. Generated Artifacts & Reports

Execution results are automatically output to `test-reports/quality/`:
- `quality-summary.md`: Consolidated quality gate report, automatically appended to `$GITHUB_STEP_SUMMARY`.
- `eslint-summary.md`: Detailed breakdown of historical baseline findings, new regressions, resolved issues, and rule distributions.
- `eslint-results.json`: Full structured JSON artifact output directly by ESLint.
- `frontend-lint.log`: Raw CLI standard error output from the ESLint process.
- `backend-build.log`: Detailed compiler diagnostic log from `dotnet restore` and `dotnet build`.
- `backend-format.log`: Detailed formatting diagnostics from `dotnet format --verify-no-changes`.
- `backend-vulnerabilities.log`: Vulnerability scan output from `dotnet list package --vulnerable`.

---

## 6. Verification & Test Scenarios

The baseline-aware harness has been verified against 5 key operational scenarios:
1. **Scenario 1 — Authorized Baseline Run**: Evaluated against the reference CSP repository (`develop` branch). All 129 findings match the baseline; zero new errors; pipeline exits with code `0` (`PASSED`).
2. **Scenario 2 — Synthetic Regression Injection**: Injected 1 new error (`no-undef` on `src/App.jsx`). The comparator accurately flags 1 new regression, marks Regression Gate as `FAILED`, and exits with code `1`.
3. **Scenario 3 — Missing Baseline File**: When the baseline path does not exist, the comparator halts with a clear `[FATAL]` diagnostic and exits with code `1`.
4. **Scenario 4 — Corrupt Results JSON**: When the ESLint results file contains invalid JSON or truncated output, the comparator halts with a clear `[FATAL]` diagnostic and exits with code `1`.
5. **Scenario 5 — Missing Dependencies**: When executed against a target directory lacking `node_modules`, the harness aborts with a clear directive to execute `npm ci` and exits with code `1`.
