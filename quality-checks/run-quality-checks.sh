#!/usr/bin/env bash
# ==============================================================================
# Script: quality-checks/run-quality-checks.sh
# Purpose: Execute Phase 1 Code Quality & Static Analysis checks against the
#          Cinnamon Bistro CSP application.
# Individual Owner: Wijesinghe K (IT24102587) - Code Quality & Metrics Lead
# ==============================================================================

set -uo pipefail

TARGET_DIR="${1:-target-app}"
if [ ! -d "$TARGET_DIR" ] && [ -d "../Cinnamon-Bistro-CSP-Reference" ]; then
  TARGET_DIR="../Cinnamon-Bistro-CSP-Reference"
fi

REPORTS_DIR="test-reports/quality"
mkdir -p "$REPORTS_DIR"

SUMMARY_FILE="$REPORTS_DIR/quality-summary.md"
LINT_LOG="$REPORTS_DIR/frontend-lint.log"
BUILD_LOG="$REPORTS_DIR/backend-build.log"
FORMAT_LOG="$REPORTS_DIR/backend-format.log"
VULN_LOG="$REPORTS_DIR/backend-vulnerabilities.log"

FRONTEND_LINT_STATUS="NOT_RUN"
BACKEND_BUILD_STATUS="NOT_RUN"
BACKEND_FORMAT_STATUS="NOT_RUN"
BACKEND_VULN_STATUS="NOT_RUN"
MANDATORY_FAILURES=0

echo "=============================================================================="
echo " [SE3112] Cinnamon Bistro Code Quality & Metrics Check Harness"
echo " Target Directory: $TARGET_DIR"
echo " Output Reports:   $REPORTS_DIR"
echo "=============================================================================="

# ------------------------------------------------------------------------------
# 1. Frontend ESLint Static Analysis (Mandatory Gate)
# ------------------------------------------------------------------------------
echo ""
echo "[1/4] Running Frontend Static Analysis (ESLint)..."
FRONTEND_DIR="$TARGET_DIR/frontend/restaurant-web"

if [ -f "$FRONTEND_DIR/package.json" ]; then
  if [ -d "$FRONTEND_DIR/node_modules" ]; then
    (
      cd "$FRONTEND_DIR"
      npm run lint
    ) > "$LINT_LOG" 2>&1
    LINT_EXIT=$?

    if [ $LINT_EXIT -eq 0 ]; then
      FRONTEND_LINT_STATUS="PASSED"
      echo "  ✓ Frontend ESLint completed with 0 errors."
    else
      FRONTEND_LINT_STATUS="FAILED"
      MANDATORY_FAILURES=$((MANDATORY_FAILURES + 1))
      echo "  ✗ Frontend ESLint detected errors (exit code: $LINT_EXIT)."
      cat "$LINT_LOG"
    fi
  else
    FRONTEND_LINT_STATUS="SKIPPED"
    echo "  ! Skipping frontend ESLint: node_modules not found in $FRONTEND_DIR. Run npm ci first."
    echo "node_modules missing in $FRONTEND_DIR" > "$LINT_LOG"
  fi
else
  FRONTEND_LINT_STATUS="SKIPPED"
  echo "  ! Frontend package.json not found in $FRONTEND_DIR."
  echo "package.json missing" > "$LINT_LOG"
fi

# ------------------------------------------------------------------------------
# 2. Backend .NET Static Analysis & Compilation Check (Mandatory Gate)
# ------------------------------------------------------------------------------
echo ""
echo "[2/4] Running Backend .NET Compilation & Static Analysis..."
BACKEND_DIR="$TARGET_DIR/backend"
CS_PROJECTS=$(find "$BACKEND_DIR" -name "*.csproj" 2>/dev/null | sort || true)

if [ -n "$CS_PROJECTS" ]; then
  TOTAL_BUILD_FAILURES=0
  > "$BUILD_LOG"

  for proj in $CS_PROJECTS; do
    echo "  Restoring and building $proj..." | tee -a "$BUILD_LOG"
    dotnet restore "$proj" >> "$BUILD_LOG" 2>&1
    RESTORE_EXIT=$?

    if [ $RESTORE_EXIT -ne 0 ]; then
      echo "  ✗ dotnet restore failed for $proj" | tee -a "$BUILD_LOG"
      TOTAL_BUILD_FAILURES=$((TOTAL_BUILD_FAILURES + 1))
      continue
    fi

    dotnet build "$proj" --configuration Release --no-restore >> "$BUILD_LOG" 2>&1
    BUILD_EXIT=$?

    if [ $BUILD_EXIT -ne 0 ]; then
      echo "  ✗ dotnet build failed for $proj" | tee -a "$BUILD_LOG"
      TOTAL_BUILD_FAILURES=$((TOTAL_BUILD_FAILURES + 1))
    else
      echo "  ✓ Successfully built $proj" | tee -a "$BUILD_LOG"
    fi
  done

  if [ $TOTAL_BUILD_FAILURES -eq 0 ]; then
    BACKEND_BUILD_STATUS="PASSED"
    echo "  ✓ All backend .NET projects compiled successfully with 0 errors."
  else
    BACKEND_BUILD_STATUS="FAILED"
    MANDATORY_FAILURES=$((MANDATORY_FAILURES + 1))
    echo "  ✗ Backend build failed for $TOTAL_BUILD_FAILURES project(s)."
  fi
else
  BACKEND_BUILD_STATUS="SKIPPED"
  echo "  ! No .csproj files found under $BACKEND_DIR."
  echo "No .csproj projects found" > "$BUILD_LOG"
fi

