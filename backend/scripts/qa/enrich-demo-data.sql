-- Adds realistic everyday school content on top of seed-production-demo.js so every screen has
-- something to show: announcements, per-user notifications, discipline records, store stock and expenses.
-- Local QA database only (kilimanjaro_qa). Safe to re-run: it removes what it added first (marker 'QA-ENRICH').
begin;

delete from notifications."Announcement" where "authorId" = 'QA-ENRICH';
delete from notifications."Notification" where "sourceService" = 'qa-enrich';
delete from students."DisciplineRecord" where "reportedById" = 'QA-ENRICH';
delete from finance."Expense" where "recordedById" = 'QA-ENRICH';
delete from finance."StoreItem" where "createdById" = 'QA-ENRICH';

-- ── Announcements (school-wide, role-targeted, urgent, scheduled, expired) ─────────────────────
insert into notifications."Announcement" (id, title, body, status, priority, "targetRoles", channels, "authorId", "authorRole", "publishedAt", "expiresAt", "createdAt", "updatedAt")
select gen_random_uuid()::text, a.title, a.body, a.status::notifications."AnnouncementStatus", a.priority::notifications."AnnouncementPriority",
       a.roles, array['IN_APP','PUSH']::notifications."NotificationChannel"[], 'QA-ENRICH', 'HEAD_OF_SCHOOL',
       now() - (a.days_ago || ' days')::interval, case when a.expires_in is null then null else now() + (a.expires_in || ' days')::interval end,
       now() - (a.days_ago || ' days')::interval, now()
from (values
 ('Term 3 opening day',              'Classes resume on Monday at 7:30am. Learners must report in full uniform with their books and stationery lists. Boarders may arrive from Sunday 2pm.', 'PUBLISHED','HIGH',   array['STUDENT','PARENT','TEACHER'], 2, 30),
 ('Parents meeting this Saturday',   'All parents are invited to the termly meeting on Saturday at 9:00am in the main hall. We will review last term''s results and the fee plan. Light refreshments will be served.', 'PUBLISHED','URGENT', array['PARENT'], 1, 6),
 ('School fees reminder',            'Kindly clear the outstanding balance on your child''s invoice before the due date. Pay by mobile money or bank transfer using the registration number as the reference, then keep the receipt.', 'PUBLISHED','HIGH', array['PARENT','STUDENT'], 3, 20),
 ('Mid-term examinations timetable', 'Mid-term examinations start next Monday. The full timetable is on the class notice boards and in the Timetable section. Learners should arrive 20 minutes early.', 'PUBLISHED','HIGH', array['STUDENT','PARENT','TEACHER','HEAD_OF_DEPARTMENT'], 4, 14),
 ('Marks submission deadline',       'Teachers must submit all mid-term marks for HOD review by Friday 4pm. Late submissions delay the publication of results to parents.', 'PUBLISHED','URGENT', array['TEACHER','HEAD_OF_DEPARTMENT'], 1, 5),
 ('Inter-house sports day',          'Sports day is on the 14th. Learners should wear their house colours. Parents are welcome to attend and cheer from the main field from 9am.', 'PUBLISHED','NORMAL', array['STUDENT','PARENT','TEACHER'], 6, 18),
 ('Science fair registration open',  'Learners in Forms 1 to 4 can register science fair projects with their subject teacher until the end of the month. Winners represent the school at the regional fair.', 'PUBLISHED','NORMAL', array['STUDENT','TEACHER','HEAD_OF_DEPARTMENT'], 7, 25),
 ('Library new arrivals',            'More than 200 new textbooks and storybooks have arrived in the library. Borrowing hours are 10am to 4pm on school days.', 'PUBLISHED','LOW', array['STUDENT','TEACHER'], 9, 40),
 ('Health and hygiene week',         'A nurse from the district clinic will visit classes this week to talk about handwashing, nutrition and first aid. Please make sure your child eats breakfast before school.', 'PUBLISHED','NORMAL', array['STUDENT','PARENT'], 5, 10),
 ('Staff professional development',  'All teachers: the e-learning training session is on Thursday after lessons in the ICT lab. Bring your laptop or tablet.', 'PUBLISHED','NORMAL', array['TEACHER','HEAD_OF_DEPARTMENT'], 3, 8),
 ('Road safety notice',              'Drivers and parents are asked to drop children at the gate and not on the main road. The school bus will use the new pick-up point near the market from Monday.', 'PUBLISHED','HIGH', array['PARENT','STUDENT'], 8, 21),
 ('Uniform shop open',               'The uniform shop is open every Wednesday from 2pm to 5pm. Sizes for new learners are limited, please come early.', 'PUBLISHED','LOW', array['PARENT'], 10, 60),
 ('Holiday revision programme',      'Optional revision classes for Forms 4 and 6 will run during the holiday. Register with your class teacher. The fee is TZS 30,000 per subject.', 'PUBLISHED','NORMAL', array['STUDENT','PARENT'], 12, 45),
 ('Lost and found',                  'A number of jackets, water bottles and exercise books are at the administration office. Please collect them before Friday.', 'PUBLISHED','LOW', array['STUDENT','PARENT'], 11, 7),
 ('Previous term results published', 'Term 2 results are now available in the app. Parents can view each subject, the class position and the teacher''s comments under Report Cards.', 'PUBLISHED','HIGH', array['PARENT','STUDENT'], 14, null),
 ('Draft: end of year trip',         'We are planning an educational trip to the national park. Details to follow.', 'DRAFT','NORMAL', array['PARENT','STUDENT'], 0, null)
) as a(title, body, status, priority, roles, days_ago, expires_in);

