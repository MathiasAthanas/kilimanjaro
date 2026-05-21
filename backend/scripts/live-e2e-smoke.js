const assert = require('assert');

const gatewayUrl = process.env.E2E_GATEWAY_URL || 'http://localhost:3000';
const allowOffline = process.env.E2E_ALLOW_OFFLINE === 'true';
const credentials = {
  email: process.env.E2E_LOGIN_EMAIL || process.env.LOGIN_EMAIL,
  password: process.env.E2E_LOGIN_PASSWORD || process.env.LOGIN_PASSWORD,
};

const publicChecks = [
  { name: 'gateway health', method: 'GET', path: '/health', statuses: [200] },
];

const authenticatedChecks = [
  { name: 'student health through gateway', method: 'GET', path: '/students/health', statuses: [200] },
  { name: 'academic health through gateway', method: 'GET', path: '/academics/health', statuses: [200] },
  { name: 'finance health through gateway', method: 'GET', path: '/finance/health', statuses: [200] },
  { name: 'notification health through gateway', method: 'GET', path: '/notifications/health', statuses: [200] },
  { name: 'analytics health through gateway', method: 'GET', path: '/analytics/health', statuses: [200] },
];

async function request(check, token) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${gatewayUrl}${check.path}`, {
    method: check.method,
    headers,
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function extractAccessToken(payload) {
  return (
    payload?.accessToken ||
    payload?.access_token ||
    payload?.data?.accessToken ||
    payload?.data?.access_token ||
    payload?.tokens?.accessToken ||
    payload?.data?.tokens?.accessToken
  );
}

async function login() {
  if (!credentials.email || !credentials.password) {
    console.log('Skipping authenticated checks: set E2E_LOGIN_EMAIL and E2E_LOGIN_PASSWORD.');
    return null;
  }

  const response = await fetch(`${gatewayUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(credentials),
  });
  const payload = await response.json().catch(() => null);
  assert(
    response.status >= 200 && response.status < 300,
    `login failed with ${response.status}: ${JSON.stringify(payload)}`,
  );
  const token = extractAccessToken(payload);
  assert(token, `login response did not include an access token: ${JSON.stringify(payload)}`);
  return token;
}

async function runCheck(check, token) {
  const result = await request(check, token);
  assert(
    check.statuses.includes(result.status),
    `${check.name} expected ${check.statuses.join('/')} but got ${result.status}: ${JSON.stringify(result.body)}`,
  );
  console.log(`PASS ${check.name} ${check.method} ${check.path} -> ${result.status}`);
}

async function main() {
  console.log(`Running live E2E smoke checks against ${gatewayUrl}`);
  try {
    for (const check of publicChecks) {
      await runCheck(check);
    }
  } catch (error) {
    if (allowOffline) {
      console.log(`SKIP live E2E smoke checks: ${error.message}`);
      return;
    }
    throw error;
  }

  const token = await login();
  if (!token) return;
  for (const check of authenticatedChecks) {
    await runCheck(check, token);
  }
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
