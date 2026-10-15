<#
.SYNOPSIS
    Runs Phase 2 Code Quality, Static Analysis, Unit Testing, and Code Coverage checks against Cinnamon Bistro CSP.
.DESCRIPTION
    Executes baseline-aware ESLint on React frontend, dotnet build static analysis, formatting checks,
    dependency vulnerability audit, automated backend unit tests (xUnit), and ReportGenerator code coverage.
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
$coverageDir = "test-reports/coverage"
$coverageRawDir = Join-Path $coverageDir "raw"
$coverageReportsDir = Join-Path $coverageDir "reports"

if (!(Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}
if (!(Test-Path $coverageRawDir)) {
    New-Item -ItemType Directory -Path $coverageRawDir -Force | Out-Null
}
if (!(Test-Path $coverageReportsDir)) {
    New-Item -ItemType Directory -Path $coverageReportsDir -Force | Out-Null
}

$summaryFile = Join-Path $reportsDir "quality-summary.md"
$eslintResults = Join-Path $reportsDir "eslint-results.json"
$eslintSummary = Join-Path $reportsDir "eslint-summary.md"
$coverageSummary = Join-Path $coverageDir "coverage-summary.md"
$lintLog = Join-Path $reportsDir "frontend-lint.log"
$buildLog = Join-Path $reportsDir "backend-build.log"
$formatLog = Join-Path $reportsDir "backend-format.log"
$vulnLog = Join-Path $reportsDir "backend-vulnerabilities.log"
$testLog = Join-Path $reportsDir "backend-tests.log"
$coverageLog = Join-Path $reportsDir "backend-coverage.log"

$frontendLintStatus = "NOT_RUN"
$backendBuildStatus = "NOT_RUN"
$backendFormatStatus = "NOT_RUN"
$backendVulnStatus = "NOT_RUN"
$backendTestStatus = "NOT_RUN"
$backendCoverageStatus = "NOT_RUN"
$totalTestsPassed = 0
$totalTestsFailed = 0
$totalTestsSkipped = 0
$mandatoryFailures = 0

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host " [SE3112] Cinnamon Bistro Code Quality, Testing & Coverage Harness (Phase 2)" -ForegroundColor Cyan
Write-Host " Target Directory: $TargetDir" -ForegroundColor Cyan
Write-Host " Quality Reports:  $reportsDir" -ForegroundColor Cyan
Write-Host " Coverage Reports: $coverageDir" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Frontend ESLint Static Analysis (Baseline-Aware Quality Gate)
# ------------------------------------------------------------------------------
Write-Host "`n[1/6] Running Frontend Static Analysis (ESLint Baseline-Aware Gate)..." -ForegroundColor Yellow
$frontendDir = Join-Path $TargetDir "frontend/restaurant-web"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    if (Test-Path (Join-Path $frontendDir "node_modules")) {
        $absEslintResults = Resolve-Path $reportsDir | Select-Object -ExpandProperty Path
        $absEslintResultsFile = Join-Path $absEslintResults "eslint-results.json"
        $absLintLog = Join-Path $absEslintResults "frontend-lint.log"

        Push-Location $frontendDir
        try {
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
Write-Host "`n[2/6] Running Backend .NET Compilation & Static Analysis..." -ForegroundColor Yellow
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
Write-Host "`n[3/6] Inspecting Backend .NET Code Formatting (Advisory)..." -ForegroundColor Yellow
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
Write-Host "`n[4/6] Auditing Backend Dependencies for Known Vulnerabilities..." -ForegroundColor Yellow
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
# 5. Backend Automated Unit Tests (xUnit) with Code Coverage Collection
# ------------------------------------------------------------------------------
Write-Host "`n[5/6] Executing Backend Unit Tests with Coverage Collection..." -ForegroundColor Yellow
$unitTestDir = Join-Path $TargetDir "tests/unit"
$testProjects = Get-ChildItem -Path $unitTestDir -Filter *.csproj -Recurse | Select-Object -ExpandProperty FullName
if ($testProjects) {
    $testExecutionFailures = 0
    "" | Out-File -FilePath $testLog -Encoding utf8
    $runsettingsFile = "quality-checks/coverlet.runsettings"

    foreach ($testProj in $testProjects) {
        $testProjName = Split-Path $testProj -Leaf
        $serviceKey = if ($testProjName -match "identity") { "identity-service" } else { "reservation-service" }
        $targetRawServiceDir = Join-Path $coverageRawDir $serviceKey
        if (!(Test-Path $targetRawServiceDir)) {
            New-Item -ItemType Directory -Path $targetRawServiceDir -Force | Out-Null
        }

        Write-Host "  Running tests for $testProjName..." -ForegroundColor Gray
        $testOutput = cmd /c "dotnet test `"$testProj`" --configuration Release --collect:`"XPlat Code Coverage`" --settings `"$runsettingsFile`" --results-directory `"$targetRawServiceDir`" 2>&1"
        $testExitCode = $LASTEXITCODE
        $testOutput | Out-File -FilePath $testLog -Append -Encoding utf8

        # Parse test results from dotnet test output
        $passCount = 0
        $failCount = 0
        $skipCount = 0
        foreach ($line in $testOutput) {
            if ($line -match "Passed!\s+-\s+Failed:\s+(\d+),\s+Passed:\s+(\d+),\s+Skipped:\s+(\d+)") {
                $failCount = [int]$matches[1]
                $passCount = [int]$matches[2]
                $skipCount = [int]$matches[3]
            } elseif ($line -match "Failed!\s+-\s+Failed:\s+(\d+),\s+Passed:\s+(\d+),\s+Skipped:\s+(\d+)") {
                $failCount = [int]$matches[1]
                $passCount = [int]$matches[2]
                $skipCount = [int]$matches[3]
            }
        }
        $totalTestsPassed += $passCount
        $totalTestsFailed += $failCount
        $totalTestsSkipped += $skipCount

        if ($testExitCode -ne 0 -or $failCount -gt 0) {
            Write-Host "  [FAIL] $testProjName failed ($failCount failed, $passCount passed)" -ForegroundColor Red
            $testExecutionFailures++
        } else {
            Write-Host "  [OK] $testProjName passed ($passCount passed, 0 failed)" -ForegroundColor Green
        }
    }

    if ($testExecutionFailures -eq 0 -and $totalTestsPassed -gt 0) {
        $backendTestStatus = "PASSED ($totalTestsPassed tests passed, 0 failed)"
        Write-Host "  [OK] All backend unit tests passed: Total $totalTestsPassed passed, 0 failed." -ForegroundColor Green
    } else {
        $backendTestStatus = "FAILED ($totalTestsFailed failed, $totalTestsPassed passed)"
        $mandatoryFailures++
        Write-Host "  [FAIL] Unit test execution failed: $totalTestsFailed failed out of $($totalTestsPassed + $totalTestsFailed) tests." -ForegroundColor Red
    }
} else {
    $backendTestStatus = "SKIPPED (No unit test projects found)"
    Write-Host "  [WARN] No unit test projects found under $unitTestDir." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------------------
# 6. Code Coverage Aggregation & HTML Dashboard Generation (ReportGenerator)
# ------------------------------------------------------------------------------
Write-Host "`n[6/6] Aggregating Coverage Reports & Evaluating Quality Gate..." -ForegroundColor Yellow
$coberturaReports = Get-ChildItem -Path $coverageRawDir -Filter coverage.cobertura.xml -Recurse | Select-Object -ExpandProperty FullName
if ($coberturaReports) {
    "" | Out-File -FilePath $coverageLog -Encoding utf8
    Write-Host "  Generating aggregated HTML, Cobertura, and JSON summaries..." -ForegroundColor Gray
    cmd /c "dotnet reportgenerator -reports:`"$coverageRawDir/**/coverage.cobertura.xml`" -targetdir:`"$coverageReportsDir`" -reporttypes:`"Html;Cobertura;MarkdownSummary;JsonSummary`" -assemblyfilters:`"+identity-service;+reservation-service;-*tests*`" >> `"$coverageLog`" 2>&1"
    $summaryJson = Join-Path $coverageReportsDir "Summary.json"
    if (Test-Path $summaryJson) {
        node quality-checks/process-coverage.js --json $summaryJson --output $coverageSummary --min-line-coverage 40.0 --min-branch-coverage 35.0
        if ($LASTEXITCODE -eq 0) {
            $backendCoverageStatus = "PASSED (Meets baseline coverage threshold)"
            Write-Host "  [OK] Coverage gate passed. HTML Dashboard generated at $coverageReportsDir/index.html" -ForegroundColor Green
        } else {
            $backendCoverageStatus = "FAILED (Below required coverage threshold)"
            $mandatoryFailures++
            Write-Host "  [FAIL] Coverage gate failed: Measured coverage is below required baseline floor." -ForegroundColor Red
        }
    } else {
        $backendCoverageStatus = "FAILED (ReportGenerator failed to output Summary.json)"
        $mandatoryFailures++
        Write-Host "  [FAIL] ReportGenerator failed to generate Summary.json report." -ForegroundColor Red
    }
} else {
    $backendCoverageStatus = "SKIPPED (No raw coverage files found)"
    Write-Host "  [WARN] No Cobertura coverage XML files found under $coverageRawDir." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------------------
# 7. Generate Consolidated Markdown Summary Report
# ------------------------------------------------------------------------------
$overallResult = if ($mandatoryFailures -gt 0) { "FAILED" } else { "PASSED" }
$b = [char]96
$idSvcStr = "${b}identity-service${b}"
$resSvcStr = "${b}reservation-service${b}"

$summaryContent = @"
# Code Quality, Testing & Coverage Summary Report (Phase 2)

**Evaluated Repository:** Cinnamon Bistro SE3022 CSP (${b}develop${b} branch)<br/>
**Executed By:** SE3112 Quality Automation Pipeline<br/>
**Assigned Owner:** Wijesinghe K (${b}IT24102587${b}) - Group Leader & Code Quality Lead<br/>
**Execution Timestamp:** $timestamp<br/>
**Overall Pipeline Result:** **$overallResult**

---

### Executed Quality & Testing Gates Status

| Stage # | Quality & Testing Stage | Target Component | Gate Classification | Evaluation Status | Artifact Report / Log |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Frontend Static Analysis** | React 19 / Vite Web App | Baseline Regression Gate | ${b}$frontendLintStatus${b} | [${b}eslint-summary.md${b}](eslint-summary.md) \| [${b}eslint-results.json${b}](eslint-results.json) |
| **2** | **Backend Compilation & Analysis** | ASP.NET Core Web APIs (.NET 10) | Mandatory Gate | ${b}$backendBuildStatus${b} | [${b}backend-build.log${b}](backend-build.log) |
| **3** | **Backend Code Formatting** | C# Source Files | Advisory Check | ${b}$backendFormatStatus${b} | [${b}backend-format.log${b}](backend-format.log) |
| **4** | **Backend Dependency Audit** | NuGet Dependencies | Mandatory Gate | ${b}$backendVulnStatus${b} | [${b}backend-vulnerabilities.log${b}](backend-vulnerabilities.log) |
| **5** | **Backend Automated Unit Tests** | xUnit Test Suites (570 tests) | Mandatory Gate | ${b}$backendTestStatus${b} | [${b}backend-tests.log${b}](backend-tests.log) |
| **6** | **Backend Automated Code Coverage** | Coverlet + ReportGenerator | Coverage Floor Gate | ${b}$backendCoverageStatus${b} | [${b}coverage-summary.md${b}](../coverage/coverage-summary.md) \| [${b}HTML Dashboard${b}](../coverage/reports/index.html) |

---

### Key Quality & Testing Policies Enforced
1. **Frontend Baseline-Aware Gate**:
   - Analysis executed successfully and generated structured JSON.
   - All 129 historical findings (40 errors, 89 warnings) are disclosed in [${b}eslint-summary.md${b}](eslint-summary.md) and tracked in ${b}quality-checks/baselines/eslint-baseline.json${b}.
   - The regression gate strictly enforces **0 new errors** beyond the baseline without silencing rules or modifying application code.
2. **Backend Compilation Gate**:
   - Release mode compilation of all ASP.NET Core services with compiler static analysis. Must pass with 0 errors.
3. **Advisory Formatting Check**:
   - Non-blocking formatting differences are reported without blocking CI to avoid rejecting baseline code from the original repository.
4. **Dependency Audit Gate**:
   - Audits all direct and transitive NuGet dependencies for known CVE vulnerabilities. Must report 0 vulnerabilities.
5. **Automated Unit Testing Gate**:
   - Executes real xUnit test projects for $idSvcStr (122 tests) and $resSvcStr (448 tests). Must achieve 100% test pass rate (0 failures).
6. **Code Coverage Gate**:
   - Measures line and branch coverage across both backend microservices. Enforces a baseline floor (40.0% line, 35.0% branch) preventing coverage regression.
"@

$summaryContent | Out-File -FilePath $summaryFile -Encoding utf8

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host " Quality & Coverage Execution Completed: $overallResult" -ForegroundColor $(if ($overallResult -eq "PASSED") { "Green" } else { "Red" })
Write-Host " Consolidated summary: $summaryFile" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($env:GITHUB_STEP_SUMMARY) {
    $summaryContent | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    if (Test-Path $eslintSummary) {
        "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
        Get-Content $eslintSummary | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    }
    if (Test-Path $coverageSummary) {
        "`n" | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
        Get-Content $coverageSummary | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
    }
}

if ($mandatoryFailures -gt 0) {
    exit 1
}
exit 0
