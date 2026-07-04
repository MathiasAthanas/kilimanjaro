# Principal Portal Completion Prompt

You are working in the Kilimanjaro Schools repo at:

`C:\Users\MICROSPACE\Desktop\kilimanjaro`

Your job is to fully check, complete, integrate, and test every Principal user page and route in the dashboard. Work like a production engineer: inspect the current code first, preserve existing user changes, make scoped fixes, connect real APIs where UI is still mock-only, and prove each route works locally.

## Current Project Context

The backend stack is expected to run locally through PM2. Previous local status was:

- Gateway: `localhost:3000`
- Auth service online
- Student service online
- Academic service online
- Finance service online
- Notification service online
- Analytics service online
- E-learning service online
- Gateway health check: `http://localhost:3000/health`
- Dashboard dev server usually runs at `http://localhost:5173`

Before changing code, verify current status:

```powershell
pm2 status
Invoke-RestMethod http://localhost:3000/health
```

Do not run destructive git commands. Do not revert unrelated dirty files. Use `rg` for searching. Keep edits scoped to Principal pages, hooks, backend endpoints needed by those pages, and shared API/type helpers only where necessary.

## Latest Local Verification Already Run

These checks were run locally on May 25, 2026:

```powershell
Set-Location backend/services/api-gateway
pm2 stop ks-api-gateway
npm run build
pm2 restart ks-api-gateway
pm2 status
```

Result:

- Gateway build passed after stopping `ks-api-gateway`.
- First gateway build attempt failed with `EPERM: operation not permitted, unlink ... query_engine-windows.dll.node` because the running gateway process was holding the Prisma DLL.
- After restart, `ks-api-gateway` was online.

```powershell
Set-Location dashboard
npx vite build
```

Result:

- Passed with no build errors.
- Vite only reported the existing large chunk warning.

```powershell
Set-Location dashboard
npx vitest run src/features/principal
```

Result:

- Passed: `src/features/principal/utils/principalDecision.test.ts`
- 5 tests passed.

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Result:

- Gateway returned `status: ok`.
- Auth, students, academics, finance, notifications, and analytics were reachable.

Important: these checks prove the gateway builds, dashboard bundles, and the existing Principal utility tests pass. They do **not** prove that every Principal page is fully integrated or that every user action persists in the backend. Continue with the functional audit below.

## Known Missing Or Not Fully Proven Items

The Principal portal is **not yet proven perfectly complete**. Re-check after later edits shows some items improved:

- Report-card detail now uses `useSignReportCardMutation()` and posts to `/principal/report-cards/:id/sign`.
- School settings now uses `usePatchSchoolSettingsMutation()` and patches `/principal/settings/school`.
- Detail hooks for assessment, payment approval, and student no longer silently fall back to the first mock record; they return `null` when a requested id is not found.

Static inspection still shows several gaps that must be fixed or verified before calling it done:

1. `dashboard/src/features/principal/pages/PrincipalPages.tsx` still imports mock/static data from `dashboard/src/features/principal/api/principalApi.ts`:
   - `disciplineIncidents`
   - `markRows`
   - `paymentApprovals`
   - `principalAssessments`
   - `principalAudit`
   - `principalStudents`
   - `publishClasses`
   - `schoolHealth`
   - `staffMembers`

2. Some list pages still fall back to mock records if an API response is not an array:
   - results publishing uses `publishClasses` fallback,
   - report card list uses `publishClasses` fallback.
   Replace this with a proper loading/error/empty state so broken API responses are visible.

3. Announcement draft save is still toast-only:
   - `Save Draft` only shows `toast('Draft saved')`.
   If drafts are required, add a real draft endpoint/mutation. If not required, remove the draft action.

4. Reports and exports use `useGenerateReportMutation()` from operations hooks, but still need end-to-end proof:
   - generated job id returned,
   - polling endpoint works,
   - download endpoint returns a real file/blob,
   - failure states are handled.

5. Existing tests only cover `principalDecision` utility behavior. There are no route/page smoke tests proving all Principal pages render without crashing, no mutation tests for Principal actions, and no integration tests verifying backend persistence.

