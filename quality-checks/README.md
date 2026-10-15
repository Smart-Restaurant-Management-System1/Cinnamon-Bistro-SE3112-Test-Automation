# Code Quality & Metrics Harness (Phase 1)

**Individual Testing Area 1:** Code Quality & Metrics  
**Responsible Owner:** Wijesinghe K (`IT24102587`) — Group Leader & Quality Lead  
**Target Repository:** Cinnamon Bistro SE3022 CSP (`develop` branch)

---

## 1. Overview & Objectives

The `quality-checks/` module implements automated static code analysis, code hygiene verification, and dependency security audits for the Cinnamon Bistro ecosystem. 

As part of Phase 1 implementation, this harness establishes the baseline quality gate that runs as the initial stage in the CI/CD pipeline, catching structural bugs, syntax errors, and supply-chain vulnerabilities before downstream testing jobs execute.

---

## 2. Implemented Quality Checks (Phase 1)

| Check Category | Target Stack | Tool / Engine | Gate Classification | Action on Failure |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Static Analysis** | React 19 / Vite Web App (`frontend/restaurant-web`) | ESLint (Flat Config via `eslint.config.js`) | **Mandatory Gate** | Fails CI job on syntax or lint errors |
| **Backend Static Analysis & Build** | ASP.NET Core Web APIs (`backend/*/*.csproj`) | `dotnet build` with compiler static analysis | **Mandatory Gate** | Fails CI job on compilation or semantic errors |
| **Backend Code Formatting** | C# Source Files | `dotnet format --verify-no-changes` | **Advisory Check** | Logs formatting diagnostics (non-blocking for baseline repo) |
| **Dependency Security Audit** | NuGet Dependencies | `dotnet list package --vulnerable` | **Mandatory Gate** | Fails CI job on known vulnerable dependencies |

### Gate Policy & Engineering Rationale
- **Mandatory Gates**: Ensure that code is syntactically correct, types resolve without error, and third-party dependencies are free of published CVE vulnerabilities.
- **Advisory Formatting Check**: Static analysis using `dotnet format --verify-no-changes` revealed that the existing CSP baseline codebase contains pre-existing whitespace formatting differences in `DatabaseHelper.cs` and `UserService.cs`. To avoid introducing an unverified gate that would block all CI runs solely due to existing upstream code style differences, formatting differences are logged as advisory warnings rather than blocking failures.

---

## 3. Local Execution

Both cross-platform Bash and PowerShell runners are provided to ensure consistent execution across developer machines:

### On Linux / macOS / Git Bash:
```bash
# Execute against target-app or default reference folder
bash quality-checks/run-quality-checks.sh [optional-target-path]
```

### On Windows PowerShell:
```powershell
# Execute against target-app or default reference folder
.\quality-checks\run-quality-checks.ps1 -TargetDir "..\Cinnamon-Bistro-CSP-Reference"
```

---

## 4. Generated Artifacts & Reports

Execution results are automatically output to `test-reports/quality/`:
- `quality-summary.md`: Consolidated Markdown summary published to GitHub Actions `$GITHUB_STEP_SUMMARY`.
- `frontend-lint.log`: Output from the ESLint runner.
- `backend-build.log`: Output from `dotnet restore` and `dotnet build`.
- `backend-format.log`: Output from `dotnet format --verify-no-changes`.
- `backend-vulnerabilities.log`: Output from NuGet vulnerability scans.

---

## 5. Phase 2 Roadmap (Pending Integration)

The following metrics and analysis capabilities will be integrated in subsequent phases:
1. **Unit Test Statement & Branch Coverage**: Integration with `coverlet.collector` and `ReportGenerator` to produce interactive coverage HTML dashboards.
2. **Code Complexity & Maintainability Metrics**: Measuring cyclomatic complexity and cognitive complexity across backend controller and service layers.
3. **Frontend Test Coverage**: Automated coverage tracking via Node.js native test coverage runner (`node --test --experimental-test-coverage`).

