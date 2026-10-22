# Automation & Utility Scripts

## 1. Overview

The `scripts/` directory contains helper, automation, and utility scripts used to bootstrap environments, prepare test data, execute automated test suites locally or in CI, and generate aggregated test reports.

---

## 2. Script Standards & Guidelines

When adding automation scripts to this directory, adhere to the following standards:

1. **Cross-Platform Compatibility**:
   - Provide portable shell scripts (`.sh`) for POSIX environments (Linux, macOS, CI agents).
   - Provide equivalent PowerShell scripts (`.ps1`) or platform-agnostic runners (Node.js/Python) where appropriate.
2. **Defensive Scripting**:
   - For Bash: Always include `set -euo pipefail` to halt on errors and unset variables.
   - For PowerShell: Always specify `$ErrorActionPreference = "Stop"`.
3. **Idempotence & Self-Containment**:
   - Scripts should cleanly clean up any temporary directories, containers, or test state upon completion.
   - Avoid hardcoding absolute system paths; calculate relative paths from repository root.
4. **Descriptive Output**:
   - Use clear logging prefixes (e.g., `[INFO]`, `[WARN]`, `[ERROR]`, `[SUCCESS]`) to facilitate debugging in CI logs.

---

## 3. Planned Automation Scripts

As the test framework evolves, the following automation utilities will be implemented:

| Script Name | Purpose | Target Environment |
| :--- | :--- | :--- |
| `run-all-tests.[sh|ps1]` | Master orchestrator running unit, mutation, e2e, and load tests in sequence. | Local Dev & CI |
| `setup-environment.[sh|ps1]` | Validates prerequisites, installs dependencies, and prepares container mocks. | Local Dev |
| `seed-test-data.[sh|ps1]` | Prepares mock customer profiles, menu items, and reservation slots. | Local & CI |
| `generate-report-summary.[sh|ps1]` | Consolidates outputs from `test-reports/` into an executive markdown summary. | CI Pipeline |

---

## 4. Current Status (Phase 2 Operational)

- **Code Quality, Testing & Coverage Harness**: Active runners are provided in [`quality-checks/run-quality-checks.sh`](../quality-checks/run-quality-checks.sh) (Bash/CI) and [`quality-checks/run-quality-checks.ps1`](../quality-checks/run-quality-checks.ps1) (PowerShell), orchestrating ESLint, .NET build, dependency auditing, 570 unit tests, and ReportGenerator HTML coverage.
- **Coverage Processor**: [`quality-checks/process-coverage.js`](../quality-checks/process-coverage.js) parses ReportGenerator JSON summaries and enforces baseline coverage gates.
- **Baseline Comparator**: [`quality-checks/compare-eslint-baseline.js`](../quality-checks/compare-eslint-baseline.js) enforces zero-new-error regression detection against the committed ESLint baseline.
- **k6 Load Summary Processor**: [`scripts/process-load-summary.js`](process-load-summary.js) parses machine-readable k6 `--summary-export` JSON output, validates performance thresholds (`p95 < 1000ms`, `checks > 99%`, `failures < 1%`), writes markdown reports to `test-reports/load/load-summary.md`, and formats GitHub Step Summaries in CI.
- **Teammate Test Runners**: Downstream test suites (`unit-tests/`, `e2e-tests/`) will add specific runners in accordance with the contracts in [`docs/team-contribution.md`](../docs/team-contribution.md).

