#!/usr/bin/env node
/**
 * ==============================================================================
 * Script: quality-checks/compare-eslint-baseline.js
 * Purpose: Baseline-aware ESLint finding comparator and quality gate evaluator.
 * Individual Owner: Wijesinghe K (IT24102587) - Code Quality & Metrics Lead
 * ==============================================================================
 *
 * Responsibilities:
 * 1. Parses raw structured ESLint JSON output.
 * 2. Compares findings against historical baseline (quality-checks/baselines/eslint-baseline.json).
 * 3. Uses stable finding identities (normalized file path, rule ID, primary message)
 *    and multiset frequency matching to prevent false-positive regressions on line shifts.
 * 4. Generates comprehensive Markdown summary (test-reports/quality/eslint-summary.md).
 * 5. Evaluates regression gate:
 *    - Green: Analysis completed + 0 NEW errors introduced.
 *    - Red: 1+ NEW errors introduced, or missing baseline, or corrupt analysis.
 */

const fs = require('node:fs');
const path = require('node:path');

// ------------------------------------------------------------------------------
// CLI Arguments & Configuration
// ------------------------------------------------------------------------------
const args = process.argv.slice(2);
const isGenerateMode = args.includes('--generate-baseline');

function getArgValue(flag, defaultValue) {
  const idx = args.indexOf(flag);
  return (idx !== -1 && idx + 1 < args.length) ? args[idx + 1] : defaultValue;
}

const resultsFile = getArgValue('--results', 'test-reports/quality/eslint-results.json');
const baselineFile = getArgValue('--baseline', 'quality-checks/baselines/eslint-baseline.json');
const summaryFile = getArgValue('--summary', 'test-reports/quality/eslint-summary.md');
const targetCommit = getArgValue('--commit', 'ee41765622ac458399bd208171d930dcb6a070a9');
const eslintVersion = getArgValue('--eslint-version', '10.9.1');

// ------------------------------------------------------------------------------
// Helper: Normalize File Paths Relative to frontend/restaurant-web
// ------------------------------------------------------------------------------
function normalizeFilePath(rawPath) {
  if (!rawPath) return 'unknown';
  let p = rawPath.replace(/\\/g, '/');
  const anchor = 'restaurant-web/';
  const idx = p.indexOf(anchor);
  if (idx !== -1) {
    p = p.substring(idx + anchor.length);
  } else {
    // If path starts with target-app/frontend/ or similar
    p = p.replace(/^.*?(src\/|tests\/|[^/]+\.(js|jsx|mjs|cjs|ts|tsx))/, '$1');
  }
  return p;
}

// ------------------------------------------------------------------------------
// Helper: Extract Stable Finding Signature
// ------------------------------------------------------------------------------
function extractFindingSignature(normFilePath, msg) {
  const ruleId = msg.ruleId || (msg.fatal ? 'fatal' : 'syntax-error');
  // Extract primary message line, stripping multiline code frames and stack traces
  const rawMsg = msg.message || '';
  const primaryMessage = rawMsg.split('\n')[0].trim();
  const severity = msg.severity === 2 ? 'error' : 'warning';
  const signatureKey = `${normFilePath}::${ruleId}::${primaryMessage}`;

  return {
    signatureKey,
    filePath: normFilePath,
    ruleId,
    severity,
    severityNum: msg.severity,
    primaryMessage,
    fullMessage: rawMsg,
    line: msg.line || 0,
    column: msg.column || 0,
  };
}

// ------------------------------------------------------------------------------
// 1. Validate & Parse ESLint Results JSON
// ------------------------------------------------------------------------------
if (!fs.existsSync(resultsFile)) {
  console.error(`[FATAL] ESLint results file not found at: ${resultsFile}`);
  process.exit(1);
}

let rawJson;
try {
  rawJson = fs.readFileSync(resultsFile, 'utf8');
} catch (err) {
  console.error(`[FATAL] Failed to read ESLint results file: ${err.message}`);
  process.exit(1);
}