# ------------------------------------------------------------------------------
# 3. Backend .NET Code Formatting Inspection (Advisory Check)
# ------------------------------------------------------------------------------
echo ""
echo "[3/4] Inspecting Backend .NET Code Formatting (Advisory)..."
if [ -n "$CS_PROJECTS" ]; then
  TOTAL_FORMAT_DIFFS=0
  > "$FORMAT_LOG"

  for proj in $CS_PROJECTS; do
    dotnet format "$proj" --verify-no-changes --verbosity normal >> "$FORMAT_LOG" 2>&1
    FORMAT_EXIT=$?

    if [ $FORMAT_EXIT -ne 0 ]; then
      TOTAL_FORMAT_DIFFS=$((TOTAL_FORMAT_DIFFS + 1))
      echo "  ℹ Formatting differences detected in $proj (advisory)" | tee -a "$FORMAT_LOG"
    else
      echo "  ✓ Formatting compliant: $proj" | tee -a "$FORMAT_LOG"
    fi
  done

  if [ $TOTAL_FORMAT_DIFFS -eq 0 ]; then
    BACKEND_FORMAT_STATUS="PASSED"
    echo "  ✓ All backend projects match standard .NET formatting."
  else
    BACKEND_FORMAT_STATUS="ADVISORY_WARNING"
    echo "  ℹ Non-blocking formatting differences noted in $TOTAL_FORMAT_DIFFS project(s)."
    echo "    (Strict formatting gate not enforced to avoid blocking baseline CSP repository)."
  fi
else
  BACKEND_FORMAT_STATUS="SKIPPED"
fi

# ------------------------------------------------------------------------------
# 4. Backend Dependency Vulnerability Audit (Security Gate)
# ------------------------------------------------------------------------------
echo ""
echo "[4/4] Auditing Backend Dependencies for Known Vulnerabilities..."
if [ -n "$CS_PROJECTS" ]; then
  TOTAL_VULN_ERRORS=0
  > "$VULN_LOG"

  for proj in $CS_PROJECTS; do
    dotnet list "$proj" package --vulnerable --include-transitive >> "$VULN_LOG" 2>&1
    VULN_EXIT=$?

    if [ $VULN_EXIT -ne 0 ]; then
      TOTAL_VULN_ERRORS=$((TOTAL_VULN_ERRORS + 1))
      echo "  ✗ Vulnerability audit failed or reported issues in $proj" | tee -a "$VULN_LOG"
    else
      echo "  ✓ No known vulnerable packages: $proj" | tee -a "$VULN_LOG"
    fi
  done

  if [ $TOTAL_VULN_ERRORS -eq 0 ]; then
    BACKEND_VULN_STATUS="PASSED"
  else
    BACKEND_VULN_STATUS="FAILED"
    MANDATORY_FAILURES=$((MANDATORY_FAILURES + 1))
  fi
else
  BACKEND_VULN_STATUS="SKIPPED"
fi

# ------------------------------------------------------------------------------
# 5. Generate Quality Summary Report
# ------------------------------------------------------------------------------
OVERALL_RESULT="PASSED"
if [ $MANDATORY_FAILURES -gt 0 ]; then
  OVERALL_RESULT="FAILED"
fi

cat <<EOF > "$SUMMARY_FILE"
# Code Quality & Metrics Summary Report (Phase 1)

**Evaluated Repository:** Cinnamon Bistro SE3022 CSP (\`develop\` branch)  
**Executed By:** SE3112 Quality Automation Pipeline  
**Assigned Owner:** Wijesinghe K (\`IT24102587\`) — Code Quality & Metrics Lead  
**Execution Timestamp:** $(date -u +"%Y-%m-%d %H:%M:%SZ")  
**Overall Result:** **$OVERALL_RESULT**

---

### Executed Quality Checks

| Quality Check Stage | Target Component | Gate Type | Status | Artifact Log |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Static Analysis** | React 19 / Vite Web App | Mandatory | \`$FRONTEND_LINT_STATUS\` | [\`frontend-lint.log\`](frontend-lint.log) |
| **Backend Compilation & Analysis** | ASP.NET Core Web APIs (.NET 10) | Mandatory | \`$BACKEND_BUILD_STATUS\` | [\`backend-build.log\`](backend-build.log) |
| **Backend Code Formatting** | C# Source Files | Advisory | \`$BACKEND_FORMAT_STATUS\` | [\`backend-format.log\`](backend-format.log) |
| **Backend Dependency Audit** | NuGet Dependencies | Mandatory | \`$BACKEND_VULN_STATUS\` | [\`backend-vulnerabilities.log\`](backend-vulnerabilities.log) |

---

### Status Legend & Gate Policies
- **Mandatory Gates**: Frontend ESLint, Backend .NET Compilation, and Vulnerability Audits must pass without errors.
- **Advisory Checks**: Backend formatting differences are recorded and displayed for visibility but do not fail the build to avoid rejecting pre-existing baseline formatting in the CSP repository.
- **Coverage & Deep Metrics (Phase 2 Roadmap)**: Unit test statement coverage via Coverlet, cyclomatic complexity profiling, and SonarQube integration are scheduled for Phase 2 after unit test implementation.
EOF

echo ""
echo "=============================================================================="
echo " Quality Checks Execution Completed: $OVERALL_RESULT"
echo " Summary generated at: $SUMMARY_FILE"
echo "=============================================================================="

# Export to GitHub Step Summary if running in GitHub Actions
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  cat "$SUMMARY_FILE" >> "$GITHUB_STEP_SUMMARY"
fi

if [ $MANDATORY_FAILURES -gt 0 ]; then
  exit 1
fi

exit 0

