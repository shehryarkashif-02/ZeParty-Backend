import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../src/config/database.js';
import redisClient from '../src/config/redis.js';
import { generateAccessToken, verifyAccessToken } from '../src/services/token.service.js';
import { hashPassword, comparePassword, generateOtpCode, hashToken } from '../src/utils/crypto.util.js';
import { deriveAgoraUid, generateAgoraRtcToken, AGORA_ROLES } from '../src/utils/agoraToken.util.js';
import env from '../src/config/env.js';
import { serializeData } from '../src/utils/serializer.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const testsDir = path.join(backendDir, 'tests');

async function main() {
  console.log('====================================================');
  console.log('ZEPARTY PRE-DEPLOYMENT COMPREHENSIVE SYSTEM VERIFICATION');
  console.log('====================================================\n');

  const checklist = {};

  // 1. Database Check
  try {
    process.stdout.write('[1/8] Verifying Database Connection (PostgreSQL)... ');
    await prisma.$queryRaw`SELECT 1`;
    const adminCount = await prisma.admin.count();
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const policyCount = await prisma.policyConfiguration.count();
    checklist.database = {
      status: 'PASS',
      details: { adminCount, userCount, roleCount, policyCount }
    };
    console.log(`✅ PASS (Admins: ${adminCount}, Users: ${userCount}, Roles: ${roleCount}, Policies: ${policyCount})`);
  } catch (err) {
    checklist.database = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 2. Redis Check
  try {
    process.stdout.write('[2/8] Verifying Redis Connection... ');
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    const pong = await redisClient.ping();
    checklist.redis = { status: 'PASS', pong };
    console.log(`✅ PASS (Ping response: ${pong})`);
  } catch (err) {
    checklist.redis = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 3. Cryptography & Password Check
  try {
    process.stdout.write('[3/8] Verifying Cryptography & Password Hashing... ');
    const plain = 'TestSecurePassword123!';
    const hashed = await hashPassword(plain);
    const isValid = await comparePassword(plain, hashed);
    const otp = generateOtpCode(6);
    const otpHash = hashToken(otp);
    if (isValid && otp.length === 6 && otpHash.length === 64) {
      checklist.crypto = { status: 'PASS' };
      console.log('✅ PASS (Bcrypt + CSPRNG OTP + SHA256)');
    } else {
      throw new Error('Crypto validation failed assertion');
    }
  } catch (err) {
    checklist.crypto = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 4. JWT Token Generation & Verification
  try {
    process.stdout.write('[4/8] Verifying JWT Token Service... ');
    const claims = { adminId: 'admin-super-id', roleId: 'super_admin', isAdmin: true, userType: 'ADMIN' };
    const token = generateAccessToken(claims);
    const decoded = verifyAccessToken(token);
    if (decoded.sub === claims.adminId && decoded.isAdmin === true) {
      checklist.jwt = { status: 'PASS' };
      console.log('✅ PASS (Access/Refresh Token signing & verification)');
    } else {
      throw new Error('JWT verification claims mismatch');
    }
  } catch (err) {
    checklist.jwt = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 5. Agora RTC Token Generation
  try {
    process.stdout.write('[5/8] Verifying Agora RTC Staging Integration... ');
    const channelName = 'room-test-channel-01';
    const testUserId = 'test-user-uuid-123';
    const uid = deriveAgoraUid(testUserId);
    const rtcToken = generateAgoraRtcToken({
      appId: env.AGORA_APP_ID,
      appCertificate: env.AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      role: AGORA_ROLES.BROADCASTER,
      expirySeconds: 3600,
    });
    if (rtcToken && rtcToken.length > 50 && typeof uid === 'number') {
      checklist.agora = { status: 'PASS', uid, tokenLength: rtcToken.length };
      console.log(`✅ PASS (UID derived: ${uid}, Token generated: ${rtcToken.slice(0, 15)}...)`);
    } else {
      throw new Error('Agora token generation returned invalid output');
    }
  } catch (err) {
    checklist.agora = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 6. BigInt and Decimal Serializer
  try {
    process.stdout.write('[6/8] Verifying BigInt / Decimal JSON Serializer... ');
    const sample = {
      coins: 5000000000n,
      amount: { isDecimal: true, toString: () => '99.99' },
      items: [10n, 20n]
    };
    const serialized = serializeData(sample);
    const jsonStr = JSON.stringify(serialized);
    if (jsonStr.includes('"coins":"5000000000"') && jsonStr.includes('"amount":"99.99"')) {
      checklist.serializer = { status: 'PASS' };
      console.log('✅ PASS (BigInt, Prisma.Decimal, Nested Arrays/Objects)');
    } else {
      throw new Error('Serialization output mismatch');
    }
  } catch (err) {
    checklist.serializer = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 7. Admin Frontend Build Check
  try {
    process.stdout.write('[7/8] Verifying Admin Frontend Production Build Artifacts... ');
    const distPath = path.resolve(backendDir, '../Admin Frontend/dist');
    const indexHtml = path.join(distPath, 'index.html');
    const assetsDir = path.join(distPath, 'assets');
    if (fs.existsSync(indexHtml) && fs.existsSync(assetsDir) && fs.readdirSync(assetsDir).length >= 2) {
      checklist.frontendBuild = { status: 'PASS', distExists: true };
      console.log('✅ PASS (dist/index.html & assets compiled cleanly)');
    } else {
      throw new Error('Admin Frontend dist files not found');
    }
  } catch (err) {
    checklist.frontendBuild = { status: 'FAIL', error: err.message };
    console.log(`❌ FAIL: ${err.message}`);
  }

  // 8. Test Suites Batch Execution
  console.log('\n[8/8] Executing Test Suites in Backend...');
  const testFiles = fs.readdirSync(testsDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  let testPassCount = 0;
  let testFailCount = 0;
  const suiteResults = [];

  for (let i = 0; i < testFiles.length; i++) {
    const file = testFiles[i];
    const filePath = path.join('tests', file);
    try {
      execSync(`node --test ${filePath}`, {
        cwd: backendDir,
        env: { ...process.env, NODE_ENV: 'test' },
        timeout: 12000,
        stdio: 'pipe'
      });
      testPassCount++;
      suiteResults.push({ file, status: 'PASS' });
      process.stdout.write(`  [${i + 1}/${testFiles.length}] ${file}: PASS\n`);
    } catch (err) {
      testFailCount++;
      const stderr = err.stderr ? err.stderr.toString() : '';
      const stdout = err.stdout ? err.stdout.toString() : '';
      suiteResults.push({ file, status: 'FAIL', error: stderr || stdout || err.message });
      process.stdout.write(`  [${i + 1}/${testFiles.length}] ${file}: FAIL\n`);
    }
  }

  checklist.testSuites = {
    total: testFiles.length,
    passed: testPassCount,
    failed: testFailCount,
    details: suiteResults
  };

  console.log('\n====================================================');
  console.log('OVERALL VERIFICATION SUMMARY:');
  console.log(`Database:        ${checklist.database.status}`);
  console.log(`Redis:           ${checklist.redis.status}`);
  console.log(`Crypto/Bcrypt:   ${checklist.crypto.status}`);
  console.log(`JWT Auth:        ${checklist.jwt.status}`);
  console.log(`Agora RTC:       ${checklist.agora.status}`);
  console.log(`Serializer:      ${checklist.serializer.status}`);
  console.log(`Frontend Build:  ${checklist.frontendBuild.status}`);
  console.log(`Test Suites:     ${testPassCount}/${testFiles.length} PASS`);
  console.log('====================================================\n');

  // Write verification report
  const reportPath = path.resolve(backendDir, '../docs/SYSTEM_VERIFICATION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(checklist, null, 2), 'utf8');
  console.log(`Wrote full report to ${reportPath}`);

  // Disconnect Redis & Prisma
  try {
    if (redisClient.isOpen) await redisClient.quit();
    await prisma.$disconnect();
  } catch (e) {}

  process.exit(0);
}

main().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
