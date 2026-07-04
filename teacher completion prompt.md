# Teacher Dashboard Remaining Work Prompt

You are working in the Kilimanjaro Schools repo at:

`C:\Users\MICROSPACE\Desktop\kilimanjaro`

Only handle the remaining Teacher dashboard gaps listed here. Do not redo completed work unless a remaining item requires it. Preserve existing user changes and do not run destructive git commands.

## Current Verified Status

These checks were run locally on May 26, 2026:

```powershell
Invoke-RestMethod http://localhost:3000/health
Set-Location dashboard
npx vite build
npx vitest run src/features/teacher
```

Results:

- Local backend health returned `status: ok`.
- `npx vite build` passed.
- Teacher tests passed: 2 files, 26 tests.
- Teacher smoke tests now cover route rendering with mocked hooks.
- Teacher exports no longer use fake `setTimeout`; they call `useGenerateReportMutation()` and `downloadReportWhenReady()`.
- Teacher announcements no longer showed the old `fallbackAnnouncements` hit in the latest scan.

Important: these checks prove Vite bundling and mocked route smoke coverage. They do **not** prove all Teacher actions persist against the real backend.

## Remaining Work Only

### 1. Fix Full Dashboard TypeScript Build

`npm run build` still fails because `tsc -b` reports errors. Some are outside Teacher, but Teacher still has alert typing errors in:

- `dashboard/src/features/teacher/pages/TeacherPages.tsx`

Known Teacher errors are around casts from `usePerformanceAlerts()` to `Alert[]`. The normalized hook rows do not fully match the `Alert` type because fields such as `studentId`, `reason`, and `action` may be missing.

Fix this properly by either:

- updating the `usePerformanceAlerts()` normalizer to always return the full `Alert` shape, or
- adjusting the UI type to match the real response and rendering safely.

Then rerun:

```powershell
Set-Location dashboard
npm run build
```

Do not claim this is complete until the full command passes, or until non-Teacher failures are clearly separated and documented.

### 2. Remove Remaining Static Teacher Mock Dependency

`TeacherPages.tsx` still imports static data from:

```ts
dashboard/src/features/teacher/api/teacherApi.ts
```

Current import includes:

- `assessments`
- `alerts`
- `marksRows`
- `pairings`
- `students`
- `teacherClasses`
- `timetable`

Most usage appears to be for `typeof` casts, but this keeps the page coupled to mock data. Replace these with explicit frontend types from `teacher.types.ts` or locally declared normalized types.

Goal:

- `TeacherPages.tsx` should not import static arrays from `teacherApi.ts`.
- Static mock arrays should not be used for runtime fallbacks.
- Missing live data should show loading, empty, or error states.

Verify with:

```powershell
rg -n "from '../api/teacherApi'|teacherClasses|assessments|marksRows|alerts|pairings|students|timetable" dashboard/src/features/teacher/pages/TeacherPages.tsx
```

### 3. Prove Real API Persistence For Teacher Actions

The existing Teacher tests use mocked hooks. Add real verification or focused integration evidence for these actions:

- marks bulk save: `POST /academics/assessments/:id/marks/bulk`
- assessment submit: `POST /academics/assessments/:id/submit`
- attendance submit: `POST /students/attendance`
- alert resolve: `PATCH /students/performance/alerts/:id/resolve`
- intervention create: `POST /academics/interventions`
- announcement create: `POST /notifications/announcements`
- export generation/download: `POST /analytics/reports/generate`, poll/download via report endpoints

For each action, verify:

- payload matches backend DTO,
- success changes backend state,
- a follow-up GET proves the change,
- UI invalidates/refetches the right query,
- failure shows a real error.

If direct gateway requests need auth, use the browser session or test the underlying service with appropriate local headers. Do not fake success with only a toast.

### 4. Complete Teacher E-Learning Integration

Teacher e-learning still has user-visible mock wording and toast-only actions.

Files to inspect:

- `dashboard/src/features/elearning/components/ElearningShell.tsx`
- `dashboard/src/features/elearning/pages/ElearningPages.tsx`
- `dashboard/src/features/elearning/api/elearning.hooks.ts`

Known remaining issues:

- `ElearningShell.tsx` still says e-learning is prepared with mock data until backend integration is approved.
- Some Teacher e-learning actions are still toast-only, including assignment publish, quiz publish, announcement draft/publish, and possibly grading/publishing actions.

Required fix:

- Remove user-visible mock/backend-waiting wording.
- Wire actions to real e-learning service endpoints where they exist.
- If an endpoint is missing, implement it or disable/remove the action with a real explanation in code, not user-facing implementation text.
- Verify course, lesson, material, assignment, quiz, submission grading, engagement, and communication routes render and persist where actions exist.

### 5. Clean Encoding Artifacts In Teacher UI

Teacher UI still has mojibake/encoding artifacts such as:

- `â€”`
- `â€¦`
- `â†‘`
- `Â·`

Clean user-visible strings in:

- `dashboard/src/features/teacher/pages/TeacherPages.tsx`
- `dashboard/src/features/teacher/components/TeacherWorkspaceShell.tsx`
- any Teacher e-learning pages touched for this work

Keep edits ASCII unless the file already clearly uses correct Unicode and the character is intentional. Prefer plain `-`, `...`, and simple words.

### 6. Strengthen Tests Beyond Smoke Coverage

Existing Teacher tests now pass but are not enough for completion:

- `dashboard/src/features/teacher/utils/marks.test.ts`
- `dashboard/src/features/teacher/pages/TeacherPages.smoke.test.tsx`

Add focused tests for the remaining risk areas:

- alert normalizer returns full safe fields,
- pages do not use static mock fallbacks when live data is empty,
- export button calls report generation/download flow,
- marks submit and attendance submit call the expected mutation with correct payload,
- e-learning publish actions call real mutation hooks after wiring.

Run:

```powershell
Set-Location dashboard
npx vitest run src/features/teacher
npx vitest run src/features/elearning
```

## Verification Commands

Use these after changes:

```powershell
Invoke-RestMethod http://localhost:3000/health
Set-Location dashboard
npx vite build
npx vitest run src/features/teacher
npm run build
```

If backend service code changes, build and restart only affected services:

```powershell
Set-Location backend/services/academic-service
npm run build
pm2 restart ks-academic-service
```

```powershell
Set-Location backend/services/student-service
npm run build
pm2 restart ks-student-service
```

```powershell
Set-Location backend/services/elearning-service
npm run build
pm2 restart ks-elearning-service
```

## Final Deliverable

Report only:

- which remaining items were fixed,
- files changed,
- commands run and results,
- any remaining blocker with exact file/endpoint and reason.

Do not claim Teacher is fully complete unless:

- `npx vite build` passes,
- `npx vitest run src/features/teacher` passes,
- full `npm run build` either passes or non-Teacher failures are explicitly isolated,
- Teacher runtime no longer depends on static mock data,
- real Teacher actions have persistence/readback proof,
- Teacher e-learning no longer has mock/toast-only critical workflows.
