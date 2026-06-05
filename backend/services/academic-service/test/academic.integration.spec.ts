
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


describe("Academic API Integration", () => {
  let tt: string; let ht: string; let pt: string; let at: string;

  beforeAll(async () => {
    tt = await getToken("t-maths-a@demo.kilimanjaro.test", "Teacher@Kili2026");
    await new Promise(r => setTimeout(r, 800));
    ht = await getToken("hod-science@demo.kilimanjaro.test", "Hod@Kili2026");
    await new Promise(r => setTimeout(r, 800));
    pt = await getToken("principal@demo.kilimanjaro.test", "Principal@Kili2026");
    await new Promise(r => setTimeout(r, 800));
    at = await getToken("aqa@demo.kilimanjaro.test", "Aqa@Kili2026");
  }, 30000);

  // Teacher
  it("Teacher dashboard accessible",              async () => { expect((await apiGet(tt, "/teacher/dashboard")).status).toBe(200); }, 10000);
  it("Class subjects non-empty",                  async () => { const { status, data } = await apiGet(tt, "/academics/class-subjects"); expect(status).toBe(200); expect(((data as Record<string,unknown[]>).data).length).toBeGreaterThan(0); }, 10000);
  it("Assessments list accessible",               async () => { expect((await apiGet(tt, "/academics/assessments")).status).toBe(200); }, 10000);
  it("Timetables accessible",                     async () => { expect((await apiGet(tt, "/academics/timetables")).status).toBe(200); }, 10000);
  it("Syllabus accessible",                       async () => { expect((await apiGet(tt, "/academics/syllabus")).status).toBe(200); }, 10000);
  it("Analytics reports accessible to teacher",   async () => { expect((await apiGet(tt, "/analytics/reports")).status).toBe(200); }, 10000);
  it("Teacher can generate CLASS_ACADEMIC report", async () => { const { status } = await apiPost(tt, "/analytics/reports/generate", { reportType: "CLASS_ACADEMIC", scope: "school" }); expect([200,201]).toContain(status); }, 10000);
  it("Performance alerts accessible to teacher",  async () => { expect((await apiGet(tt, "/academics/performance/alerts")).status).toBe(200); }, 10000);
  it("Pairings accessible to teacher",            async () => { expect((await apiGet(tt, "/academics/performance/pairings")).status).toBe(200); }, 10000);

  // HOD
  it("HOD dashboard accessible",                  async () => { expect((await apiGet(ht, "/hod/dashboard")).status).toBe(200); }, 10000);
  it("HOD pending approvals list",                async () => { expect((await apiGet(ht, "/academics/assessments/pending-approval")).status).toBe(200); }, 10000);
  it("HOD approval history accessible",           async () => { expect((await apiGet(ht, "/hod/approvals/history")).status).toBe(200); }, 10000);
  it("Department overview accessible to HOD",     async () => { expect((await apiGet(ht, "/analytics/department/overview")).status).toBe(200); }, 10000);
  it("HOD can generate TEACHER_PERFORMANCE report", async () => { const { status } = await apiPost(ht, "/analytics/reports/generate", { reportType: "TEACHER_PERFORMANCE", scope: "school" }); expect([200,201]).toContain(status); }, 10000);

  // AQA
  it("AQA dashboard accessible",                  async () => { expect((await apiGet(at, "/aqa/dashboard")).status).toBe(200); }, 10000);
  it("AQA heatmap accessible",                    async () => { expect((await apiGet(at, "/aqa/analytics/heatmap")).status).toBe(200); }, 10000);
  it("AQA audit log accessible",                  async () => { expect((await apiGet(at, "/aqa/audit")).status).toBe(200); }, 10000);
  it("Engine config accessible to AQA",           async () => { expect((await apiGet(at, "/academics/performance/engine/config")).status).toBe(200); }, 10000);
  it("AQA academic overview accessible",          async () => { expect((await apiGet(at, "/analytics/academic/overview")).status).toBe(200); }, 10000);

  // Principal
  it("Principal dashboard accessible",            async () => { expect((await apiGet(pt, "/principal/dashboard")).status).toBe(200); }, 10000);
  it("Principal payment approvals accessible",    async () => { expect((await apiGet(pt, "/finance/payments/pending-approval")).status).toBe(200); }, 10000);
  it("Results accessible to principal",           async () => { expect((await apiGet(pt, "/academics/results")).status).toBe(200); }, 10000);
  it("Principal can generate SCHOOL_OVERVIEW report", async () => { const { status } = await apiPost(pt, "/analytics/reports/generate", { reportType: "SCHOOL_OVERVIEW", scope: "school" }); expect([200,201]).toContain(status); }, 10000);

  // Access control
  it("Teacher cannot approve marks (403 or 404)", async () => { const { status } = await apiPatch(tt, "/academics/assessments/fake-id/approve", {}); expect([403,404]).toContain(status); }, 10000);
  it("HOD cannot publish results (403)",          async () => { const { status } = await apiPost(ht, "/academics/results/publish", { classIds: [] }); expect(status).toBe(403); }, 10000);
});
