-- Gives every learner a Term 1 result history (so trends, term lists and parent comparisons have something to show)
-- and recomputes class ranks for both terms from the marks. Local QA database only. Safe to re-run.
begin;

delete from academics."TermResult" where "termId" = 'ad43c783-9ec2-4d7e-8fe6-3f323eb61f03';

insert into academics."TermResult" (id, "schoolId", "studentId", "classSubjectId", "subjectId", "subjectName", "termId", "academicYearId",
  "weightedTotal", grade, "gradePoints", "isPassing", rank, "totalStudentsInClass", "isPublished", "assessmentScores", "classId", "classLevel",
  "combinationId", "educationStage", "publishedAt", "publishedById", remark, "teacherId", "createdAt", "updatedAt")
select gen_random_uuid()::text, t."schoolId", t."studentId", t."classSubjectId", t."subjectId", t."subjectName",
       'ad43c783-9ec2-4d7e-8fe6-3f323eb61f03', t."academicYearId", w.score,
       g.grade, g.points, w.score >= 50, null, t."totalStudentsInClass", true,
       jsonb_build_object('CAT1', round((w.score - 4)::numeric), 'FINAL', round((w.score + 2)::numeric)),
       t."classId", t."classLevel", t."combinationId", t."educationStage", '2026-05-06 09:00', t."publishedById",
       g.remark, t."teacherId", '2026-05-06 09:00', now()
from academics."TermResult" t
cross join lateral (
  select case
    when s.registrationNumber = 'KS-P-2026-00001' and t."subjectName" = 'Mathematics' then 28::float8
    when s.registrationNumber = 'KS-P-2026-00001' and t."subjectName" = 'English' then 66
    when s.registrationNumber = 'KS-P-2026-00001' and t."subjectName" = 'Kiswahili' then 78
    when s.registrationNumber = 'KS-P-2026-00001' and t."subjectName" = 'Science' then 63
    when s.registrationNumber = 'KS-P-2026-00001' and t."subjectName" = 'Social Studies' then 57
    else greatest(12, least(97, round((t."weightedTotal" - ((abs(hashtext(t."studentId" || t."subjectId")) % 13) - 5))::numeric, 1)::float8))
  end as score
  from (select "registrationNumber" as registrationNumber from students."Student" where id = t."studentId") s
) w
cross join lateral (
  select case when w.score >= 75 then 'A' when w.score >= 65 then 'B' when w.score >= 50 then 'C' when w.score >= 40 then 'D' else 'E' end as grade,
         case when w.score >= 75 then 1 when w.score >= 65 then 2 when w.score >= 50 then 3 when w.score >= 40 then 4 else 5 end as points,
         case when w.score >= 75 then 'Excellent' when w.score >= 65 then 'Very good' when w.score >= 55 then 'Good' when w.score >= 50 then 'Satisfactory'
              when w.score >= 40 then 'Needs support' else 'Needs urgent support' end as remark
) g
where t."termId" = 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c';

-- Ranks from the marks, per class subject and term (ties share a rank)
update academics."TermResult" t
set rank = r.rk, "totalStudentsInClass" = r.n
from (
  select id,
         rank() over (partition by "classSubjectId", "termId" order by "weightedTotal" desc) rk,
         count(*) over (partition by "classSubjectId", "termId") n
  from academics."TermResult"
) r
where r.id = t.id;

commit;
select "termId", count(*) rows, count(distinct rank) ranks from academics."TermResult" group by 1;
