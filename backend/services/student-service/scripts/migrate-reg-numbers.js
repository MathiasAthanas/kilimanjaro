/**
 * One-time migration: convert all student registration numbers
 * from the old format  KS-{STAGE}-{YYYY}-{NNNNN}
 * to the new format   KEMS-{STAGE}-{YY}{NNN}
 *
 * Stage code map (old → new):
 *   N → N   (Nursery)
 *   U → PU  (Pre-Unit)
 *   P → P   (Primary)
 *   S → O   (O-Level / Secondary)
 *   A → A   (A-Level)
 */

const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

const STAGE_MAP = { N: 'N', U: 'PU', P: 'P', S: 'O', A: 'A' };
const OLD_PATTERN = /^KS-([A-Z]+)-(\d{4})-(\d+)$/;
const LEGACY_PATTERN = /^KS-(\d{4})-(\d+)$/;

function convertRegNumber(old) {
  // Stage-aware format: KS-P-2026-00001
  const m = OLD_PATTERN.exec(old);
  if (m) {
    const oldStage = m[1];
    const year     = m[2];
    const seq      = parseInt(m[3], 10);
    const newStage = STAGE_MAP[oldStage] ?? oldStage;
    const yy       = year.slice(-2);
    const nnn      = String(seq).padStart(3, '0');
    return `KEMS-${newStage}-${yy}${nnn}`;
  }

  // Legacy format: KS-2026-00001
  const lm = LEGACY_PATTERN.exec(old);
  if (lm) {
    const year = lm[1];
    const seq  = parseInt(lm[2], 10);
    const yy   = year.slice(-2);
    const nnn  = String(seq).padStart(3, '0');
    return `KEMS-${yy}${nnn}`;
  }

  // Already in new format or unknown — leave as-is
  return old;
}

async function main() {
  const students = await prisma.student.findMany({
    select: { id: true, registrationNumber: true },
  });

  console.log(`Found ${students.length} students to migrate.`);

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const student of students) {
    const newReg = convertRegNumber(student.registrationNumber);

    if (newReg === student.registrationNumber) {
      skipped++;
      continue;
    }

    try {
      await prisma.student.update({
        where: { id: student.id },
        data:  { registrationNumber: newReg },
      });
      console.log(`  ${student.registrationNumber}  →  ${newReg}`);
      updated++;
    } catch (err) {
      errors.push({ id: student.id, old: student.registrationNumber, new: newReg, err: err.message });
      console.error(`  ERROR ${student.registrationNumber} → ${newReg}: ${err.message}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped (already new): ${skipped}  Errors: ${errors.length}`);

  if (errors.length) {
    console.error('\nFailed records:');
    errors.forEach((e) => console.error(`  ${e.old} → ${e.new}: ${e.err}`));
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