6. Some Principal files contain mojibake/encoding artifacts in comments or text output, for example `Â·`, `â€¦`, `â€”`, and `â”€`. Clean user-visible instances while preserving file behavior.

7. Gateway has some Principal-support routes in `backend/services/api-gateway/src/operations/operations.controller.ts`, including report card signing and mark lock/return routes. Confirm the frontend actually uses the right routes and verify readback/persistence, not only successful mutation toasts.

## Main Question To Answer

Determine exactly what data each Principal page currently uses and whether each page is:

- fully live and integrated,
- partially live with fallback/mock data,
- UI-only/mock-only,
- missing backend/gateway endpoints,
- broken due to payload mismatch,
- broken due to mutation/action not wired,
- visually present but not functionally tested.

Then complete the missing integration and test every Principal route.

## Principal Routes To Audit And Complete

The Principal routes are defined in `dashboard/src/app/router.tsx`. Check and test all of these:

| Route | Component | Expected Data / Behavior |
| --- | --- | --- |
| `/principal` | `PrincipalHomePage` | Executive dashboard, school health, audit decisions, shortcuts, summary metrics. |
| `/principal/approvals` | `MarksFinalApprovalPage` | Pending academic mark approvals waiting for Principal decision. |
| `/principal/approvals/marks/:assessmentId` | `PrincipalMarksReviewPage` | Assessment mark details, student mark rows, approve/reject final action. |
| `/principal/results/publish` | `ResultsPublishingPage` | Class/term result publish readiness, missing items, publish action. |
| `/principal/report-cards` | `ReportCardsManagementPage` | Report-card sign-off queue, missing comments, class/student batches. |
| `/principal/report-cards/:id` | `PrincipalReportCardDetailPage` | Individual report-card preview, Principal comment, sign-off/save action. |
| `/principal/finance` | `FinanceOversightPage` | Finance executive summary, pending payment approvals, balance/risk overview. |
| `/principal/finance/approvals` | `PaymentApprovalsPage` | Pending payment approval list. |
| `/principal/finance/approvals/:id` | `PaymentApprovalDetailPage` | Payment approval details, approve/reject action. |
| `/principal/finance/invoices` | `PrincipalInvoiceManagementPage` | Invoice/student finance overview. |
| `/principal/performance` | `PrincipalPerformanceOverviewPage` | Academic performance analytics and critical student table. |
| `/principal/students` | `PrincipalStudentsPage` | Searchable student list with academic, attendance, finance, discipline data. |
| `/principal/students/:studentId` | `PrincipalStudentProfilePage` | Student profile, academic/finance/discipline details, related actions. |
| `/principal/discipline` | `DisciplineOverviewPage` | Discipline incidents, resolution workflow, communication shortcut. |
| `/principal/staff` | `StaffOverviewPage` | Staff/teacher performance, classes, syllabus, timeliness. |
| `/principal/announcements` | `PrincipalAnnouncementsPage` | Principal announcements list. |
| `/principal/announcements/create` | `CreatePrincipalAnnouncementPage` | Create and publish announcement. |
| `/principal/analytics` | `PrincipalAnalyticsPage` | Executive analytics, board-ready metrics/charts. |
| `/principal/reports` | `PrincipalReportsPage` | Report generation workflow. |
| `/principal/settings/school` | `SchoolSettingsPage` | School settings and grading scale view/save if editable. |
| `/principal/audit` | `PrincipalAuditPage` | Principal decision audit trail. |
| `/principal/exports` | `PrincipalExportsPage` | Executive export center; generated exports should download or produce files. |
| `/principal/elearning` | `PrincipalElearningPage` | Principal e-learning oversight route; verify it is not placeholder-only. |

## Principal Frontend Files To Inspect

Start with:

```powershell
rg -n "Principal|/principal|principalApi|usePrincipal|mock|fallback|pending backend|UI ready|live API|ready for integration" dashboard/src/app dashboard/src/features/principal
```

Important files:

