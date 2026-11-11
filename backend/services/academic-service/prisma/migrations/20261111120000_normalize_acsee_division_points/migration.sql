-- ACSEE divisions always use canonical grade points, independent of editable
-- school grading-scale point values: A=1, B=2, C=3, D=4, E=5, S=6, F=7.
UPDATE academics."GradeBoundary" AS boundary
SET
  points = CASE upper(btrim(boundary.grade))
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
    WHEN 'D' THEN 4
    WHEN 'E' THEN 5
    WHEN 'S' THEN 6
    WHEN 'F' THEN 7
  END,
  "isPassing" = CASE upper(btrim(boundary.grade))
    WHEN 'A' THEN true
    WHEN 'B' THEN true
    WHEN 'C' THEN true
    WHEN 'D' THEN true
    WHEN 'E' THEN true
    WHEN 'S' THEN false
    WHEN 'F' THEN false
  END
FROM academics."GradingScale" AS scale
WHERE boundary."gradingScaleId" = scale.id
  AND scale."educationStage" = 'A_LEVEL'
  AND upper(btrim(boundary.grade)) IN ('A', 'B', 'C', 'D', 'E', 'S', 'F');

-- Keep already-composed A-Level subject results consistent with the corrected
-- grading scales. Window-level divisions are recalculated through the engine.
UPDATE academics."TermResult"
SET
  "gradePoints" = CASE upper(btrim(grade))
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
    WHEN 'D' THEN 4
    WHEN 'E' THEN 5
    WHEN 'S' THEN 6
    WHEN 'F' THEN 7
  END,
  "isPassing" = upper(btrim(grade)) IN ('A', 'B', 'C', 'D', 'E')
WHERE "educationStage" = 'A_LEVEL'
  AND upper(btrim(grade)) IN ('A', 'B', 'C', 'D', 'E', 'S', 'F');