-- ── Notifications for the demo accounts used on the phone ───────────────────────────────────────
-- Helper: (email, role, event, subject, body, minutes_ago, read)
create temp table _n(email text, role text, event text, subject text, body text, mins int, is_read boolean) on commit drop;
insert into _n values
 ('student001@demo.kilimanjaro.test','STUDENT','RESULTS_PUBLISHED','Term results published','Your Term 2 results are ready. Tap to see your subjects and class position.',90,false),
 ('student001@demo.kilimanjaro.test','STUDENT','ASSIGNMENT_DUE','Assignment due tomorrow','Mathematics: Quadratic equations worksheet is due tomorrow at 4pm.',240,false),
 ('student001@demo.kilimanjaro.test','STUDENT','QUIZ_AVAILABLE','New quiz available','Chemistry: Atoms and the periodic table quiz is open until Friday.',600,false),
 ('student001@demo.kilimanjaro.test','STUDENT','ATTENDANCE_MARKED','Attendance recorded','You were marked present today.',1500,true),
 ('student001@demo.kilimanjaro.test','STUDENT','ASSIGNMENT_GRADED','Assignment graded','English: Essay on environmental care was graded. Tap to read the feedback.',2900,true),
 ('student001@demo.kilimanjaro.test','STUDENT','FEE_REMINDER','Fee balance reminder','Your fee balance is due on the date shown on your invoice.',4300,true),
 ('student001@demo.kilimanjaro.test','STUDENT','ANNOUNCEMENT','Sports day','Inter-house sports day is on the 14th. Wear your house colours.',7000,true),
 ('parent001@demo.kilimanjaro.test','PARENT','RESULTS_PUBLISHED','Term results published','Term 2 results are available for your children.',60,false),
 ('parent001@demo.kilimanjaro.test','PARENT','PAYMENT_CONFIRMED','Payment received','We received your payment and issued a receipt. Thank you.',300,false),
 ('parent001@demo.kilimanjaro.test','PARENT','FEE_REMINDER','Fee balance reminder','A balance remains on an open invoice. Please pay before the due date.',1200,false),
 ('parent001@demo.kilimanjaro.test','PARENT','PERFORMANCE_ALERT','Performance alert','One of your children may need extra support in Mathematics this term.',2000,true),
 ('parent001@demo.kilimanjaro.test','PARENT','ATTENDANCE_ABSENT','Absence recorded','Your child was marked absent today. Please contact the class teacher if this is unexpected.',3000,true),
 ('parent001@demo.kilimanjaro.test','PARENT','ANNOUNCEMENT','Parents meeting this Saturday','All parents are invited at 9am in the main hall.',5000,true),
 ('t-maths-a@demo.kilimanjaro.test','TEACHER','MARKS_RETURNED','Marks returned for correction','The HOD returned the Form 2 mid-term marks. Please review the comment and resubmit.',45,false),
 ('t-maths-a@demo.kilimanjaro.test','TEACHER','SUBMISSIONS_RECEIVED','New submissions to grade','12 learners submitted the quadratic equations assignment.',200,false),
 ('t-maths-a@demo.kilimanjaro.test','TEACHER','PERFORMANCE_ALERT','Learner needs support','Three learners in your class are below the pass mark in Mathematics.',900,false),
 ('t-maths-a@demo.kilimanjaro.test','TEACHER','ANNOUNCEMENT','Marks submission deadline','Submit all mid-term marks by Friday 4pm.',1800,true),
 ('hod-science@demo.kilimanjaro.test','HEAD_OF_DEPARTMENT','MARKS_SUBMITTED','Marks waiting for review','Chemistry Form 3 mid-term marks were submitted for your approval.',30,false),
 ('hod-science@demo.kilimanjaro.test','HEAD_OF_DEPARTMENT','PERFORMANCE_ALERT','Critical alerts in your department','Five learners are flagged in Physics. Review and escalate if needed.',420,false),
 ('hod-science@demo.kilimanjaro.test','HEAD_OF_DEPARTMENT','SYLLABUS_BEHIND','Syllabus behind schedule','Biology Form 2 coverage is 12% behind the plan.',2400,true),
 ('hos-primary@demo.kilimanjaro.test','HEAD_OF_SCHOOL','MARKS_READY','Mark sheets ready for final approval','Mark sheets approved by heads of department are waiting for you.',20,false),
 ('hos-primary@demo.kilimanjaro.test','HEAD_OF_SCHOOL','PAYMENT_APPROVAL','Payment needs approval','A manual payment was recorded by the finance office.',150,false),
 ('hos-primary@demo.kilimanjaro.test','HEAD_OF_SCHOOL','DISCIPLINE','Discipline case opened','A moderate misconduct case was recorded for Standard 5.',1500,true),
 ('principal@demo.kilimanjaro.test','MANAGER','PAYMENT_APPROVAL','Payment needs approval','A manual payment was recorded by the finance office.',100,false),
 ('finance@demo.kilimanjaro.test','FINANCE','PAYMENT_APPROVED','Payment approved','A bank transfer was approved and a receipt was issued.',240,false),
 ('finance@demo.kilimanjaro.test','FINANCE','FUND_REQUEST','Fund request needs review','A new request from the Science department awaits finance review.',600,false);
