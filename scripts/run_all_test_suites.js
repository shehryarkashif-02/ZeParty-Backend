import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const testsDir = path.join(backendDir, 'tests');

const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

console.log(`====================================================`);
console.log(`ZeParty Test Suite Execution Runner`);
console.log(`Discovered ${testFiles.length} test files`);
console.log(`====================================================\n`);

const results = [];

async function runSingleTest(file) {
  return new Promise((resolve) => {
    const filePath = path.join('tests', file);
    const start = Date.now();
    let stdout = '';
    let stderr = '';

    const child = spawn(process.execPath, ['--test', filePath], {
      cwd: backendDir,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGKILL');
    }, 15000);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      const duration = Date.now() - start;
      if (isTimedOut) {
        resolve({ file, status: 'TIMEOUT', duration, code, output: stdout + '\n' + stderr });
      } else if (code === 0) {
        // Count pass/fail lines if present
        resolve({ file, status: 'PASS', duration, code, output: stdout });
      } else {
        resolve({ file, status: 'FAIL', duration, code, output: stdout + '\n' + stderr });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ file, status: 'ERROR', duration: Date.now() - start, code: 1, error: err.message });
    });
  });
}

async function runAll() {
  let passed = 0;
  let failed = 0;
  let timedOut = 0;
  let errored = 0;

  for (let i = 0; i < testFiles.length; i++) {
    const file = testFiles[i];
    process.stdout.write(`[${i + 1}/${testFiles.length}] Running ${file}... `);
    const res = await runSingleTest(file);
    results.push(res);

    if (res.status === 'PASS') {
      passed++;
      console.log(`✅ PASS (${res.duration}ms)`);
    } else if (res.status === 'TIMEOUT') {
      timedOut++;
      console.log(`⏱️ TIMEOUT (${res.duration}ms)`);
    } else if (res.status === 'FAIL') {
      failed++;
      console.log(`❌ FAIL (${res.duration}ms)`);
    } else {
      errored++;
      console.log(`⚠️ ERROR (${res.duration}ms)`);
    }
  }

  console.log(`\n====================================================`);
  console.log(`TEST EXECUTION SUMMARY:`);
  console.log(`Total Test Suites: ${testFiles.length}`);
  console.log(`Passed:            ${passed}`);
  console.log(`Failed:            ${failed}`);
  console.log(`Timed Out:         ${timedOut}`);
  console.log(`Errored:           ${errored}`);
  console.log(`====================================================`);

  const report = {
    timestamp: new Date().toISOString(),
    totalSuites: testFiles.length,
    passed,
    failed,
    timedOut,
    errored,
    results: results.map(r => ({
      file: r.file,
      status: r.status,
      duration: r.duration,
      code: r.code
    }))
  };

  const reportPath = path.resolve(backendDir, '../docs/TEST_EXECUTION_RESULTS.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nSaved test results to ${reportPath}`);
}

runAll().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