let eslintResults;
try {
  eslintResults = JSON.parse(rawJson);
  if (!Array.isArray(eslintResults)) {
    throw new Error('ESLint results root must be an array.');
  }
} catch (err) {
  console.error(`[FATAL] Invalid ESLint results JSON: ${err.message}`);
  process.exit(1);
}

// ------------------------------------------------------------------------------
// 2. Flatten & Structure Current Findings
// ------------------------------------------------------------------------------
const currentFindings = [];
const ruleDistribution = {};
let totalErrors = 0;
let totalWarnings = 0;
let filesWithIssues = 0;

for (const fileObj of eslintResults) {
  const normPath = normalizeFilePath(fileObj.filePath);
  const messages = fileObj.messages || [];

  if (messages.length > 0) {
    filesWithIssues++;
  }

  totalErrors += (fileObj.errorCount || 0);
  totalWarnings += (fileObj.warningCount || 0);

  for (const msg of messages) {
    const finding = extractFindingSignature(normPath, msg);
    currentFindings.push(finding);

    ruleDistribution[finding.ruleId] = (ruleDistribution[finding.ruleId] || 0) + 1;
  }
}

// ------------------------------------------------------------------------------
// 3. Baseline Generation Mode
// ------------------------------------------------------------------------------
if (isGenerateMode) {
  const baselineDir = path.dirname(baselineFile);
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  const baselineData = {
    metadata: {
      repository: 'Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System',
      branch: 'develop',
      commitSha: targetCommit,
      eslintVersion: eslintVersion,
      eslintConfig: 'eslint.config.js',
      generatedAt: new Date().toISOString(),
      generator: 'SE3112 Baseline-Aware Quality Gate (Wijesinghe K - IT24102587)',
    },
    summary: {
      totalFilesAnalyzed: eslintResults.length,
      filesWithIssues,
      totalErrors,
      totalWarnings,
      totalFindings: currentFindings.length,
      ruleDistribution,
    },
    // Map findings by signature key with frequency count
    findings: currentFindings.map(f => ({
      signatureKey: f.signatureKey,
      filePath: f.filePath,
      ruleId: f.ruleId,
      severity: f.severity,
      primaryMessage: f.primaryMessage,
      initialLine: f.line,
    })),
  };

  fs.writeFileSync(baselineFile, JSON.stringify(baselineData, null, 2), 'utf8');
  console.log(`[SUCCESS] Generated ESLint baseline with ${currentFindings.length} findings at: ${baselineFile}`);
  console.log(`Summary: ${totalErrors} errors, ${totalWarnings} warnings across ${filesWithIssues} files.`);
  process.exit(0);
}

// ------------------------------------------------------------------------------
// 4. Baseline Comparison & Quality Gate Evaluation
// ------------------------------------------------------------------------------
if (!fs.existsSync(baselineFile)) {
  console.error(`[FATAL] Baseline file does not exist at: ${baselineFile}`);
  console.error(`Run with '--generate-baseline' to establish an authorized baseline first.`);
  process.exit(1);
}

let baselineJson;
try {
  baselineJson = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
} catch (err) {
  console.error(`[FATAL] Failed to read or parse baseline file: ${err.message}`);
  process.exit(1);
}

// Multiset count of baseline findings
const baselineCountMap = new Map();
const baselineMeta = baselineJson.metadata || {};
const baselineFindings = baselineJson.findings || [];

for (const bf of baselineFindings) {
  const key = bf.signatureKey;
  baselineCountMap.set(key, (baselineCountMap.get(key) || 0) + 1);
}

// Multiset count of current findings
const currentCountMap = new Map();
const currentFindingByKey = new Map();

for (const cf of currentFindings) {
  const key = cf.signatureKey;
  currentCountMap.set(key, (currentCountMap.get(key) || 0) + 1);
  if (!currentFindingByKey.has(key)) {
    currentFindingByKey.set(key, []);
  }
  currentFindingByKey.get(key).push(cf);
}