insert into notifications."Notification" (id, "recipientId", channel, "eventType", status, "createdAt", body, "deliveredAt", "isRead", "readAt", "recipientRole", "sourceService", subject, "updatedAt")
select gen_random_uuid()::text, u.id, 'IN_APP', n.event, 'DELIVERED', now() - (n.mins || ' minutes')::interval, n.body,
       now() - (n.mins || ' minutes')::interval, n.is_read, case when n.is_read then now() - ((n.mins - 5) || ' minutes')::interval end,
       n.role, 'qa-enrich', n.subject, now()
from _n n join auth.users u on u.email = n.email;

-- ── Discipline (a spread of categories, severities, open and resolved) ────────────────────────────
insert into students."DisciplineRecord" (id, "studentId", category, severity, "incidentDate", "actionTaken", "resolvedAt", description, "reportedById", "requiresParentNotification", "resolutionNote")
select gen_random_uuid()::text, s.id, d.cat::students."DisciplineCategory", d.sev::students."DisciplineSeverity",
       now() - (d.days || ' days')::interval, d.action,
       case when d.resolved then now() - ((d.days - 2) || ' days')::interval end, d.descr, 'QA-ENRICH', d.notify,
       case when d.resolved then 'Discussed with the learner and parent. Agreement signed and behaviour has improved.' end
from (select id, row_number() over (order by "registrationNumber") rn from students."Student") s
join (values
 (3,'MISCONDUCT','MINOR','Verbal warning','Talking repeatedly during a lesson after two reminders.',true,false,5),
 (11,'ABSENTEEISM','MODERATE','Parent called','Missed three school days without notice.',true,true,12),
 (19,'DISRESPECT','MODERATE','Detention','Answered the teacher rudely in front of the class.',false,true,8),
 (27,'CHEATING','SEVERE','Test voided, parent meeting','Found copying answers during the mathematics test.',false,true,15),
 (35,'PROPERTY_DAMAGE','MODERATE','Cost of repair paid','Broke a classroom window while playing ball indoors.',true,true,20),
 (44,'BULLYING','SEVERE','Counselling and suspension 2 days','Repeatedly teased a younger learner about his clothes.',false,true,4),
 (52,'MISCONDUCT','MINOR','Cleaning duty','Late to class four times this week.',true,false,9),
 (61,'OTHER','MINOR','Counselling','Seen withdrawn and not eating at lunch, referred to the school counsellor.',false,true,3)
) as d(rn, cat, sev, action, descr, resolved, notify, days) on d.rn = s.rn;

