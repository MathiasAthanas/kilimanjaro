-- Residence classification is deliberately nullable. Existing students and
-- applicants must be reviewed rather than guessed during migration.
CREATE TYPE students."ResidenceType" AS ENUM ('BOARDING', 'DAY_SCHOLAR');

ALTER TABLE students."Student"
ADD COLUMN "residenceType" students."ResidenceType";

ALTER TABLE students."Applicant"
ADD COLUMN "residenceType" students."ResidenceType";

CREATE INDEX "Student_schoolId_residenceType_idx"
ON students."Student"("schoolId", "residenceType");

CREATE INDEX "Applicant_schoolId_residenceType_idx"
ON students."Applicant"("schoolId", "residenceType");
