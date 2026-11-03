const BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
async function login(email, password) {
  // Students sign in with their registration number (KS-...), everyone else with an email.
  const body = /^KS-[A-Z]-\d{4}-\d+$/.test(email) ? { registrationNumber: email, password } : { email, password };
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  const d = j.data ?? j;
  if (!d.accessToken) throw new Error('login failed ' + email + ' ' + JSON.stringify(j).slice(0, 300));
  return { token: d.accessToken, user: d.user, raw: d };
}
// The dev gateway allows ~60 requests a minute per user. E2E_CALL_DELAY_MS (e.g. 1100) keeps a long script under it.
const DELAY = Number(process.env.E2E_CALL_DELAY_MS || 0);
async function call(token, method, path, body, extraHeaders = {}) {
  if (DELAY > 0) await new Promise((r) => setTimeout(r, DELAY));
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j, data: j && j.data !== undefined ? j.data : j };
}
module.exports = { login, call, BASE };
