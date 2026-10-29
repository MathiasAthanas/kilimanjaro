-- Adds this week's school days (Mon 26 to Thu 29 Oct 2026) to every learner's attendance so "this week" views are not empty.
-- Mix: ~92% present, ~4% late, ~4% absent. Local QA database only. Safe to re-run (existing rows are kept).
insert into students."AttendanceRecord" (id, "schoolId", "studentId", "classId", "termId", date, status, "markedById", note)
select gen_random_uuid()::text, last."schoolId", last."studentId", last."classId", last."termId", d.day,
       case when h % 100 < 4 then 'ABSENT' when h % 100 < 8 then 'LATE' else 'PRESENT' end::students."AttendanceStatus",
       last."markedById",
       case when h % 100 < 4 then 'Reported sick' when h % 100 < 8 then 'Arrived after assembly' end
from (
  select distinct on ("studentId") "schoolId", "studentId", "classId", "termId", "markedById"
  from students."AttendanceRecord" order by "studentId", date desc
) last
cross join (values (date '2026-10-26'), (date '2026-10-27'), (date '2026-10-28'), (date '2026-10-29')) d(day)
cross join lateral (select abs(hashtext(last."studentId" || d.day::text)) as h) x
where not exists (select 1 from students."AttendanceRecord" a where a."studentId" = last."studentId" and a.date = d.day and a."classId" = last."classId");

select date, status, count(*) from students."AttendanceRecord" where date >= '2026-10-26' group by 1, 2 order by 1, 2;
