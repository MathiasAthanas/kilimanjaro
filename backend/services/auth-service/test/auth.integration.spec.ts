
const BASE_URL = process.env.API_BASE ?? "http://localhost:3000/api/v1";

async function getToken(email: string, password: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 429) continue;
    if (!res.ok) throw new Error(`Login ${res.status} for ${email}`);
    const body = await res.json() as Record<string, Record<string, string>>;
    const token = body?.data?.accessToken ?? (body as unknown as Record<string, string>)?.accessToken;
    if (!token) throw new Error(`No token for ${email}: ${JSON.stringify(body)}`);
    return token;
  }
  throw new Error("Rate limited");
}

async function apiGet(token: string, path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, data: await res.json() };
}

async function apiPost(token: string, path: string, body: unknown) {
  const h: Record<string,string> = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}

async function apiPatch(token: string, path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}


describe("Auth API Integration", () => {
  let adminToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    adminToken   = await getToken("admin@demo.kilimanjaro.test", "Admin@Kili2026");
    await new Promise(r => setTimeout(r, 900));
    teacherToken = await getToken("t-maths-a@demo.kilimanjaro.test", "Teacher@Kili2026");
  }, 25000);

  it("admin token is a valid JWT", () => {
    expect(adminToken?.split(".").length).toBe(3);
  });

  it("Invalid password returns 401", async () => {
    const { status } = await apiPost("", "/auth/login", { email: "admin@demo.kilimanjaro.test", password: "WrongPassword@999" });
    expect(status).toBe(401);
  }, 10000);

  it("Unknown email returns 401", async () => {
    const { status } = await apiPost("", "/auth/login", { email: "nobody@x.test", password: "WrongPassword@999" });
    expect(status).toBe(401);
  }, 10000);

  it("GET /auth/me returns the logged-in user", async () => {
    const { status, data } = await apiGet(adminToken, "/auth/me");
    expect(status).toBe(200);
    const user = (data as Record<string, Record<string, string>>).data ?? data;
    expect(user).toHaveProperty("email", "admin@demo.kilimanjaro.test");
  }, 10000);

  it("GET /auth/me returns 401 with bad token", async () => {
    const { status } = await apiGet("bad.token.here", "/auth/me");
    expect(status).toBe(401);
  }, 10000);

  it("Admin can list users", async () => {
    const { status, data } = await apiGet(adminToken, "/auth/users");
    expect(status).toBe(200);
    expect((data as Record<string, boolean>).success).toBe(true);
  }, 10000);

  it("Teacher cannot list users (403)", async () => {
    const { status } = await apiGet(teacherToken, "/auth/users");
    expect(status).toBe(403);
  }, 10000);

  it("All 6 demo roles can login", async () => {
    const creds = [
      ["principal@demo.kilimanjaro.test", "Principal@Kili2026"],
      ["aqa@demo.kilimanjaro.test", "Aqa@Kili2026"],
      ["finance@demo.kilimanjaro.test", "Finance@Kili2026"],
      ["hod-science@demo.kilimanjaro.test", "Hod@Kili2026"],
    ];
    for (const [e, p] of creds) {
      await new Promise(r => setTimeout(r, 600));
      const tok = await getToken(e, p);
      expect(tok.split(".").length).toBe(3);
    }
  }, 30000);
});
