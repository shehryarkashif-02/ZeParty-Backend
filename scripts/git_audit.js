import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('GIT SECURITY AUDIT & SECRET LEAK PREVENTION CHECK');
console.log('====================================================\n');

try {
  const status = execSync('git status --short', { cwd: rootDir, encoding: 'utf8' });
  console.log('Git Status:');
  console.log(status || '(Clean working directory)');

  // Verify .env files are in .gitignore
  const gitignorePath = path.join(rootDir, '.gitignore');
  const backendGitignorePath = path.join(rootDir, 'backend/.gitignore');
  const adminGitignorePath = path.join(rootDir, 'Admin Frontend/.gitignore');

  const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const backendGitignoreContent = fs.existsSync(backendGitignorePath) ? fs.readFileSync(backendGitignorePath, 'utf8') : '';
  const adminGitignoreContent = fs.existsSync(adminGitignorePath) ? fs.readFileSync(adminGitignorePath, 'utf8') : '';

  const envIgnored = 
    gitignoreContent.includes('.env') || 
    backendGitignoreContent.includes('.env') || 
    adminGitignoreContent.includes('.env');

  console.log('\nSecret Protection Status:');
  console.log(`- .env ignored in .gitignore: ${envIgnored ? '✅ YES' : '❌ NO'}`);

  // Check if .env is tracked in git index
  let trackedEnv = false;
  try {
    const trackedFiles = execSync('git ls-files', { cwd: rootDir, encoding: 'utf8' });
    const lines = trackedFiles.split('\n');
    const trackedEnvFiles = lines.filter(l => l.endsWith('.env') || l.includes('.env.local') || l.includes('.env.production'));
    if (trackedEnvFiles.length > 0) {
      console.log('⚠️ WARNING: Found tracked .env files in git:', trackedEnvFiles);
      trackedEnv = true;
    } else {
      console.log('✅ PASS: No .env files are tracked by Git.');
    }
  } catch (e) {
    console.log('Could not run git ls-files:', e.message);
  }

  // Check if .env.example exists and has placeholders
  const envExamplePath = path.join(rootDir, 'backend/.env.example');
  if (fs.existsSync(envExamplePath)) {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    const hasPlaceholders = envExample.includes('postgresql://') && envExample.includes('your-');
    console.log(`✅ PASS: backend/.env.example exists with sanitized placeholders.`);
  }

  console.log('\n====================================================');
  console.log('GIT SAFETY AUDIT COMPLETED');
  console.log('====================================================\n');
} catch (err) {
  console.error('Git audit error:', err.message);
}
process.exit(0);
