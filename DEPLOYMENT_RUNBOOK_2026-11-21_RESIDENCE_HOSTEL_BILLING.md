# Release runbook: in campus / off campus, hostel (matron and patron), fees and invoices

Prepared 2026-11-21. Built and tested locally only. Nothing here has been deployed or pushed.

## What this release contains

| Area | What users get |
|---|---|
| Admissions | In campus (Boarding) or Off campus (Day Scholar) chosen as two large cards on New Inquiry, Applicant 360, conversion and direct enrolment. Required at conversion and enrolment. The admin can create **Admissions Officer** accounts (the role was missing from the Create User form). |
| Residence | A guided **Change residence** action on the student profile (now, or from next term), a full change history, a class-by-class classification screen (`/residence`) with bulk classify for existing students, and a scheduled change that applies itself when the next term starts. |
| Hostel | Matron and Patron landing page ("Today"): tasks, a **waiting for a dormitory** list with one-tap or multi-select placement (next free bed is picked automatically), roll call where everyone starts present, a simpler leave and returns page. Admin creates a dormitory, its beds and its matron in one form. Beds are freed automatically when a boarder becomes a day scholar or leaves the school. |
| Fees | Prices are set per **class level** (Class 1, Form 2), never per stream. Boarding and Day prices can sit side by side for the same level. Residence-aware matching and controlled recalculation (from the earlier work) are kept. |
| Payment info | Per school bank or mobile-money accounts printed on every invoice. Finance, Head of Finance, Principal, Head of School, Manager and administrators can change them, every change is audited. |
| Invoice look | Per school logo, accent colour, note, signature, stamp, signatory name. New invoice layout matching the sample (fees table with paid and balance, payment plan, payment info, totals, note, signature and stamp). Sample preview button. |
| Payment plans | Plan templates (percentage, fixed amount or "the rest", due on a date or N days after the invoice, other fees grouped into one payment). Each invoice keeps its own copy, payments fill the earliest due instalment first, custom schedule per invoice with a reason, re-split when a discount or recalculation changes the total. |
| Invoice generation fix | Generating invoices for a class used to stop at the first 100 students (the student list answers 100 per page). It now reads every page: a class of 227 students gets 227 invoices (checked locally). |
| Residence policy | Per school setting: a mid-term change applies from next term, from this term, or asks each time. |

## Database changes (all additive)

Prisma migrations are not recorded in production (it has no `_prisma_migrations`), so apply the SQL by hand, in this order, **once each**.

1. auth: `20261119080000_add_matron_patron_roles`
2. students: `20261118090000_add_student_residence_type`
3. students: `20261119081000_add_hostel_operations`
4. students: `20261121090000_residence_change_history`
5. finance: `20261119090000_add_residence_fee_recalculation` (changed in this release, see below)
6. finance: `20261121100000_payment_accounts_branding_plans`

Before step 2 and 3, check they have not been applied: `\dT students."ResidenceType"` and `\dt students."Dormitory"` must both say "Did not find". Migrations 2 and 3 are not re-runnable.

### The finance unique index (step 5)

Migration 5 adds one live price per target. Production could already hold two active prices for the same target, which would make the index fail. The migration now **switches off the older duplicate** (never deletes, so invoice lines stay valid) and keeps the newest. The uniqueness applies to active prices only.

Check first and write down what will be switched off:

```sql
SELECT "schoolId","feeCategoryId","classId","educationStage","classLevel","studentGroup","residenceType","academicYearId","termId", count(*)
FROM finance."FeeStructure" WHERE "isActive"
GROUP BY 1,2,3,4,5,6,7,8,9 HAVING count(*) > 1;
```

## Deployment order

1. Backups, one ssh session, **before** sourcing any service `.env`: `pg_dump -Fc` of the database (or the `auth`, `students`, `finance` schemas). Record the restore command.
2. Apply the six SQL files with `psql -v ON_ERROR_STOP=1 -f <file>` as the database owner. Run steps 1 to 4 and 6 before step 5 if you want the duplicate report from the query above to be empty on purpose.
3. In a **separate** ssh session (sourcing `.env` exports `NODE_ENV=production`, then `npm ci` skips the dev tools), deploy the code and for **auth, student, finance and api-gateway**: `npx prisma generate`, `npm run build`. Stop each service before building on Windows-like file locking; on the server a normal restart is enough.
4. Build the dashboard (`npm run build` in `dashboard`) and publish `dist`.
5. Restart `ks-auth-service`, `ks-student-service`, `ks-finance-service`, `ks-api-gateway`. Confirm RabbitMQ is up (residence changes tell finance to flag invoices for review through the `student.residence.changed` event; invoice resend uses `invoice.generated`).
6. After the finance deploy run `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` from the finance service folder. The only differences allowed are old `schoolId` index drops that already existed before this release.
7. Make sure `PDF_STORAGE_PATH` is writable by the service user (logo, signature and stamp files are stored under `branding/<schoolId>/`).

## First-day setup (finance and admin)

1. Finance, **Payment Info**: add the real bank and mobile-money accounts for each school.
2. Finance, **Invoice Look**: upload the logo, signature and stamp, pick the colour, write the note, choose the residence-change policy. Press **Preview invoice**.
3. Finance, **Payment Plans**: create the plans (tuition in instalments). Use "Apply plans" for open invoices of the current term that have none.
4. Admissions or admin, **In / Off Campus**: classify the existing students class by class **before generating the next invoices**. Unclassified students only receive prices that are not tied to a residence.
5. Admin: create dormitories (name, beds, matron or patron) and the Matron, Patron and Admissions Officer accounts.

## Verification (after deploy)

- Admin login, open a student profile, see "Where the student stays".
- `/residence` shows the unclassified count; classify one class.
- Admissions: New Inquiry shows the two cards; convert an applicant without choosing, it must be refused.
- Create a dormitory with beds and staff; log in as the matron; the boarders appear under "Waiting for a dormitory"; place one.
- Roll call, leave, return for that student.
- Change the student to off campus: the bed is free again and the history shows it.
- Finance: Payment Info lists the accounts; Preview invoice opens a one-page PDF with them; generate invoices for a class; open one, see the payment plan; download its PDF.
- As a Finance officer: `/residence` is readable but classifying is refused.

## Rollback

Application rollback is enough. The new columns and tables are ignored by the previous version. Do not drop enum values, tables or the unique index once live data exists. If a duplicate price was switched off by migration 5 and must come back, set `"isActive" = true` for that row only after deactivating the other one.

## Tests run locally

- student-service: 34 jest tests pass (includes the new residence tests: same-type refusal, next-term scheduling, bed release, away-on-leave guard, bulk classify, scheduled apply).
- finance-service: 26 jest tests pass (includes payment plan maths, based on the sample invoice: 25/10/15/35/15 percent of tuition becomes 1,185,000 / 474,000 / 711,000 / 1,659,000 / 711,000).
- dashboard: 209 vitest tests, `tsc -b`, production build.
- End-to-end API walk-through (47 checks) against the local stack: classification, queue, dorm create and place, release on change, history, bulk, admin creates Admissions Officer and Matron, payment accounts, branding upload, plans, invoice with plan, discount re-split, custom schedule, boarding price offered after a move to boarding, PDFs, role limits.
- Screens driven in the browser as admin, matron and admissions officer.

## Known limits

- Nothing was run against production data. The local database has no RabbitMQ, so the event that flags invoices for review after a residence change, and the "Notify parent" delivery, were tested up to the point where the event is published, not through the notification service.
- Mobile apps were not changed.
