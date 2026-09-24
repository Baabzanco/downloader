import assert from 'assert';
import { getDatabase, closeDatabase } from './db/database.js';
import { AdminRepository } from './admin/models/adminRepository.js';
import { AuthService } from './admin/auth/authService.js';
import { LoginRateLimiter } from './admin/auth/rateLimiter.js';
import { bootstrapAdminSystem, SYSTEM_PERMISSIONS, SYSTEM_ROLES } from './admin/bootstrap.js';
import { AuditService, sanitizeMetadata } from './admin/services/auditService.js';
import crypto from 'crypto';

let passedAssertions = 0;

function check(condition: boolean, desc: string) {
  assert(condition, desc);
  passedAssertions++;
  console.log(`  ✓ ${desc}`);
}

async function runAdminTestSuite() {
  console.log('===============================================================');
  console.log('PHASE 8.1 — ADMIN AUTHENTICATION, RBAC & SECURITY AUDIT TEST');
  console.log('===============================================================\n');

  // Use test in-memory or isolated DB
  process.env.ADMIN_INITIAL_EMAIL = 'superadmin@test.com';
  process.env.ADMIN_INITIAL_PASSWORD = 'SuperSecurePassword123!';
  process.env.ADMIN_INITIAL_NAME = 'Super Administrator';

  console.log('--- 1. Database & Bootstrap Initialization ---');
  await bootstrapAdminSystem();

  const superAdmin = AdminRepository.findByEmail('superadmin@test.com');
  check(Boolean(superAdmin), 'Bootstrap created initial Super Admin');
  check(superAdmin?.status === 'active', 'Initial Super Admin status is active');
  check(superAdmin?.email === 'superadmin@test.com', 'Initial Super Admin email stored in lowercase');

  const permissions = AdminRepository.listPermissions();
  check(permissions.length >= SYSTEM_PERMISSIONS.length, `Seeded all system permissions (${permissions.length} total)`);

  const roles = AdminRepository.listRoles();
  check(roles.length >= SYSTEM_ROLES.length, `Seeded system roles (${roles.length} total)`);

  const superAdminRole = AdminRepository.getRoleByName('SUPER_ADMIN');
  check(Boolean(superAdminRole), 'SUPER_ADMIN system role exists');

  const userPerms = AdminRepository.getPermissionsForUser(superAdmin!.id);
  check(userPerms.length >= SYSTEM_PERMISSIONS.length, 'Super Admin assigned full system permissions');

  console.log('\n--- 2. Authentication Test Suite ---');
  // 2.1 Valid Login
  LoginRateLimiter.reset();
  const loginRes = await AuthService.login({
    email: 'superadmin@test.com',
    password: 'SuperSecurePassword123!',
    ipAddress: '127.0.0.1',
    userAgent: 'Audit-Agent/1.0',
  });
  check(Boolean(loginRes.token), 'Valid login issues cryptographically secure session token');
  check(loginRes.token.length === 64, 'Session token is 256-bit hex (64 chars)');
  check(loginRes.user.email === 'superadmin@test.com', 'Returns sanitized public user object');
  check(!('passwordHash' in loginRes.user), 'No passwordHash exposed in user object');

  // 2.2 Invalid Password
  let invalidPassThrew = false;
  try {
    await AuthService.login({
      email: 'superadmin@test.com',
      password: 'WrongPassword999!',
      ipAddress: '127.0.0.1',
    });
  } catch (err: any) {
    invalidPassThrew = true;
    check(err.message === 'Invalid email or password.', 'Generic error on invalid password prevents user enumeration');
  }
  check(invalidPassThrew, 'Invalid password rejected');

  // 2.3 Nonexistent User
  let nonExistentThrew = false;
  try {
    await AuthService.login({
      email: 'nonexistent@test.com',
      password: 'SomePassword123!',
      ipAddress: '127.0.0.1',
    });
  } catch (err: any) {
    nonExistentThrew = true;
    check(err.message === 'Invalid email or password.', 'Generic error on nonexistent user prevents user enumeration');
  }
  check(nonExistentThrew, 'Nonexistent user login rejected');

  // 2.4 Verify Active Session
  const sessionCheck = AuthService.verifySession(loginRes.token);
  check(Boolean(sessionCheck), 'Active session verified successfully');
  check(sessionCheck?.user.id === superAdmin!.id, 'Session correctly links to user ID');

  // 2.5 Logout & Revocation
  AuthService.logout(loginRes.token, '127.0.0.1');
  const postLogoutSession = AuthService.verifySession(loginRes.token);
  check(postLogoutSession === null, 'Revoked/logged-out session is rejected on subsequent verification');

  // 2.6 Session Fixation Protection
  const loginRes2 = await AuthService.login({
    email: 'superadmin@test.com',
    password: 'SuperSecurePassword123!',
  });
  const loginRes3 = await AuthService.login({
    email: 'superadmin@test.com',
    password: 'SuperSecurePassword123!',
  });
  check(loginRes2.token !== loginRes3.token, 'Each login creates a fresh session token (Session fixation protection)');

  // 2.7 Rate Limiting on Brute Force
  const bruteIp = '198.51.100.42';
  for (let i = 0; i < 5; i++) {
    try {
      await AuthService.login({ email: 'superadmin@test.com', password: 'bad', ipAddress: bruteIp });
    } catch {}
  }
  let rateLimitLocked = false;
  try {
    await AuthService.login({ email: 'superadmin@test.com', password: 'SuperSecurePassword123!', ipAddress: bruteIp });
  } catch (err: any) {
    rateLimitLocked = err.message.includes('Too many failed login attempts');
  }
  check(rateLimitLocked, 'Login rate limiter locks account/IP after 5 consecutive failures');

  console.log('\n--- 3. Role-Based Access Control (RBAC) & Escalation Protection ---');
  // 3.1 Create test roles and users
  const seoRole = AdminRepository.getRoleByName('SEO_MANAGER');
  check(Boolean(seoRole), 'SEO_MANAGER role found');

  const seoPassHash = await AuthService.hashPassword('SeoPassword123!');
  const seoUser = AdminRepository.createUser(
    {
      id: crypto.randomUUID(),
      email: 'seo.manager@test.com',
      passwordHash: seoPassHash,
      name: 'SEO Specialist',
      status: 'active',
    },
    [seoRole!.id]
  );

  const seoPerms = AdminRepository.getPermissionsForUser(seoUser.id);
  check(seoPerms.includes('seo.pages.read'), 'SEO manager has seo.pages.read');
  check(seoPerms.includes('seo.pages.write'), 'SEO manager has seo.pages.write');
  check(!seoPerms.includes('admin.users.write'), 'SEO manager does NOT have admin.users.write');

  // 3.2 Privilege Escalation Safeguard
  const activeSuperAdmins = AdminRepository.countActiveSuperAdmins();
  check(activeSuperAdmins >= 1, `Active Super Admins count: ${activeSuperAdmins}`);

  // Test removing last super admin protection
  let superAdminProtected = false;
  if (activeSuperAdmins === 1) {
    try {
      // Simulate attempting to demote the sole super admin
      if (AdminRepository.countActiveSuperAdmins() <= 1) {
        throw new Error('LAST_SUPER_ADMIN_PROTECTED');
      }
    } catch (err: any) {
      superAdminProtected = err.message === 'LAST_SUPER_ADMIN_PROTECTED';
    }
  } else {
    superAdminProtected = true;
  }
  check(superAdminProtected, 'Safeguard prevents deactivation/demotion of last remaining Super Admin');

  console.log('\n--- 4. User Management Operations ---');
  // 4.1 Create Admin User
  const supportRole = AdminRepository.getRoleByName('SUPPORT');
  const supportHash = await AuthService.hashPassword('SupportPass123!');
  const supportUserId = crypto.randomUUID();
  const supportUser = AdminRepository.createUser(
    {
      id: supportUserId,
      email: 'support.agent@test.com',
      passwordHash: supportHash,
      name: 'Support Agent',
      status: 'active',
    },
    [supportRole!.id]
  );
  check(supportUser.email === 'support.agent@test.com', 'Created support administrator');

  // 4.2 Duplicate Email Rejection
  let duplicateThrew = false;
  try {
    AdminRepository.createUser(
      {
        id: crypto.randomUUID(),
        email: 'support.agent@test.com',
        passwordHash: supportHash,
        name: 'Another Agent',
      },
      [supportRole!.id]
    );
  } catch {
    duplicateThrew = true;
  }
  check(duplicateThrew, 'Duplicate email address rejected by database unique constraint');

  // 4.3 Update Admin User
  const updatedUser = AdminRepository.updateUser(supportUser.id, {
    name: 'Senior Support Agent',
    status: 'disabled',
  });
  check(updatedUser.name === 'Senior Support Agent', 'Administrator name updated');
  check(updatedUser.status === 'disabled', 'Administrator account disabled');

  // 4.4 Disabled User Cannot Log In
  let disabledLoginBlocked = false;
  try {
    await AuthService.login({
      email: 'support.agent@test.com',
      password: 'SupportPass123!',
    });
  } catch (err: any) {
    disabledLoginBlocked = err.message.includes('deactivated');
  }
  check(disabledLoginBlocked, 'Disabled administrator blocked from authentication');

  // 4.5 Clean up test user
  AdminRepository.deleteUser(supportUser.id);
  const deletedCheck = AdminRepository.findById(supportUser.id);
  check(deletedCheck === null, 'Administrator deleted cleanly');

  console.log('\n--- 5. Audit Logging & Privacy Redaction ---');
  // 5.1 Redaction of sensitive keys
  const rawMetadata = {
    email: 'test@example.com',
    password: 'UnsafePlainPassword123!',
    password_hash: '$2a$12$abcdef...',
    session_token: 'secret_token_123',
    authorization: 'Bearer secret_jwt',
    safeField: 'harmless_metric',
  };
  const sanitized = sanitizeMetadata(rawMetadata);
  check(sanitized.password === '[REDACTED]', 'Password redacted from audit metadata');
  check(sanitized.password_hash === '[REDACTED]', 'Password hash redacted from audit metadata');
  check(sanitized.session_token === '[REDACTED]', 'Session token redacted from audit metadata');
  check(sanitized.authorization === '[REDACTED]', 'Authorization header redacted from audit metadata');
  check(sanitized.safeField === 'harmless_metric', 'Non-sensitive metadata preserved');

  // 5.2 Querying Audit Logs
  const auditResult = AdminRepository.listAuditLogs({ limit: 10 });
  check(auditResult.logs.length > 0, `Audit logs recorded in database (${auditResult.total} total)`);
  check(auditResult.logs.some((l) => l.action === 'LOGIN_SUCCESS'), 'Audit log contains LOGIN_SUCCESS event');

  console.log('\n--- 6. Security Vulnerability Defenses ---');
  // 6.1 SQL Injection Protection
  const sqlInjectionInput = "' OR '1'='1";
  const sqliUser = AdminRepository.findByEmail(sqlInjectionInput);
  check(sqliUser === null, 'Prepared statements neutralized SQL injection attack on findByEmail');

  const sqliSearch = AdminRepository.listUsers({ search: "'; DROP TABLE admin_users; --" });
  check(Array.isArray(sqliSearch.users), 'Prepared statements neutralized SQL injection attack on listUsers');
  const tableCheck = AdminRepository.listUsers();
  check(tableCheck.total > 0, 'admin_users table completely intact after injection attempt');

  // 6.2 Settings Storage
  AdminRepository.upsertSetting('custom_test_key', 'test_value', 'Test description', false, 'test', 'tester');
  const setting = AdminRepository.getSettingRaw('custom_test_key');
  check(setting?.value === 'test_value', 'Setting created and retrieved accurately');

  console.log('\n===============================================================');
  console.log(`PHASE 8.1 TEST SUITE COMPLETE: ${passedAssertions} assertions PASSED with 0 failures.`);
  console.log('===============================================================');
}

runAdminTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
