-- Renumbers legacy invoices (INV-KS-PRI-2026-<term code>-00083, 60+ characters) to the short form INV + YY + 5 digits
-- (INV2600083, 10 characters) that parents can type into a payment prompt.
--
-- * Only invoices still in the legacy form (invoiceNumber LIKE 'INV-%') are touched; re-running is a no-op.
-- * Oldest first, per calendar year of creation, continuing after whatever the live counter already issued, and the
--   counter is advanced so new invoices never repeat a number.
-- * Every change is listed in finance_invoice_number_changes (old -> new); \copy it out before you close the session.
-- * Payments, receipts and the ledger find an invoice by id, and the invoice screens read the number live, so nothing
--   else needs rewriting. A stored PDF keeps the old number in its file name until it is regenerated.
--
-- Run (as the database owner), after taking a dump of the finance schema:
--   psql "$DATABASE_URL_WITHOUT_SCHEMA_PARAM" -v ON_ERROR_STOP=1 -f backend/scripts/finance-shorten-invoice-numbers.sql
--   \copy finance_invoice_number_changes to 'invoice-number-changes.csv' csv header   (same session, before exit)

BEGIN;

CREATE TEMP TABLE finance_invoice_number_changes (
  "invoiceId" text PRIMARY KEY,
  "oldNumber" text NOT NULL,
  "newNumber" text NOT NULL
) ON COMMIT PRESERVE ROWS;

WITH legacy AS (
  SELECT i.id,
         i."invoiceNumber" AS old_number,
         EXTRACT(YEAR FROM i."createdAt")::int AS yr,
         row_number() OVER (PARTITION BY EXTRACT(YEAR FROM i."createdAt") ORDER BY i."createdAt", i."invoiceNumber") AS rn
  FROM finance."Invoice" i
  WHERE i."invoiceNumber" LIKE 'INV-%'
),
base AS (
  SELECT l.yr, COALESCE(s.value, 0) AS used
  FROM (SELECT DISTINCT yr FROM legacy) l
  LEFT JOIN finance."NumberSequence" s ON s.id = 'INVS:group:' || l.yr
)
INSERT INTO finance_invoice_number_changes ("invoiceId", "oldNumber", "newNumber")
SELECT l.id,
       l.old_number,
       'INV' || lpad((l.yr % 100)::text, 2, '0') || lpad((b.used + l.rn)::text, 5, '0')
FROM legacy l JOIN base b USING (yr);

-- Refuse to continue if a new number is already taken (would break the unique index anyway, but say why).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM finance_invoice_number_changes c
    JOIN finance."Invoice" i ON i."invoiceNumber" = c."newNumber"
  ) THEN
    RAISE EXCEPTION 'A short invoice number is already in use; aborting without changes';
  END IF;
END $$;

UPDATE finance."Invoice" i
SET "invoiceNumber" = c."newNumber"
FROM finance_invoice_number_changes c
WHERE i.id = c."invoiceId";

-- Advance each year's counter to the highest number now issued.
INSERT INTO finance."NumberSequence" (id, year, value, "updatedAt")
SELECT 'INVS:group:' || y.yr, y.yr, y.top, now()
FROM (
  SELECT EXTRACT(YEAR FROM i."createdAt")::int AS yr,
         max(substr(i."invoiceNumber", 6)::int) AS top
  FROM finance."Invoice" i
  WHERE i."invoiceNumber" ~ '^INV[0-9]{7,}$'
  GROUP BY 1
) y
ON CONFLICT (id) DO UPDATE SET value = GREATEST(finance."NumberSequence".value, EXCLUDED.value), "updatedAt" = now();

SELECT count(*) AS invoices_renumbered FROM finance_invoice_number_changes;
SELECT "oldNumber", "newNumber" FROM finance_invoice_number_changes ORDER BY "newNumber" LIMIT 5;

COMMIT;
