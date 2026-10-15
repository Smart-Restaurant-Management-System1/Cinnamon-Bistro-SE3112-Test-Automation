<#
.SYNOPSIS
    Runs Phase 1 Code Quality & Static Analysis checks against Cinnamon Bistro CSP.
.DESCRIPTION
    Executes ESLint on React frontend, dotnet build static analysis, formatting checks,
    and dependency vulnerability audit on backend microservices.
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

# 1. Frontend ESLint
Write-Host "`n[1/4] Running Frontend Static Analysis (ESLint)..." -ForegroundColor Yellow
$frontendDir = Join-Path $TargetDir "frontend/restaurant-web"
if (Test-Path (Join-Path $frontendDir "package.json")) {
    if (Test-Path (Join-Path $frontendDir "node_modules")) {
        Push-Location $frontendDir
        try {
            cmd /c "npm run lint > `"$lintLog`" 2>&1"
            if ($LASTEXITCODE -eq 0) {
                $frontendLintStatus = "PASSED"
                Write-Host "  [OK] Frontend ESLint passed with 0 errors." -ForegroundColor Green
            } else {
                $frontendLintStatus = "FAILED"
                $mandatoryFailures++
                Write-Host "  [FAIL] Frontend ESLint reported errors (exit code: $LASTEXITCODE)." -ForegroundColor Red
            }
        } finally {
            Pop-Location
        }
    } else {
        $frontendLintStatus = "SKIPPED"
        Write-Host "  [WARN] Skipping ESLint: node_modules not found. Run 'npm ci' in $frontendDir first." -ForegroundColor DarkYellow
        "node_modules missing in $frontendDir" | Out-File -FilePath $lintLog -Encoding utf8
    }
} else {
    $frontendLintStatus = "SKIPPED"
    Write-Host "  [WARN] package.json not found in $frontendDir." -ForegroundColor DarkYellow
}

# 2. Backend .NET Build & Static Analysis
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

# 3. Backend Code Formatting Check (Advisory)
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

# 4. Backend Dependency Vulnerability Audit
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

# 5. Generate Markdown Summary
$overallResult = if ($mandatoryFailures -gt 0) { "FAILED" } else { "PASSED" }
$timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")

$summaryContent = @"
# Code Quality & Metrics Summary Report (Phase 1)

**Evaluated Repository:** Cinnamon Bistro SE3022 CSP (\`develop\` branch)  
**Executed By:** SE3112 Quality Automation Pipeline  
**Assigned Owner:** Wijesinghe K (\`IT24102587\`) - Code Quality & Metrics Lead  
**Execution Timestamp:** $timestamp  
**Overall Result:** **$overallResult**

---

### Executed Quality Checks

| Quality Check Stage | Target Component | Gate Type | Status | Artifact Log |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Static Analysis** | React 19 / Vite Web App | Mandatory | `$frontendLintStatus` | [\`frontend-lint.log\`](frontend-lint.log) |
| **Backend Compilation & Analysis** | ASP.NET Core Web APIs (.NET 10) | Mandatory | `$backendBuildStatus` | [\`backend-build.log\`](backend-build.log) |
| **Backend Code Formatting** | C# Source Files | Advisory | `$backendFormatStatus` | [\`backend-format.log\`](backend-format.log) |
| **Backend Dependency Audit** | NuGet Dependencies | Mandatory | `$backendVulnStatus` | [\`backend-vulnerabilities.log\`](backend-vulnerabilities.log) |

---

### Status Legend & Gate Policies
- **Mandatory Gates**: Frontend ESLint, Backend .NET Compilation, and Vulnerability Audits must pass without errors.
- **Advisory Checks**: Backend formatting differences are recorded and displayed for visibility but do not fail the build to avoid rejecting pre-existing baseline formatting in the CSP repository.
- **Coverage & Deep Metrics (Phase 2 Roadmap)**: Unit test statement coverage via Coverlet, cyclomatic complexity profiling, and SonarQube integration are scheduled for Phase 2 after unit test implementation.
"@

$summaryContent | Out-File -FilePath $summaryFile -Encoding utf8

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host " Quality Checks Execution Completed: $overallResult" -ForegroundColor $(if ($overallResult -eq "PASSED") { "Green" } else { "Red" })
Write-Host " Summary generated at: $summaryFile" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan

if ($env:GITHUB_STEP_SUMMARY) {
    $summaryContent | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append -Encoding utf8
}

if ($mandatoryFailures -gt 0) {
    exit 1
}
exit 0

