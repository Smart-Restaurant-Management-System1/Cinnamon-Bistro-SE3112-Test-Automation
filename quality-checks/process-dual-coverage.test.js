/**
 * ==============================================================================
 * Test Suite: quality-checks/process-dual-coverage.test.js
 * Purpose: Unit tests for dual-source coverage processor using Node.js built-in test runner.
 * Owner: Wijesinghe K (IT24102587) - Area 1 Quality & Metrics Lead
 * ==============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  parseBaselineSummary,
  parseCoberturaXml,
  parseTrxResults,
  findLatestCoberturaFile,
  generateDualCoverageMarkdown,
} = require('./process-dual-coverage.js');

describe('process-dual-coverage test suite', () => {
  // 1. Baseline Summary Parsing
  it('should parse valid baseline Summary.json correctly', () => {
    const mockJson = JSON.stringify({
      summary: {
        linecoverage: 44.9,
        branchcoverage: 42.4,
        coveredlines: 1478,
        coverablelines: 3288,
        totallines: 17296,
        coveredbranches: 393,
        totalbranches: 926,
      },
      coverage: {
        assemblies: [
          {
            name: 'identity-service',
            coverage: 46.6,
            coveredlines: 227,
            coverablelines: 487,
            branchcoverage: 48.5,
            coveredbranches: 33,
            totalbranches: 68,
            classes: 24,
            totallines: 2181,
          },
          {
            name: 'reservation-service',
            coverage: 44.6,
            coveredlines: 1251,
            coverablelines: 2801,
            branchcoverage: 41.9,
            coveredbranches: 360,
            totalbranches: 858,
            classes: 149,
            totallines: 15115,
          },
        ],
      },
    });

    const result = parseBaselineSummary(mockJson, true);
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.lineCoverage, 44.9);
    assert.strictEqual(result.branchCoverage, 42.4);
    assert.strictEqual(result.coveredLines, 1478);
    assert.strictEqual(result.coverableLines, 3288);
    assert.strictEqual(result.coveredBranches, 393);
    assert.strictEqual(result.totalBranches, 926);
    assert.strictEqual(result.assemblies.length, 2);
    assert.strictEqual(result.assemblies[0].name, 'identity-service');
  });

  it('should reject malformed baseline JSON', () => {
    const result = parseBaselineSummary('{ invalid: json ]', true);
    assert.strictEqual(result.available, false);
    assert.ok(result.error);
  });

  it('should reject baseline data with covered lines > coverable lines', () => {
    const mockJson = JSON.stringify({
      summary: {
        linecoverage: 150,
        coveredlines: 500,
        coverablelines: 200,
      },
    });
    const result = parseBaselineSummary(mockJson, true);
    assert.strictEqual(result.available, false);
    assert.match(result.error, /Invalid line count values/);
  });

  // 2. Cobertura XML Parsing
  it('should parse valid Cobertura XML correctly and calculate percentages', () => {
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<coverage line-rate="0.0544" branch-rate="0.0939" version="1.9" timestamp="12345" lines-covered="179" lines-valid="3288" branches-covered="87" branches-valid="926">
  <packages>
    <package name="identity-service" line-rate="0.1663" branch-rate="0.0769">
      <classes>
        <class name="AuthService">
          <lines>
            <line number="1" hits="1" branch="False" />
            <line number="2" hits="0" branch="False" />
            <line number="3" hits="1" branch="True" condition-coverage="50% (1/2)" />
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

    const result = parseCoberturaXml(mockXml, true);
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.coveredLines, 179);
    assert.strictEqual(result.coverableLines, 3288);
    assert.strictEqual(result.lineCoverage, 5.4); // 179 / 3288 = 5.44% -> 5.4%
    assert.strictEqual(result.coveredBranches, 87);
    assert.strictEqual(result.totalBranches, 926);
    assert.strictEqual(result.branchCoverage, 9.4); // 87 / 926 = 9.39% -> 9.4%
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'identity-service');
    assert.strictEqual(result.packages[0].coveredLines, 2);
    assert.strictEqual(result.packages[0].coverableLines, 3);
  });

  it('should handle zero valid lines or branches safely without division by zero', () => {
    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<coverage lines-covered="0" lines-valid="0" branches-covered="0" branches-valid="0">
  <packages></packages>
</coverage>`;

    const result = parseCoberturaXml(mockXml, true);
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.lineCoverage, 0);
    assert.strictEqual(result.branchCoverage, 0);
    assert.strictEqual(result.coveredLines, 0);
    assert.strictEqual(result.coverableLines, 0);
  });

  it('should reject malformed Cobertura XML missing required attributes', () => {
    const mockXml = `<coverage invalid="true"></coverage>`;
    const result = parseCoberturaXml(mockXml, true);
    assert.strictEqual(result.available, false);
    assert.match(result.error, /lines-covered or lines-valid missing/);
  });

  // 3. TRX Test Results Parsing
  it('should parse dynamic test counts from TRX report', () => {
    const mockTrx = `<?xml version="1.0" encoding="utf-8"?>
<TestRun id="1" name="run1" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <ResultSummary outcome="Completed">
    <Counters total="185" executed="185" passed="185" failed="0" error="0" notExecuted="0" />
  </ResultSummary>
</TestRun>`;

    const result = parseTrxResults(mockTrx, true);
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.total, 185);
    assert.strictEqual(result.passed, 185);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.outcome, 'Completed');
  });

  it('should correctly sum failed and error counts from TRX', () => {
    const mockTrx = `<?xml version="1.0" encoding="utf-8"?>
<TestRun id="2" name="run2" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <ResultSummary outcome="Failed">
    <Counters total="160" executed="160" passed="155" failed="3" error="2" notExecuted="0" />
  </ResultSummary>
</TestRun>`;

    const result = parseTrxResults(mockTrx, true);
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.total, 160);
    assert.strictEqual(result.passed, 155);
    assert.strictEqual(result.failed, 5); // 3 failed + 2 error
    assert.strictEqual(result.outcome, 'Failed');
  });

  // 4. Duplicate/Ambiguous File Selection
  it('should deterministically select the newest Cobertura file when multiple exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cobertura-test-'));
    try {
      const dirA = path.join(tmpDir, 'guid-old');
      const dirB = path.join(tmpDir, 'guid-new');
      fs.mkdirSync(dirA, { recursive: true });
      fs.mkdirSync(dirB, { recursive: true });

      const fileOld = path.join(dirA, 'coverage.cobertura.xml');
      const fileNew = path.join(dirB, 'coverage.cobertura.xml');

      fs.writeFileSync(fileOld, '<coverage old="true" />');
      // Set old mtime 1 hour ago
      const pastTime = new Date(Date.now() - 3600000);
      fs.utimesSync(fileOld, pastTime, pastTime);

      fs.writeFileSync(fileNew, '<coverage new="true" />');

      const discovery = findLatestCoberturaFile(tmpDir);
      assert.strictEqual(discovery.allFiles.length, 2);
      assert.strictEqual(discovery.selected, fileNew);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 5. Markdown Report Generation & Separation Verification
  it('should generate markdown with two distinct sections and no additive percentages', () => {
    const baseline = {
      available: true,
      lineCoverage: 44.9,
      branchCoverage: 42.4,
      coveredLines: 1478,
      coverableLines: 3288,
      coveredBranches: 393,
      totalBranches: 926,
      assemblies: [
        {
          name: 'identity-service',
          lineCoverage: '46.6',
          coveredLines: 227,
          coverableLines: 487,
          branchCoverage: '48.5',
          coveredBranches: 33,
          totalBranches: 68,
          classes: 24,
        },
      ],
    };

    const independent = {
      available: true,
      lineCoverage: 5.4,
      branchCoverage: 9.4,
      coveredLines: 179,
      coverableLines: 3288,
      coveredBranches: 87,
      totalBranches: 926,
      packages: [
        {
          name: 'identity-service',
          lineCoverage: 16.6,
          coveredLines: 81,
          coverableLines: 487,
          branchCoverage: 7.7,
          coveredBranches: 10,
          totalBranches: 130,
        },
      ],
    };

    const trx = {
      available: true,
      total: 156,
      passed: 156,
      failed: 0,
      skipped: 0,
      outcome: 'Completed',
    };

    const md = generateDualCoverageMarkdown(baseline, independent, trx);

    // Verify both headers exist
    assert.ok(md.includes('## 1. CSP Core Baseline Coverage'));
    assert.ok(md.includes('## 2. Independent Unit Testing Coverage'));

    // Verify baseline numbers are present
    assert.ok(md.includes('1,478 / 3,288 lines'));
    assert.ok(md.includes('44.9%'));

    // Verify independent numbers are present
    assert.ok(md.includes('179 / 3,288 lines'));
    assert.ok(md.includes('5.4%'));
    assert.ok(md.includes('156 tests'));

    // Verify independent suite is marked INFORMATIONAL
    assert.ok(md.includes('INFORMATIONAL'));

    // Verify strict governance statement on non-additive percentages is present
    assert.ok(md.includes('are not additive'));
  });

  it('should display NOT AVAILABLE when independent coverage data is missing', () => {
    const baseline = {
      available: true,
      lineCoverage: 44.9,
      branchCoverage: 42.4,
      coveredLines: 1478,
      coverableLines: 3288,
      coveredBranches: 393,
      totalBranches: 926,
      assemblies: [],
    };

    const independent = {
      available: false,
      error: 'Coverage file missing',
    };

    const md = generateDualCoverageMarkdown(baseline, independent, null);
    assert.ok(md.includes('NOT AVAILABLE'));
    assert.ok(md.includes('Coverage file missing'));
  });

  it('should deprioritize VSTest In deployment directories in favor of direct collector files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vstest-test-'));
    try {
      const directDir = path.join(tmpDir, 'c68a3839-guid');
      const inDir = path.join(tmpDir, 'Kunchana_DESKTOP_2026', 'In', 'MACHINE');
      fs.mkdirSync(directDir, { recursive: true });
      fs.mkdirSync(inDir, { recursive: true });

      const directFile = path.join(directDir, 'coverage.cobertura.xml');
      const inFile = path.join(inDir, 'coverage.cobertura.xml');

      fs.writeFileSync(directFile, '<coverage direct="true" />');
      fs.writeFileSync(inFile, '<coverage in="true" />');

      // Set identical mtime
      const now = new Date();
      fs.utimesSync(directFile, now, now);
      fs.utimesSync(inFile, now, now);

      const discovery = findLatestCoberturaFile(tmpDir);
      assert.strictEqual(discovery.allFiles.length, 2);
      assert.strictEqual(discovery.selected, directFile);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should process realistic Release-mode independent metrics correctly', () => {
    const releaseXml = `<?xml version="1.0" encoding="utf-8"?>
<coverage line-rate="0.05647955647955648" branch-rate="0.0939524838012959" version="1.9" timestamp="12345" lines-covered="163" lines-valid="2886" branches-covered="87" branches-valid="926">
  <packages>
    <package name="identity-service" line-rate="0.1705" branch-rate="0.0769">
      <classes></classes>
    </package>
  </packages>
</coverage>`;

    const parsed = parseCoberturaXml(releaseXml, true);
    assert.strictEqual(parsed.available, true);
    assert.strictEqual(parsed.coveredLines, 163);
    assert.strictEqual(parsed.coverableLines, 2886);
    assert.strictEqual(parsed.lineCoverage, 5.6);
    assert.strictEqual(parsed.coveredBranches, 87);
    assert.strictEqual(parsed.totalBranches, 926);
    assert.strictEqual(parsed.branchCoverage, 9.4);
  });
});
