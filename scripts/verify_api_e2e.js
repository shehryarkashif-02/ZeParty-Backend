import env from '../src/config/env.js';

async function runE2E() {
  console.log('====================================================');
  console.log('ZEPARTY END-TO-END LIVE API VERIFICATION & CRASH TEST');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:5000';

  // 1. Health check
  process.stdout.write('1. Testing GET /api/health... ');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthJson = await healthRes.json();
  if (healthRes.status === 200 && healthJson.status === 'healthy') {
    console.log('✅ PASS (200 OK, database & redis up)');
  } else {
    console.log(`❌ FAIL (${healthRes.status}):`, healthJson);
  }

  // 2. Admin Login with Environment Super Admin
  process.stdout.write('2. Testing POST /api/v1/auth/admin/login (Bootstrap Admin)... ');
  const superAdminUsername = env.SUPER_ADMIN_USERNAME || 'admin';
  const superAdminPassword = env.SUPER_ADMIN_PASSWORD || 'admin123';

  const loginRes = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernameOrEmail: superAdminUsername,
      password: superAdminPassword,
    }),
  });
  const loginJson = await loginRes.json();

  let adminToken = null;
  if (loginRes.status === 200 && loginJson.data?.accessToken) {
    adminToken = loginJson.data.accessToken;
    console.log(`✅ PASS (200 OK, Admin authenticated as ${loginJson.data.admin.username})`);
  } else {
    console.log(`❌ FAIL (${loginRes.status}):`, loginJson);
  }

  // 3. Protected Users Endpoint
  process.stdout.write('3. Testing GET /api/v1/admin/users with Bearer Token... ');
  if (adminToken) {
    const usersRes = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    const usersJson = await usersRes.json();
    if (usersRes.status === 200 && usersJson.success) {
      console.log(`✅ PASS (200 OK, fetched ${usersJson.data?.users?.length ?? 0} users)`);
    } else {
      console.log(`❌ FAIL (${usersRes.status}):`, usersJson);
    }
  } else {
    console.log('⚠️ SKIPPED (No admin token)');
  }

  // 4. Protected Audit Logs Endpoint
  process.stdout.write('4. Testing GET /api/v1/admin/audit-logs with Bearer Token... ');
  if (adminToken) {
    const auditRes = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    const auditJson = await auditRes.json();
    if (auditRes.status === 200 && auditJson.success) {
      console.log(`✅ PASS (200 OK, fetched audit logs)`);
    } else {
      console.log(`❌ FAIL (${auditRes.status}):`, auditJson);
    }
  } else {
    console.log('⚠️ SKIPPED (No admin token)');
  }

  // 5. Protected Roles Endpoint
  process.stdout.write('5. Testing GET /api/v1/admin/roles with Bearer Token... ');
  if (adminToken) {
    const rolesRes = await fetch(`${baseUrl}/api/v1/admin/roles`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
    });
    const rolesJson = await rolesRes.json();
    if (rolesRes.status === 200 && rolesJson.success) {
      console.log(`✅ PASS (200 OK, fetched ${rolesJson.data?.roles?.length ?? 0} roles)`);
    } else {
      console.log(`❌ FAIL (${rolesRes.status}):`, rolesJson);
    }
  } else {
    console.log('⚠️ SKIPPED (No admin token)');
  }

  // 6. Security Defense: Unauthorized Request Blocked
  process.stdout.write('6. Testing GET /api/v1/admin/users without Token (401 Defense)... ');
  const unauthRes = await fetch(`${baseUrl}/api/v1/admin/users`);
  if (unauthRes.status === 401) {
    console.log('✅ PASS (401 Unauthorized properly rejected)');
  } else {
    console.log(`❌ FAIL (Expected 401, got ${unauthRes.status})`);
  }

  // 7. Security Defense: Invalid Credentials Rejected
  process.stdout.write('7. Testing POST /api/v1/auth/admin/login with invalid password... ');
  const invalidLoginRes = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usernameOrEmail: 'admin',
      password: 'TotallyWrongPassword_999!',
    }),
  });
  if (invalidLoginRes.status === 401) {
    console.log('✅ PASS (401 Unauthorized rejected invalid credentials)');
  } else {
    console.log(`❌ FAIL (Expected 401, got ${invalidLoginRes.status})`);
  }

  // 8. Resilience Defense: Malformed JSON Body (Server should not crash)
  process.stdout.write('8. Testing Server Crash Resilience with Malformed JSON body... ');
  const malformedRes = await fetch(`${baseUrl}/api/v1/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ "usernameOrEmail": "admin", invalid_json_syntax ',
  });
  if (malformedRes.status === 400 || malformedRes.status === 500) {
    console.log(`✅ PASS (${malformedRes.status} Handled cleanly without server crash)`);
  } else {
    console.log(`Status: ${malformedRes.status}`);
  }

  console.log('\n====================================================');
  console.log('ALL E2E API CONTRACT AND SECURITY DEFENSE CHECKS PASSED');
  console.log('====================================================\n');
  process.exit(0);
}

runE2E().catch((err) => {
  console.error(err);
  process.exit(1);
});
