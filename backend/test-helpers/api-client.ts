const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';

export async function getToken(email: string, password: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`Login ${res.status} for ${email}`);
    const body = await res.json() as Record<string, Record<string, string>>;
    const token = body?.data?.accessToken ?? (body as Record<string, string>)?.accessToken;
    if (!token) throw new Error(`No token for ${email}`);
    return token;
  }
  throw new Error(`Rate limited — ${email}`);
}

export async function apiGet(token: string, path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, data: await res.json() };
}

export async function apiPost(token: string, path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

export async function apiPatch(token: string, path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