- `dashboard/src/app/router.tsx`
- `dashboard/src/features/principal/pages/PrincipalPages.tsx`
- `dashboard/src/features/principal/components/PrincipalWorkspaceShell.tsx`
- `dashboard/src/features/principal/api/principal.hooks.ts`
- `dashboard/src/features/principal/api/principalApi.ts`
- `dashboard/src/features/principal/api/principalKeys.ts`
- `dashboard/src/features/principal/types/principal.types.ts`
- `dashboard/src/features/principal/utils/principalDecision.ts`
- `dashboard/src/features/principal/utils/principalDecision.test.ts`

There may be a temp file `dashboard/src/features/principal/api/principal.hooks.ts.tmp`. Do not delete it unless you confirm it is unused and the user wants cleanup.

## Current Principal Data Shape

The Principal area currently has typed data like:

- `SchoolHealth`: score, academic, finance, operations, trend.
- `PrincipalAssessment`: assessment approval record with subject, class, teacher, average, alerts, Principal/HOD status.
- `MarkRow`: student mark review row.
- `PublishClass`: class result publish readiness.
- `PrincipalPaymentApproval`: payment approval data.
- `PrincipalStudent`: student academic, attendance, finance, guardian, discipline summary.
- `DisciplineIncident`: conduct/discipline record.
- `StaffMember`: teacher/staff performance summary.
- `PrincipalAuditEvent`: audited Principal decisions.

The frontend currently imports static arrays from `dashboard/src/features/principal/api/principalApi.ts`, including:

- `principalAssessments`
- `paymentApprovals`
- `principalStudents`
- `principalAudit`
- `schoolHealth`
- `disciplineIncidents`
- `staffMembers`

Treat these as suspect. They are useful for development fallback, but the final Principal portal should not depend on static mock data for real pages.

## Current Principal Hook Endpoints

Inspect `dashboard/src/features/principal/api/principal.hooks.ts`. It already calls several live endpoints or intended live endpoints:

- `GET /principal/dashboard`
- `GET /principal/staff`
- `GET /principal/students/:studentId/profile`
- `GET /principal/settings/school`
- `GET /principal/audit`
- `GET /analytics/students`
- `GET /analytics/overview`
- `GET /academics/assessments/pending-approval`
- `GET /academics/assessments/:assessmentId/marks/review`
- `GET /reports/results-publishing/readiness`
- `GET /academics/results/class/:classId/term/:termId`
- `GET /finance/payments/pending-approval`
- `GET /students/discipline`
- `GET /notifications/announcements`

Current mutations include:

- `PATCH /academics/assessments/:id/approve`
- `PATCH /academics/assessments/:id/reject`
- `POST /academics/results/publish`
- `PATCH /finance/payments/approvals/:id/approve`
- `PATCH /finance/payments/approvals/:id/reject`
- `PATCH /students/discipline/:id/resolve`
- `POST /notifications/announcements`

For each endpoint, confirm whether it exists in the gateway/backend service. If the UI endpoint does not exist, either:

1. update the hook to use the correct existing endpoint, or
2. implement the missing endpoint in the right service and route it through the gateway.

Do not leave buttons showing success if the backend action did not persist.

## Completion Requirements

For every Principal route:

1. Identify data source:
   - live API,
   - static mock,
   - static fallback after API failure,
   - local-only computed data,
   - missing.

2. Confirm loading, empty, and error states:
   - no blank crashes,
   - no fake success,
   - no endless spinner,
   - clear retry where useful.

3. Confirm user actions:
   - buttons call real mutations,
   - mutation payload matches backend DTO,
   - success invalidates/refetches relevant queries,
   - failure displays a real error toast/message,
   - backend state changes can be verified through a second GET or direct DB/service response.

4. Remove internal engineering copy from user-visible pages:
   - `Pending backend integration`
   - `UI ready`
   - `awaiting endpoint`
   - `live API`
   - `ready for integration`
   - `Pagination ready`
   - any similar implementation-status labels.

5. Normalize response payloads safely:
   - use existing `payloadOf` and `arrayFromApi` helpers where appropriate,
   - support known API shapes,
   - avoid `crypto.randomUUID()` as a persistent row id fallback where it causes unstable React keys,
   - use real ids from the API whenever possible.