// Compute New, Baseline, and Resolved findings
const newFindings = [];
const resolvedFindings = [];
let matchedBaselineCount = 0;

// Identify new findings and matched baseline findings
for (const [key, currentQty] of currentCountMap.entries()) {
  const baselineQty = baselineCountMap.get(key) || 0;
  if (currentQty > baselineQty) {
    const diff = currentQty - baselineQty;
    const instances = currentFindingByKey.get(key) || [];
    for (let i = 0; i < diff; i++) {
      newFindings.push(instances[instances.length - 1 - i] || { signatureKey: key, severity: 'error' });
    }
    matchedBaselineCount += baselineQty;
  } else {
    matchedBaselineCount += currentQty;
  }
}

// Identify resolved findings
for (const [key, baselineQty] of baselineCountMap.entries()) {
  const currentQty = currentCountMap.get(key) || 0;
  if (baselineQty > currentQty) {
    const diff = baselineQty - currentQty;
    const sample = baselineFindings.find(b => b.signatureKey === key) || { signatureKey: key };
    for (let i = 0; i < diff; i++) {
      resolvedFindings.push(sample);
    }
  }
}

const newErrors = newFindings.filter(f => f.severity === 'error');
const newWarnings = newFindings.filter(f => f.severity === 'warning');

// ------------------------------------------------------------------------------
// 5. Evaluate Quality Gate
// ------------------------------------------------------------------------------
const regressionGatePassed = newErrors.length === 0;
const cleanLintPassed = (totalErrors === 0 && totalWarnings === 0);

// ------------------------------------------------------------------------------
// 6. Generate Markdown Summary Report
// ------------------------------------------------------------------------------
const summaryDir = path.dirname(summaryFile);
if (!fs.existsSync(summaryDir)) {
  fs.mkdirSync(summaryDir, { recursive: true });
}

let ruleTableMarkdown = '| Rule ID | Severity | Baseline Qty | Current Qty | Delta |\n| :--- | :---: | :---: | :---: | :---: |\n';
const allRules = Array.from(new Set([
  ...Object.keys(baselineJson.summary?.ruleDistribution || {}),
  ...Object.keys(ruleDistribution),
])).sort();

for (const rule of allRules) {
  const bQty = baselineJson.summary?.ruleDistribution?.[rule] || 0;
  const cQty = ruleDistribution[rule] || 0;
  const delta = cQty - bQty;
  const deltaStr = delta > 0 ? `+${delta}` : (delta < 0 ? `${delta}` : '0');
  const sev = (currentFindings.find(f => f.ruleId === rule)?.severity) || 'warning';
  ruleTableMarkdown += `| \`${rule}\` | ${sev} | ${bQty} | ${cQty} | ${deltaStr} |\n`;
}

let newErrorsMarkdown = '';
if (newErrors.length > 0) {
  newErrorsMarkdown = `\n### 🚨 New ESLint Violations (Regression Gate Failures)\n\n| File Path | Rule | Line:Col | Primary Message |\n| :--- | :--- | :---: | :--- |\n`;
  for (const ne of newErrors) {
    newErrorsMarkdown += `| \`${ne.filePath}\` | \`${ne.ruleId}\` | ${ne.line}:${ne.column} | ${ne.primaryMessage} |\n`;
  }
} else {
  newErrorsMarkdown = `\n> **✓ No New ESLint Errors**: The codebase introduces zero new error-level linting regressions beyond the authorized baseline.\n`;
}

let resolvedMarkdown = '';
if (resolvedFindings.length > 0) {
  resolvedMarkdown = `\n### 🎉 Resolved Historical Violations\n\n| File Path | Rule | Resolved Message |\n| :--- | :--- | :--- |\n`;
  for (const rf of resolvedFindings) {
    resolvedMarkdown += `| \`${rf.filePath}\` | \`${rf.ruleId}\` | ${rf.primaryMessage} |\n`;
  }
}

