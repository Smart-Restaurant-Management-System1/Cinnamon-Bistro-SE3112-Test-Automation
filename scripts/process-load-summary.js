#!/usr/bin/env node
/**
 * ==============================================================================
 * Script: scripts/process-load-summary.js
 * Purpose: Parses k6 summary JSON exports, verifies performance thresholds,
 *          and generates structured Markdown reports for CI Step Summaries.
 * SE3112 Cinnamon Bistro Automated Testing Pipeline
 * ==============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultValue;
}

const summaryJsonPath = getArg('--json', 'test-reports/load/smoke-summary.json');
const outputMarkdownPath = getArg('--output', 'test-reports/load/load-summary.md');
const profileName = getArg('--profile', 'Smoke Test (1 VU, 10s)');
const targetUrl = getArg('--target-url', 'http://127.0.0.1:5000/api/tables/availability');

console.log('------------------------------------------------------------------------------');
console.log(' [k6 Performance Evaluator] Parsing k6 Summary Export');
console.log(` Target File: ${summaryJsonPath}`);
console.log(` Profile:     ${profileName}`);
console.log(` Target URL:  ${targetUrl}`);
console.log('------------------------------------------------------------------------------');

if (!fs.existsSync(summaryJsonPath)) {
  console.error(`[FATAL] k6 summary JSON not found at: ${summaryJsonPath}`);
  console.error('Ensure k6 executed and generated --summary-export.');
  process.exit(1);
}

let rawJson;
try {
  rawJson = fs.readFileSync(summaryJsonPath, 'utf8');
} catch (err) {
  console.error(`[FATAL] Unable to read summary JSON: ${err.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(rawJson);
} catch (err) {
  console.error(`[FATAL] Malformed summary JSON: ${err.message}`);
  process.exit(1);
}

if (!data || typeof data !== 'object') {
  console.error('[FATAL] Summary JSON is empty or not an object.');
  process.exit(1);
}

const metrics = data.metrics;
if (!metrics || typeof metrics !== 'object' || Object.keys(metrics).length === 0) {
  console.error('[FATAL] Missing or empty performance metrics object in summary JSON.');
  process.exit(1);
}

const rootGroup = data.root_group || {};

// Format helper
function fmtMs(val) {
  if (val === undefined || val === null) return 'N/A';
  if (typeof val !== 'number') return `${val}`;
  if (val < 1) {
    return `${(val * 1000).toFixed(2)} µs`;
  }
  return `${val.toFixed(2)} ms`;
}

function fmtPercent(fraction) {
  if (fraction === undefined || fraction === null) return 'N/A';
  return `${(fraction * 100).toFixed(2)}%`;
}

// Extract metrics
const httpReqs = metrics.http_reqs || {};
const totalRequests = typeof httpReqs.count === 'number' ? httpReqs.count : 0;
const reqRate = httpReqs.rate ? httpReqs.rate.toFixed(2) : '0.00';

const duration = metrics.http_req_duration || {};
const avgDuration = duration.avg || 0;
const medDuration = duration.med || duration['p(50)'] || 0;
const p90Duration = duration['p(90)'] || 0;
const p95Duration = duration['p(95)'] || 0;
const p99Duration = duration['p(99)'] || 0;
const minDuration = duration.min || 0;
const maxDuration = duration.max || 0;

const reqFailed = metrics.http_req_failed || {};
const failedRate = reqFailed.value !== undefined ? reqFailed.value : (reqFailed.passes && totalRequests ? reqFailed.passes / totalRequests : 0);
const failedRequests = reqFailed.passes !== undefined ? reqFailed.passes : 0;

const checks = metrics.checks || {};
const totalChecks = (checks.passes || 0) + (checks.fails || 0);
const checkPasses = checks.passes || 0;
const checkFails = checks.fails || 0;
const checkPassRate = totalChecks > 0 ? checkPasses / totalChecks : (checks.value !== undefined ? checks.value : 0);

const vus = metrics.vus || {};
const vusMax = metrics.vus_max || {};
const vuCount = vus.value || vusMax.value || 1;

// Collect thresholds
const thresholdResults = [];
let allThresholdsPassed = true;

for (const [metricName, metricObj] of Object.entries(metrics)) {
  if (metricObj && metricObj.thresholds) {
    for (const [threshName, failed] of Object.entries(metricObj.thresholds)) {
      const passed = !failed;
      if (!passed) allThresholdsPassed = false;
      thresholdResults.push({
        metric: metricName,
        threshold: threshName,
        passed,
      });
    }
  }
}

// Collect check details from root_group
const checkDetails = [];
let allChecksPassed = true;
if (rootGroup.checks) {
  for (const [checkName, checkObj] of Object.entries(rootGroup.checks)) {
    const passed = (checkObj.fails || 0) === 0 && (checkObj.passes || 0) > 0;
    if (!passed) allChecksPassed = false;
    checkDetails.push({
      name: checkName,
      passes: checkObj.passes || 0,
      fails: checkObj.fails || 0,
      passed,
    });
  }
}

// Enforce mandatory performance gates
const gateViolations = [];

if (totalRequests <= 0) {
  gateViolations.push('Zero HTTP requests were executed (empty run)');
}

if (totalChecks <= 0) {
  gateViolations.push('No response checks were evaluated');
}

if (checkFails > 0 || !allChecksPassed) {
  gateViolations.push(`${checkFails} response check(s) failed`);
}

if (thresholdResults.length === 0) {
  gateViolations.push('No performance thresholds were evaluated in the k6 summary');
}

if (!allThresholdsPassed) {
  gateViolations.push('One or more performance thresholds breached configured limits');
}

const executionStatus = gateViolations.length === 0 ? 'PASSED' : 'FAILED';
const statusBadge = executionStatus === 'PASSED' ? '✅ **PASSED**' : '❌ **FAILED**';

// Build Markdown
const markdownContent = `## ⚡ k6 Load & Performance Testing Summary

- **Course:** SE3112 — Advanced Software Engineering
- **Role / Owner:** D.M.N. Presanjith (\`IT24101505\`) — Load & Performance Testing Lead
- **Pipeline Orchestration:** Wijesinghe K (\`IT24102587\`) — CI/CD Pipeline Lead
- **Execution Timestamp:** ${new Date().toISOString()}
- **Target Endpoint:** \`${targetUrl}\`
- **Overall Status:** ${statusBadge}

---

### 1. Workload & Performance Overview

| Metric Dimension | Measured Value | Threshold / Target Criteria | Gate Status |
| :--- | :--- | :--- | :---: |
| **Test Profile** | \`${profileName}\` | 1 VU for 10 seconds | - |
| **Virtual Users (VUs)** | \`${vuCount} VU\` | Peak Concurrency | - |
| **Total HTTP Requests** | \`${totalRequests}\` (\`${reqRate} req/s\`) | Throughput | ${totalRequests > 0 ? '✅ PASS' : '❌ FAIL'} |
| **HTTP Checks Succeeded** | \`${checkPasses}/${totalChecks}\` (\`${fmtPercent(checkPassRate)}\`) | \`rate > 0.99\` (99%) | ${checkPassRate >= 0.99 && checkFails === 0 ? '✅ PASS' : '❌ FAIL'} |
| **HTTP Request Failure Rate** | \`${fmtPercent(failedRate)}\` (\`${failedRequests} failed\`) | \`rate < 0.01\` (< 1.0%) | ${failedRate < 0.01 ? '✅ PASS' : '❌ FAIL'} |
| **p95 Response Latency** | \`${fmtMs(p95Duration)}\` | \`p(95) < 1000 ms\` | ${p95Duration < 1000 ? '✅ PASS' : '❌ FAIL'} |
| **p99 Response Latency** | \`${fmtMs(p99Duration)}\` | Advisory Observation | ℹ️ INFO |
| **Median (p50) Latency** | \`${fmtMs(medDuration)}\` | Typical Response Time | ℹ️ INFO |
| **Average Latency** | \`${fmtMs(avgDuration)}\` | Workload Mean | ℹ️ INFO |
| **Min / Max Latency** | \`${fmtMs(minDuration)}\` / \`${fmtMs(maxDuration)}\` | Range Extremes | ℹ️ INFO |

---

### 2. Response Contract & Integrity Checks

| Check Name | Passes | Failures | Status |
| :--- | :---: | :---: | :---: |
${checkDetails.length > 0 ? checkDetails.map(c => `| \`${c.name}\` | ${c.passes} | ${c.fails} | ${c.passed ? '✅ PASS' : '❌ FAIL'} |`).join('\n') : '| `No checks recorded` | 0 | 0 | ❌ FAIL |'}

---

### 3. Automated Performance Threshold Results

| Metric | Threshold Expression | Result |
| :--- | :--- | :---: |
${thresholdResults.length > 0 ? thresholdResults.map(t => `| \`${t.metric}\` | \`${t.threshold}\` | ${t.passed ? '✅ PASSED' : '❌ BREACHED'} |`).join('\n') : '| `No thresholds defined` | - | ❌ FAIL |'}

${gateViolations.length > 0 ? `\n> [!CAUTION]\n> **Gate Failures Detected:**\n${gateViolations.map(v => `> - ${v}`).join('\n')}\n` : ''}
---

### 4. Technical Architecture & Environment Controls
- **System Under Test (SUT):** Cinnamon Bistro CSP \`reservation-service\` (.NET 10).
- **Service Isolation:** Executed with \`Kafka__PublisherEnabled=false\` and \`OrderExpiry__Enabled=false\`, isolating the controller from external message brokers and background sweep interference.
- **Zero Production Risk:** Workload strictly directed at isolated local container/process loopback.
- **Artifacts:** Raw JSON summary saved to \`${summaryJsonPath}\`.
`;

const outDir = path.dirname(outputMarkdownPath);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(outputMarkdownPath, markdownContent, 'utf8');

console.log(`[OK] Performance summary report generated: ${outputMarkdownPath}`);
console.log(`  Requests:       ${totalRequests} (${reqRate} req/s)`);
console.log(`  p95 Latency:    ${fmtMs(p95Duration)}`);
console.log(`  Checks Passed:  ${fmtPercent(checkPassRate)}`);
console.log(`  Failure Rate:   ${fmtPercent(failedRate)}`);
console.log(`  Overall Status: ${executionStatus}`);

if (gateViolations.length > 0) {
  console.error('[GATE FAILURES]');
  gateViolations.forEach(v => console.error(`  - ${v}`));
}

if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${markdownContent}\n`, 'utf8');
    console.log('[OK] Appended performance summary to GITHUB_STEP_SUMMARY');
  } catch (err) {
    console.warn(`[WARN] Could not write to GITHUB_STEP_SUMMARY: ${err.message}`);
  }
}

if (executionStatus !== 'PASSED') {
  process.exit(1);
}
process.exit(0);