6. Fix duplicate React key warnings if present.

7. Keep Principal UI polished:
   - no congested cards/tables,
   - no clipped text,
   - actions obvious,
   - empty states useful,
   - no development-only wording.

## Backend Work Expectations

If any Principal endpoint is missing, inspect backend services:

```powershell
rg -n "principal|pending-approval|results-publishing|payments/approvals|discipline|announcements|audit|school/settings" backend
```

Likely services:

- Academic service for marks approval, result publishing, grading/report-card data.
- Student service for students, discipline, profiles.
- Finance service for invoices/payment approvals.
- Notification service for announcements.
- Analytics service for dashboard, performance, school health.
- API gateway for route forwarding and auth context.

When adding backend endpoints:

- add DTO validation,
- return consistent response envelopes,
- preserve role/security expectations,
- add useful error messages,
- update gateway routes if required,
- rebuild/restart only the affected PM2 service.

Useful local service test style:

```powershell
Invoke-RestMethod "http://localhost:3000/api/v1/<route>" -Headers @{
  "x-user-id" = "local-principal-test"
  "x-user-role" = "PRINCIPAL"
}
```

If direct gateway calls require frontend auth and return `401`, test the underlying service directly with service port and required headers, then verify the page through the browser session.

## Suggested Route-By-Route Test Checklist

Create and maintain a checklist while working:

| Route | Data Source | Actions Tested | Result |
| --- | --- | --- | --- |
| `/principal` | | | |
| `/principal/approvals` | | | |
| `/principal/approvals/marks/:assessmentId` | | | |
| `/principal/results/publish` | | | |
| `/principal/report-cards` | | | |
| `/principal/report-cards/:id` | | | |
| `/principal/finance` | | | |
| `/principal/finance/approvals` | | | |
| `/principal/finance/approvals/:id` | | | |
| `/principal/finance/invoices` | | | |
| `/principal/performance` | | | |
| `/principal/students` | | | |
| `/principal/students/:studentId` | | | |
| `/principal/discipline` | | | |
| `/principal/staff` | | | |
| `/principal/announcements` | | | |
| `/principal/announcements/create` | | | |
| `/principal/analytics` | | | |
| `/principal/reports` | | | |
| `/principal/settings/school` | | | |
| `/principal/audit` | | | |
| `/principal/exports` | | | |
| `/principal/elearning` | | | |

## Required Verification Commands

Run these after changes:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Frontend build check:

```powershell
Set-Location dashboard
npx vite build
```

Run focused tests if present:

```powershell
Set-Location dashboard
npx vitest run src/features/principal
```

If you edit backend service code, run the relevant service type/build check. Examples:

```powershell
Set-Location backend/services/academic-service
npm run build
```

```powershell
Set-Location backend/services/student-service
npm run build
```

```powershell
Set-Location backend/services/finance-service
npm run build
```

Restart only affected PM2 services:

```powershell
pm2 restart ks-academic-service
pm2 restart ks-student-service
pm2 restart ks-finance-service
pm2 restart ks-notification-service
pm2 restart ks-analytics-service
pm2 restart ks-api-gateway
```

Do not restart everything unless needed.

## Browser/Manual Verification

After build and API checks, open the dashboard and manually verify each route as Principal:

`http://localhost:5173/principal`

For each page:

- route loads without Vite overlay,
- browser console has no page-breaking errors,
- data shown matches API response,
- empty states make sense,
- action buttons are not dead,
- mutations persist and refetch,
- no user-facing implementation-status text remains.

If Playwright or the repo test tooling is available, add or run a smoke test that navigates every Principal route and asserts there is no crash overlay.

## Deliverables

At the end, provide:

1. A concise summary of what Principal data exists on each page.
2. The route-by-route checklist with integration status and test result.
3. Files changed.
4. Backend endpoints added or corrected.
5. Frontend hooks/pages corrected.
6. Commands run and their result.
7. Any remaining blockers, with exact reason and next step.

Do not claim a page is fully integrated unless you verified both frontend rendering and backend persistence/readback for its actions.
