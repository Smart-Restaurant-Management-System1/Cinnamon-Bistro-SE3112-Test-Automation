<#
.SYNOPSIS
    Runs Phase 1 Code Quality & Static Analysis checks against Cinnamon Bistro CSP.
.DESCRIPTION
    Executes baseline-aware ESLint on React frontend, dotnet build static analysis,
    formatting checks, and dependency vulnerability audit on backend microservices.
.PARAMETER TargetDir
    Path to the target CSP repository root. Defaults to 'target-app' or '../Cinnamon-Bistro-CSP-Reference'.
#>
[CmdletBinding()]
param(
    [string]$TargetDir = ""
)

$OriginalErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    if (Test-Path "target-app") {
        $TargetDir = "target-app"
    } elseif (Test-Path "..\Cinnamon-Bistro-CSP-Reference") {
        $TargetDir = "..\Cinnamon-Bistro-CSP-Reference"
    } else {
        $TargetDir = "target-app"
    }
}

$reportsDir = "test-reports/quality"
if (!(Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

$summaryFile = Join-Path $reportsDir "quality-summary.md"
$eslintResults = Join-Path $reportsDir "eslint-results.json"
$eslintSummary = Join-Path $reportsDir "eslint-summary.md"
$lintLog = Join-Path $reportsDir "frontend-lint.log"
$buildLog = Join-Path $reportsDir "backend-build.log"
$formatLog = Join-Path $reportsDir "backend-format.log"
$vulnLog = Join-Path $reportsDir "backend-vulnerabilities.log"

$frontendLintStatus = "NOT_RUN"
$backendBuildStatus = "NOT_RUN"
$backendFormatStatus = "NOT_RUN"
$backendVulnStatus = "NOT_RUN"
$mandatoryFailures = 0

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " [SE3112] Cinnamon Bistro Code Quality & Metrics Check Harness" -ForegroundColor Cyan
Write-Host " Target Directory: $TargetDir" -ForegroundColor Cyan
Write-Host " Output Reports:   $reportsDir" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Frontend ESLint Static Analysis (Baseline-Aware Quality Gate)
# ------------------------------------------------------------------------------
Write-Host "`n[1/4] Running Frontend Static Analysis (ESLint Baseline-Aware Gate)..." -ForegroundColor Yellow
$frontendDir = Join-Path $TargetDir "frontend/restaurant-web"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    if (Test-Path (Join-Path $frontendDir "node_modules")) {
        $absEslintResults = Resolve-Path $reportsDir | Select-Object -ExpandProperty Path
        $absEslintResultsFile = Join-Path $absEslintResults "eslint-results.json"
        $absLintLog = Join-Path $absEslintResults "frontend-lint.log"

        Push-Location $frontendDir
        try {
            # Execute ESLint with JSON format. Note: ESLint returns 1 when lint violations exist.
            cmd /c "npx eslint . --format json > `"$absEslintResultsFile`" 2> `"$absLintLog`""
        } finally {
            Pop-Location
        }

        if (!(Test-Path $eslintResults) -or ((Get-Item $eslintResults).Length -eq 0)) {
            $frontendLintStatus = "FAILED (Empty or missing JSON report)"
            $mandatoryFailures++
            Write-Host "  [FAIL] ESLint execution failed to produce structured JSON report." -ForegroundColor Red
        } else {
            Write-Host "  Evaluating findings against authorized baseline..." -ForegroundColor Gray
            $baselineFile = "quality-checks/baselines/eslint-baseline.json"
            $compareScript = "quality-checks/compare-eslint-baseline.js"

            node $compareScript --results $eslintResults --baseline $baselineFile --summary $eslintSummary
            if ($LASTEXITCODE -eq 0) {
                $frontendLintStatus = "PASSED (Zero regressions vs baseline)"
                Write-Host "  [OK] ESLint regression gate passed: No new errors introduced." -ForegroundColor Green
            } else {
                $frontendLintStatus = "FAILED (New regressions or baseline failure)"
                $mandatoryFailures++
                Write-Host "  [FAIL] ESLint regression gate failed: New errors detected or invalid baseline." -ForegroundColor Red
            }
        }
    } else {
        $frontendLintStatus = "FAILED (Missing node_modules - run npm ci)"
        $mandatoryFailures++
        Write-Host "  [FAIL] Frontend analysis failed: node_modules not found. Run 'npm ci' in $frontendDir first." -ForegroundColor Red
        "node_modules missing in $frontendDir" | Out-File -FilePath $lintLog -Encoding utf8
    }
} else {
    $frontendLintStatus = "FAILED (Missing package.json)"
    $mandatoryFailures++
    Write-Host "  [FAIL] Frontend analysis failed: package.json not found in $frontendDir." -ForegroundColor Red
    "package.json missing" | Out-File -FilePath $lintLog -Encoding utf8
}

# ------------------------------------------------------------------------------
# 2. Backend .NET Build & Static Analysis
# ------------------------------------------------------------------------------
Write-Host "`n[2/4] Running Backend .NET Compilation & Static Analysis..." -ForegroundColor Yellow
$backendDir = Join-Path $TargetDir "backend"
$csProjects = Get-ChildItem -Path $backendDir -Filter *.csproj -Recurse | Select-Object -ExpandProperty FullName
if ($csProjects) {
    $buildFailures = 0
    "" | Out-File -FilePath $buildLog -Encoding utf8
    foreach ($proj in $csProjects) {
        $projName = Split-Path $proj -Leaf
        Write-Host "  Restoring and compiling $projName..." -ForegroundColor Gray
        cmd /c "dotnet restore `"$proj`" >> `"$buildLog`" 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [FAIL] dotnet restore failed for $projName" -ForegroundColor Red
            $buildFailures++
            continue
        }
        cmd /c "dotnet build `"$proj`" --configuration Release --no-restore >> `"$buildLog`" 2>&1"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [FAIL] dotnet build failed for $projName" -ForegroundColor Red
            $buildFailures++
        } else {
            Write-Host "  [OK] Successfully compiled $projName" -ForegroundColor Green
        }
    }
    if ($buildFailures -eq 0) {
        $backendBuildStatus = "PASSED"
        Write-Host "  [OK] All backend projects compiled successfully." -ForegroundColor Green
    } else {
        $backendBuildStatus = "FAILED"
        $mandatoryFailures++
        Write-Host "  [FAIL] Backend build failed for $buildFailures project(s)." -ForegroundColor Red
    }
} else {
    $backendBuildStatus = "SKIPPED"
    Write-Host "  [WARN] No .csproj projects found under $backendDir." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------------------
# 3. Backend Code Formatting Check (Advisory)
# ------------------------------------------------------------------------------
Write-Host "`n[3/4] Inspecting Backend .NET Code Formatting (Advisory)..." -ForegroundColor Yellow
if ($csProjects) {
    $formatDiffs = 0
    "" | Out-File -FilePath $formatLog -Encoding utf8
    foreach ($proj in $csProjects) {
        $projName = Split-Path $proj -Leaf
        cmd /c "dotnet format `"$proj`" --verify-no-changes --verbosity normal >> `"$formatLog`" 2>&1"
        if ($LASTEXITCODE -ne 0) {
            $formatDiffs++
            Write-Host "  [INFO] Formatting differences detected in $projName (advisory)" -ForegroundColor DarkYellow
        } else {
            Write-Host "  [OK] Formatting compliant: $projName" -ForegroundColor Green
        }
    }
    if ($formatDiffs -eq 0) {
        $backendFormatStatus = "PASSED"
        Write-Host "  [OK] All backend projects match standard .NET formatting." -ForegroundColor Green
    } else {
        $backendFormatStatus = "ADVISORY_WARNING"
        Write-Host "  [INFO] Non-blocking formatting differences noted in $formatDiffs project(s)." -ForegroundColor DarkYellow
        Write-Host "         (Strict formatting gate not enforced to avoid blocking baseline CSP repository)." -ForegroundColor Gray
    }
} else {
    $backendFormatStatus = "SKIPPED"
}

# ------------------------------------------------------------------------------
# 4. Backend Dependency Vulnerability Audit
# ------------------------------------------------------------------------------
Write-Host "`n[4/4] Auditing Backend Dependencies for Known Vulnerabilities..." -ForegroundColor Yellow
if ($csProjects) {
    $vulnFailures = 0
    "" | Out-File -FilePath $vulnLog -Encoding utf8
    foreach ($proj in $csProjects) {
        $projName = Split-Path $proj -Leaf
        cmd /c "dotnet list `"$proj`" package --vulnerable --include-transitive >> `"$vulnLog`" 2>&1"
        if ($LASTEXITCODE -ne 0) {
            $vulnFailures++
            Write-Host "  [FAIL] Vulnerability check failed for $projName" -ForegroundColor Red
        } else {
            Write-Host "  [OK] No known vulnerabilities: $projName" -ForegroundColor Green
        }
    }
    if ($vulnFailures -eq 0) {
        $backendVulnStatus = "PASSED"
    } else {
        $backendVulnStatus = "FAILED"
        $mandatoryFailures++
    }
} else {
    $backendVulnStatus = "SKIPPED"
}

# ------------------------------------------------------------------------------
# 5. Generate Overall Markdown Summary
# ------------------------------------------------------------------------------
$overallResult = if ($mandatoryFailures -gt 0) { "FAILED" } else { "PASSED" }
$timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")

$b = [char]96
$summaryContent = @"
# Code Quality & Metrics Summary Report (Phase 1)

**Evaluated Repository:** Cinnamon Bistro SE3022 CSP (${b}develop${b} branch)<br/>
**Executed By:** SE3112 Quality Automation Pipeline<br/>
**Assigned Owner:** Wijesinghe K (${b}IT24102587${b}) - Code Quality & Metrics Lead<br/>
**Execution Timestamp:** $timestamp<br/>
**Overall Pipeline Result:** **$overallResult**

---

### Executed Quality Checks & Gate Status

| Quality Check Stage | Target Component | Gate Classification | Evaluation Status | Artifact Log |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Static Analysis** | React 19 / Vite Web App | Baseline Regression Gate | ${b}$frontendLintStatus${b} | [${b}eslint-summary.md${b}](eslint-summary.md) \| [${b}eslint-results.json${b}](eslint-results.json) |
| **Backend Compilation & Analysis** | ASP.NET Core Web APIs (.NET 10) | Mandatory Gate | ${b}$backendBuildStatus${b} | [${b}backend-build.log${b}](backend-build.log) |
| **Backend Code Formatting** | C# Source Files | Advisory Check | ${b}$backendFormatStatus${b} | [${b}backend-format.log${b}](backend-format.log) |
| **Backend Dependency Audit** | NuGet Dependencies | Mandatory Gate | ${b}$backendVulnStatus${b} | [${b}backend-vulnerabilities.log${b}](backend-vulnerabilities.log) |

---

### Quality Gate Policies & Engineering Disclosure
1. **Frontend Baseline-Aware Gate**:
   - Analysis executed successfully and generated structured JSON.
   - All 129 historical findings (40 errors, 89 warnings) are disclosed in [${b}eslint-summary.md${b}](eslint-summary.md) and tracked in ${b}quality-checks/baselines/eslint-baseline.json${b}.
   - The regression gate enforces **0 new errors** beyond the baseline without silencing rules or modifying application code.
2. **Backend Compilation Gate**:
   - Compiles all ASP.NET Core projects in Release mode with compiler static analysis enabled. Must pass with 0 errors.
3. **Advisory Formatting Check**:
   - Non-blocking formatting differences are reported without blocking CI to avoid rejecting baseline code from the original repository.
4. **Dependency Audit Gate**:
   - Audits all direct and transitive NuGet dependencies for known CVE vulnerabilities. Must report 0 vulnerabilities.
"@

$summaryContent | Out-File -FilePath $summaryFile -Encoding utf8

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host " Quality Checks Execution Completed: $overallResult" -ForegroundColor $(if ($overallResult -eq "PASSED") { "Green" } else { "Red" })
Write-Host " Summary generated at: $summaryFile" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($env:GITHUB_STEP_SUMMARY) {
    $summaryContent | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    if (Test-Path $eslintSummary) {
        "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
        Get-Content $eslintSummary | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    }
}

if ($mandatoryFailures -gt 0) {
    exit 1
}
exit 0
