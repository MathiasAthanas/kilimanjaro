-- Keeps the performance snapshots (what trends and alerts read) in step with the term results.
-- Run after enrich-term-history.sql; then trigger POST /students/performance/engine/run {"scope":"all"} so slopes and alerts update.
-- Local QA database only. Safe to re-run.
begin;

-- Term 2 snapshots follow the (re-ranked) results
update students."PerformanceSnapshot" s
set score = t."weightedTotal", grade = t.grade, rank = t.rank, "totalStudentsInClass" = t."totalStudentsInClass"
from academics."TermResult" t
where t."studentId" = s."studentId" and t."subjectId" = s."subjectId" and t."termId" = s."termId";

-- Term 1 snapshots (the history the trend is measured against)
delete from students."PerformanceSnapshot" where "termId" = 'ad43c783-9ec2-4d7e-8fe6-3f323eb61f03';
insert into students."PerformanceSnapshot" (id, "studentId", "subjectId", "subjectName", "termId", "academicYearId", score, grade, rank,
  "totalStudentsInClass", "teacherId", "assessmentBreakdown", "classId", "createdAt")
select gen_random_uuid()::text, t."studentId", t."subjectId", t."subjectName", t."termId", t."academicYearId", t."weightedTotal", t.grade, t.rank,
       t."totalStudentsInClass", t."teacherId", t."assessmentScores", t."classId", '2026-05-06 09:00'
from academics."TermResult" t
join students."Student" st on st.id = t."studentId"
join students."Class" c on c.id = t."classId"
where t."termId" = 'ad43c783-9ec2-4d7e-8fe6-3f323eb61f03'
  and exists (select 1 from students."PerformanceSnapshot" cur where cur."studentId" = t."studentId" and cur."subjectId" = t."subjectId"
              and cur."termId" = 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c');

commit;
select "termId", count(*) from students."PerformanceSnapshot" group by 1;
