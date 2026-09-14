import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, 'tests');

const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.js'))
  .map(f => path.join(testsDir, f));

console.log(`Discovered ${testFiles.length} test files.`);

const stream = run({
  files: testFiles,
  concurrency: true,
  timeout: 30000,
});

stream.compose(new spec()).pipe(process.stdout);

let passCount = 0;
let failCount = 0;
let skipCount = 0;
let todoCount = 0;

stream.on('test:pass', (t) => {
  if (t.nesting === 0 || t.nesting === 1) passCount++;
});

stream.on('test:fail', (t) => {
  failCount++;
});

stream.on('test:skip', (t) => {
  skipCount++;
});

stream.on('test:todo', (t) => {
  todoCount++;
});

stream.on('end', () => {
  console.log('\n==============================');
  console.log('TEST SUMMARY:');
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Todo: ${todoCount}`);
  console.log('==============================\n');
  process.exit(failCount > 0 ? 1 : 0);
});