-- ── Store (stock the finance office tracks) ──────────────────────────────────────────────────────
insert into finance."StoreItem" (id, "schoolId", "itemCode", name, category, unit, description, "quantityOnHand", "reorderLevel", "unitCost", currency, location, "isActive", "createdById", "updatedAt")
select gen_random_uuid()::text, '00000000-0000-4000-8000-000000000002', 'QA-ST-' || lpad(i::text,3,'0'), x.name, x.cat::finance."StoreCategory", x.unit, x.descr, x.qty, x.reorder, x.cost, 'TZS', x.loc, true, 'QA-ENRICH', now()
from (values
 (1,'Maize flour (50kg bag)','FOOD','bag','Kitchen staple',14,10,95000,'Kitchen store'),
 (2,'Rice (50kg bag)','FOOD','bag','Kitchen staple',6,8,140000,'Kitchen store'),
 (3,'Cooking oil (20L)','FOOD','jerrycan','Kitchen',4,5,92000,'Kitchen store'),
 (4,'Exercise books (96 pages)','STATIONERY','dozen','For learners',120,40,18000,'Admin store'),
 (5,'Chalk (box of 100)','STATIONERY','box','Classrooms',30,12,6500,'Admin store'),
 (6,'Printer paper A4 (ream)','STATIONERY','ream','Office',22,10,12500,'Admin store'),
 (7,'Liquid soap (5L)','CLEANING','jerrycan','Hygiene',9,6,15000,'Cleaning store'),
 (8,'Disinfectant (5L)','CLEANING','jerrycan','Hygiene',3,6,21000,'Cleaning store'),
 (9,'First aid kit','MEDICAL','kit','Clinic',5,3,45000,'Clinic'),
 (10,'Paracetamol (pack of 100)','MEDICAL','pack','Clinic',2,4,8500,'Clinic'),
 (11,'Science lab beakers (set)','LABORATORY','set','Chemistry lab',18,6,38000,'Science lab'),
 (12,'Football (size 5)','SPORTS','piece','Sports store',11,4,32000,'Sports store'),
 (13,'Light bulbs (LED)','MAINTENANCE','piece','Maintenance',40,20,4500,'Maintenance store'),
 (14,'School shirts (assorted)','UNIFORM','piece','Uniform shop',85,30,14000,'Uniform shop')
) as x(i,name,cat,unit,descr,qty,reorder,cost,loc);

-- ── Expenses across a few months ─────────────────────────────────────────────────────────────────
insert into finance."Expense" (id, "schoolId", "expenseNumber", category, description, amount, currency, payee, "paymentMethod", reference, "incurredAt", department, status, "recordedById", "recordedByName", "recordedByRole", "updatedAt")
select gen_random_uuid()::text, '00000000-0000-4000-8000-000000000002', 'QA-EXP-' || lpad(i::text,3,'0'), x.cat::finance."ExpenseCategory", x.descr, x.amount, 'TZS', x.payee,
       x.method::finance."PaymentMethod", x.ref, now() - (x.days || ' days')::interval, x.dept, 'RECORDED', 'QA-ENRICH', 'Bursar Mtei', 'FINANCE', now()
from (values
 (1,'UTILITIES','Electricity bill for the month',1250000,'TANESCO','BANK_TRANSFER','TAN-882310',3,'Administration'),
 (2,'UTILITIES','Water bill',380000,'Kilimanjaro Water Authority','MOBILE_MONEY','MPESA-77120',5,'Administration'),
 (3,'FOOD','Vegetables and fruit for the kitchen',640000,'Mtei Market Traders','CASH','VCH-1042',2,'Kitchen'),
 (4,'FOOD','Meat for the week',910000,'Moshi Butchery','CASH','VCH-1043',6,'Kitchen'),
 (5,'SUPPLIES','Cleaning materials',210000,'Safi Supplies','CASH','VCH-1044',9,'Administration'),
 (6,'MAINTENANCE','Repair of two classroom doors',480000,'Mzee Ally Carpentry','CASH','VCH-1045',12,'Maintenance'),
 (7,'TRANSPORT','School bus fuel',720000,'Lake Oil','MOBILE_MONEY','MPESA-77488',4,'Transport'),
 (8,'ACADEMIC','Chemistry practical chemicals',560000,'EduLab Tanzania','BANK_TRANSFER','TAN-882511',15,'Science'),
 (9,'EXAMINATION','Printing of mid-term examination papers',330000,'Print Hub','CASH','VCH-1046',7,'Examinations'),
 (10,'SPORTS','Sports day trophies and medals',275000,'Champion Sports','CASH','VCH-1047',10,'Sports'),
 (11,'ADMINISTRATIVE','Internet subscription',150000,'Zuku Fibre','BANK_TRANSFER','TAN-882600',1,'Administration'),
 (12,'SALARY','Part-time cooks (weekly wages)',420000,'Kitchen staff','CASH','PAY-W07',1,'Kitchen'),
 (13,'MAINTENANCE','Generator service',260000,'Power Fix','CASH','VCH-1048',18,'Maintenance'),
 (14,'OTHER','First aid refill',95000,'City Pharmacy','CASH','VCH-1049',13,'Clinic')
) as x(i,cat,descr,amount,payee,method,ref,days,dept);

commit;
select 'announcements' what, count(*) from notifications."Announcement" where "authorId"='QA-ENRICH'
union all select 'notifications', count(*) from notifications."Notification" where "sourceService"='qa-enrich'
union all select 'discipline', count(*) from students."DisciplineRecord" where "reportedById"='QA-ENRICH'
union all select 'store items', count(*) from finance."StoreItem" where "createdById"='QA-ENRICH'
union all select 'expenses', count(*) from finance."Expense" where "recordedById"='QA-ENRICH';
