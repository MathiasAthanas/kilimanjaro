-- Report cards that follow the term results: average, grade, failing subjects and class rank per term, plus a Term 1 card
-- for every learner who has a Term 2 card. Run after enrich-term-history.sql. Local QA database only. Safe to re-run.
begin;

delete from academics."ReportCard" where "termId" = 'ad43c783-9ec2-4d7e-8fe6-3f323eb61f03';

insert into academics."ReportCard" (id, "schoolId", "studentId", "classId", "termId", "academicYearId", "overallAverage", "overallGrade", "overallPoints",
  "overallRemark", rank, "totalStudentsInClass", "subjectCount", "failingSubjectCount", "teacherComment", "principalComment", "divisionSummary",
  "reportTemplateCode", "classLevel", "behaviourGrade", "socialSkillsGrade", "extraCurricularNote", "readingAbility", "writingAbility", "numeracyAbility",
  "isPublished", "publishedAt", "createdAt", "combinationId", "educationStage", "publishedById", "updatedAt")
select gen_random_uuid()::text, rc."schoolId", rc."studentId", rc."classId", 'ad43c783-9ec2-4d7e-8fe6-3f323eb61f03', rc."academicYearId", 0, 'F', 0,
       '', null, null, 0, 0,
       case when (abs(hashtext(rc."studentId")) % 3) = 0 then 'Keeps a positive attitude and takes part well in class activities.'
            when (abs(hashtext(rc."studentId")) % 3) = 1 then 'Works steadily but should revise more often at home.'
            else 'Shows good effort. More practice in the weaker subjects will lift the results.' end,
       'Keep working hard. We expect more next term.', null, rc."reportTemplateCode", rc."classLevel", rc."behaviourGrade", rc."socialSkillsGrade",
       rc."extraCurricularNote", rc."readingAbility", rc."writingAbility", rc."numeracyAbility", true, '2026-05-06 09:00', '2026-05-06 09:00',
       rc."combinationId", rc."educationStage", rc."publishedById", now()
from academics."ReportCard" rc where rc."termId" = 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c';

-- Average, grade, subject counts from each learner's term results
update academics."ReportCard" rc
set "overallAverage" = round(a.avg::numeric, 1), "subjectCount" = a.n, "failingSubjectCount" = a.failing,
    "overallGrade" = case when a.avg >= 75 then 'A' when a.avg >= 65 then 'B' when a.avg >= 50 then 'C' when a.avg >= 40 then 'D' else 'E' end,
    "overallPoints" = case when a.avg >= 75 then 1 when a.avg >= 65 then 2 when a.avg >= 50 then 3 when a.avg >= 40 then 4 else 5 end,
    "overallRemark" = case when a.avg >= 75 then 'Excellent' when a.avg >= 65 then 'Very good' when a.avg >= 55 then 'Good'
                           when a.avg >= 50 then 'Satisfactory' when a.avg >= 40 then 'Needs support' else 'Needs urgent support' end
from (select "studentId", "termId", avg("weightedTotal") avg, count(*) n, count(*) filter (where not "isPassing") failing
      from academics."TermResult" group by 1, 2) a
where a."studentId" = rc."studentId" and a."termId" = rc."termId";

-- Class rank from the average
update academics."ReportCard" rc
set rank = r.rk, "totalStudentsInClass" = r.n
from (select id, rank() over (partition by "classId", "termId" order by "overallAverage" desc) rk,
             count(*) over (partition by "classId", "termId") n
      from academics."ReportCard") r
where r.id = rc.id;

commit;
select "termId", count(*) cards, count(distinct rank) ranks, round(avg("overallAverage")::numeric,1) avg from academics."ReportCard" group by 1;