const reportMarkdown = `# ESLint Baseline-Aware Quality Report

**Target Component:** Cinnamon Bistro React 19 Frontend (\`frontend/restaurant-web\`)  
**Evaluation Mode:** Transparent Baseline-Aware Regression Gate  
**Assigned Owner:** Wijesinghe K (\`IT24102587\`) - Code Quality & Metrics Lead  
**Analysis Execution Status:** **COMPLETED**  
**Clean Lint Status:** **${cleanLintPassed ? 'PASSED (0 findings)' : 'FAILED (Historical baseline findings present)'}**  
**Regression Gate Status:** **${regressionGatePassed ? 'PASSED (Zero new errors introduced)' : 'FAILED (New regressions detected)'}**  

---

### Executive Metrics Summary

| Quality Metric | Metric Value | Baseline Reference | Status / Gate Policy |
| :--- | :---: | :---: | :--- |
| **Total Error Findings** | **${totalErrors}** | ${baselineJson.summary?.totalErrors ?? 'N/A'} | Historical baseline errors (visible, non-blocking) |
| **Total Warning Findings** | **${totalWarnings}** | ${baselineJson.summary?.totalWarnings ?? 'N/A'} | Advisory warnings |
| **Total Combined Findings** | **${totalErrors + totalWarnings}** | ${baselineJson.summary?.totalFindings ?? 'N/A'} | Full finding inventory |
| **Matched Baseline Findings** | **${matchedBaselineCount}** | ${baselineFindings.length} | Unchanged historical technical debt |
| **New Errors (Regressions)** | **${newErrors.length}** | 0 | **Mandatory Gate: Must be 0** |
| **New Warnings** | **${newWarnings.length}** | 0 | Advisory |
| **Resolved Findings** | **${resolvedFindings.length}** | — | Fixed historical issues |

---

### Baseline Reference Provenance
- **Upstream Repository:** \`${baselineMeta.repository || 'Smart-Restaurant-Management-System1/Smart-Restaurant-Management-System'}\`
- **Baseline Commit SHA:** \`${baselineMeta.commitSha || targetCommit}\`
- **Target Branch:** \`${baselineMeta.branch || 'develop'}\`
- **ESLint Version:** \`${baselineMeta.eslintVersion || eslintVersion}\`
- **Configuration:** \`${baselineMeta.eslintConfig || 'eslint.config.js'}\`
- **Baseline Timestamp:** \`${baselineMeta.generatedAt || 'N/A'}\`

---

${newErrorsMarkdown}

${resolvedMarkdown}

### Violations Grouped by ESLint Rule

${ruleTableMarkdown}

---

### Quality Gate Policy Definition
1. **Analysis Execution Check**: The ESLint analyzer must complete successfully and output valid structured JSON. Any execution abort, dependency absence, or parse error fails the pipeline.
2. **Transparent Technical Debt Visibility**: The 40 existing errors and 89 warnings in the baseline CSP codebase are fully preserved, cataloged, and disclosed in report artifacts. They are **not** hidden, silenced, or globally disabled with \`|| true\`.
3. **Strict Regression Prevention**: Commits introducing new error-level ESLint violations fail the CI build immediately.
4. **Clean Lint Goal**: Full clean lint status will pass only when all 129 historical findings are resolved in the application source.
`;

fs.writeFileSync(summaryFile, reportMarkdown, 'utf8');
console.log(`[SUMMARY] ESLint baseline report generated at: ${summaryFile}`);
console.log(`Results: Total=${totalErrors + totalWarnings} (Errors=${totalErrors}, Warnings=${totalWarnings}) | Baseline=${matchedBaselineCount} | NewErrors=${newErrors.length} | Resolved=${resolvedFindings.length}`);
console.log(`Regression Gate: ${regressionGatePassed ? 'PASSED' : 'FAILED'}`);

// Exit code convention: 0 if regression gate passed, 1 if regression gate failed
if (!regressionGatePassed) {
  process.exit(1);
}
process.exit(0);

