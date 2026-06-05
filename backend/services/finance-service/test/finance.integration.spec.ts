
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


describe("Finance API Integration", () => {
  let ft: string; // financeToken

  beforeAll(async () => {
    ft = await getToken("finance@demo.kilimanjaro.test", "Finance@Kili2026");
  }, 15000);

  it("Finance dashboard has overview data",           async () => { const { status, data } = await apiGet(ft, "/finance/dashboard"); expect(status).toBe(200); expect((data as Record<string,Record<string,unknown>>).data).toHaveProperty("overview"); }, 10000);
  it("Invoice list is non-empty",                    async () => { const { status, data } = await apiGet(ft, "/finance/invoices"); expect(status).toBe(200); expect(((data as Record<string,unknown[]>).data).length).toBeGreaterThan(0); }, 10000);
  it("Payment list accessible",                      async () => { const { status } = await apiGet(ft, "/finance/payments"); expect(status).toBe(200); }, 10000);
  it("Pending payment approvals accessible",         async () => { const { status } = await apiGet(ft, "/finance/payments/pending-approval"); expect(status).toBe(200); }, 10000);
  it("Receipt list accessible",                      async () => { const { status } = await apiGet(ft, "/finance/receipts"); expect(status).toBe(200); }, 10000);
  it("Fee categories non-empty",                     async () => { const { status, data } = await apiGet(ft, "/finance/fee-categories"); expect(status).toBe(200); expect(((data as Record<string,unknown[]>).data).length).toBeGreaterThan(0); }, 10000);
  it("Fee structures non-empty",                     async () => { const { status, data } = await apiGet(ft, "/finance/fee-structures"); expect(status).toBe(200); expect(((data as Record<string,unknown[]>).data).length).toBeGreaterThan(0); }, 10000);
  it("Fee assignments accessible",                   async () => { const { status } = await apiGet(ft, "/finance/fee-assignments"); expect(status).toBe(200); }, 10000);
  it("Assets list accessible",                       async () => { const { status } = await apiGet(ft, "/finance/assets"); expect(status).toBe(200); }, 10000);
  it("Audit logs accessible to finance role",        async () => { const { status } = await apiGet(ft, "/finance/audit-logs"); expect(status).toBe(200); }, 10000);
  it("Collection summary report accessible",         async () => { const { status } = await apiGet(ft, "/finance/reports/collection-summary"); expect(status).toBe(200); }, 10000);
  it("Outstanding balances list accessible",         async () => { const { status } = await apiGet(ft, "/finance/reports/outstanding-balances"); expect(status).toBe(200); }, 10000);
  it("Fee defaulters report accessible",             async () => { const { status } = await apiGet(ft, "/finance/reports/fee-defaulters"); expect(status).toBe(200); }, 10000);
  it("Analytics finance overview accessible",        async () => { const { status } = await apiGet(ft, "/analytics/finance/overview"); expect(status).toBe(200); }, 10000);
  it("Finance can generate FINANCE_COLLECTION report", async () => { const { status } = await apiPost(ft, "/analytics/reports/generate", { reportType: "FINANCE_COLLECTION", scope: "school" }); expect([200,201]).toContain(status); }, 10000);
  it("Finance CANNOT access admin audit (403)",      async () => { const { status } = await apiGet(ft, "/admin/audit/system"); expect(status).toBe(403); }, 10000);
});
