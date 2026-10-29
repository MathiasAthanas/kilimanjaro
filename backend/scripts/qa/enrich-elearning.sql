-- Fills Nursery A's e-learning with a realistic mix: a course for each of the five subjects, lessons with notes and
-- videos, upcoming / overdue / submitted / graded assignments and a quiz per subject. Local QA database only.
-- Safe to re-run: everything it adds has an id starting with 'qa-el-'.
begin;

delete from elearning.submissions where id like 'qa-el-%';
delete from elearning.assignments where id like 'qa-el-%';
delete from elearning.quiz_options where id like 'qa-el-%';
delete from elearning.quiz_questions where id like 'qa-el-%';
delete from elearning.quizzes where id like 'qa-el-%';
delete from elearning.lessons where id like 'qa-el-%';
delete from elearning.course_spaces where id like 'qa-el-%';

do $$
declare
  v_term text := 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c';
  v_year text := '71a7faf9-72b9-44ca-9a47-aa64db0feba5';
  v_math text := '2d07988a-0697-4877-9833-a159514de9b1';
  v_baraka text := '2d2d6289-b974-4d17-8c7c-c3478f7f790a';
  v_students text[];
  v_qs text[][];
  subj record;
  v_cs text; v_l text; v_a text; v_q text; v_qq text; i int; k int; stu text; n int := 0;
begin
  select array_agg("studentId") into v_students from elearning.course_enrollments where "courseSpaceId" = v_math;
  update elearning.course_spaces set "coverEmoji" = '📐', "termName" = 'Term 2', "academicYearName" = '2026' where id = v_math;

  for subj in
    select * from (values
      ('Mathematics',    v_math, '599ce4d5-0616-4a9e-8909-d765ed046b7a', '95e54e3b-8eb3-44e0-ae20-a2b6a87db652', '📐', '#0f766e', 'Numbers, shapes and measuring'),
      ('English',        null,   '81175309-d621-440d-94e5-52384e135a78', '466e6ee0-537b-4a7e-a03a-a3ffe666dae7', '📖', '#7c3aed', 'Reading, phonics and simple writing'),
      ('Kiswahili',      null,   'a2f862b0-bbc1-420d-b61a-94a947001294', '14ee14dc-74c0-4900-8899-2c69f04fee0a', '🗣️', '#b45309', 'Kusoma, kuandika na msamiati'),
      ('Science',        null,   'f6cde2c9-ea38-4acf-a608-bbde05c241c7', 'c1cb23b5-c239-4df0-994d-347d415bb73d', '🔬', '#0369a1', 'Living things, plants and the weather'),
      ('Social Studies', null,   '2fd0fca0-74d9-49f9-8244-8f42e34f165f', 'cc420d73-4145-4194-b74a-6bcb68dff83c', '🌍', '#be123c', 'My family, my school and my community')
    ) as t(subject, existing_id, teacher, class_subject, emoji, color, blurb)
  loop
    n := n + 1;
    if subj.existing_id is null then
      v_cs := 'qa-el-cs-' || n;
      insert into elearning.course_spaces (id, "classSubjectId", "teacherId", "termId", "termName", "academicYearId", "academicYearName", "subjectName", "className",
        "educationStage", "classLevel", description, "coverColor", "coverEmoji", status, "publishedAt", "enrolledCount", "updatedAt")
      select v_cs, subj.class_subject, subj.teacher, v_term, 'Term 2', v_year, '2026', subj.subject, 'Nursery A', "educationStage", "classLevel",
             subj.blurb || '. Weekly lessons, notes, homework and a unit quiz.', subj.color, subj.emoji, 'ACTIVE', now() - interval '40 days', array_length(v_students, 1), now()
      from elearning.course_spaces where id = v_math;
      foreach stu in array v_students loop
        insert into elearning.course_enrollments (id, "courseSpaceId", "studentId", "enrolledAt", "lastActivityAt")
        values ('qa-el-en-' || n || '-' || substr(stu, 1, 8), v_cs, stu, now() - interval '40 days', now() - (random() * interval '5 days'));
      end loop;
    else
      v_cs := subj.existing_id;
    end if;

    -- Lessons, each with notes and a recorded explanation
    for i in 1..3 loop
      v_l := 'qa-el-l-' || n || '-' || i;
      insert into elearning.lessons (id, "courseSpaceId", title, description, "orderIndex", "weekNumber", status, "publishedAt", "estimatedMinutes", "updatedAt")
      values (v_l, v_cs, 'Week ' || (7 + i) || ': ' || (array['Revision and warm-up','New topic: practice together','Applying what we learned'])[i] || ' (' || subj.subject || ')',
              'Short lesson with notes, a video and practice questions.', 20 + i, 7 + i, 'PUBLISHED', now() - ((30 - i * 7) || ' days')::interval, 25, now());
      insert into elearning.materials (id, "lessonId", "courseSpaceId", title, type, status, "orderIndex", body, downloadable, "viewCount", "publishedAt", "updatedAt")
      values ('qa-el-m-' || n || '-' || i || 'a', v_l, v_cs, 'Teacher notes: week ' || (7 + i), 'NOTE', 'PUBLISHED', 1,
              'Today we look at the key ideas for ' || subj.subject || '. Read the examples slowly, say them out loud and then try the practice questions in your exercise book. Ask your teacher if anything is not clear.', true, 6 + i, now() - interval '10 days', now());
      insert into elearning.materials (id, "lessonId", "courseSpaceId", title, type, status, "orderIndex", "externalUrl", downloadable, "viewCount", "publishedAt", "updatedAt")
      values ('qa-el-m-' || n || '-' || i || 'b', v_l, v_cs, 'Watch: recorded explanation, week ' || (7 + i), 'LINK', 'PUBLISHED', 2,
              'https://www.youtube.com/results?search_query=' || replace(lower(subj.subject), ' ', '+') || '+for+kids', false, 3 + i, now() - interval '10 days', now());
    end loop;

    -- Assignments: graded last fortnight, overdue, due soon, due later, plus one waiting to be graded
    for k in 1..5 loop
      v_a := 'qa-el-a-' || n || '-' || k;
      insert into elearning.assignments (id, "courseSpaceId", title, instructions, type, "maxScore", "dueAt", "allowLateSubmission", status, "publishedAt", "updatedAt")
      values (v_a, v_cs,
        (array['Revision worksheet','Homework: practice set','Mid-term practice','Reading and reflection','Class activity write-up'])[k] || ' (' || subj.subject || ')',
        (array['Complete all questions in the worksheet and write your answers neatly.',
               'Finish the practice set from today''s lesson. Show your working.',
               'Practise the questions that will help you prepare for the mid-term test.',
               'Read the short passage and answer the questions in complete sentences.',
               'Write a short account of what we did in class.'])[k],
        'BOTH', 20,
        now() + ((array[-14, -3, 2, 6, -1])[k] || ' days')::interval, true, 'PUBLISHED',
        now() - interval '20 days', now());

      foreach stu in array v_students loop
        if k = 1 then
          insert into elearning.submissions (id, "assignmentId", "studentId", "courseSpaceId", "textContent", "submittedAt", status, score, "maxScore", feedback, "gradedAt", "gradedBy", "updatedAt")
          values ('qa-el-s-' || n || '-' || k || '-' || substr(stu, 1, 8), v_a, stu, v_cs, 'Done as asked.', now() - interval '15 days', 'GRADED',
                  case when stu = v_baraka then 10 + (n % 3) else 11 + (abs(hashtext(stu || n)) % 9) end, 20,
                  case when stu = v_baraka then 'A fair effort. Please practise the harder questions and ask for help early.' else 'Well done, keep it up.' end,
                  now() - interval '12 days', subj.teacher, now());
        elsif k = 2 and stu <> v_baraka and abs(hashtext(stu || n || k)) % 10 < 7 then
          insert into elearning.submissions (id, "assignmentId", "studentId", "courseSpaceId", "textContent", "submittedAt", "isLate", status, "maxScore", "updatedAt")
          values ('qa-el-s-' || n || '-' || k || '-' || substr(stu, 1, 8), v_a, stu, v_cs, 'My answers.', now() - interval '4 days', false, 'SUBMITTED', 20, now());
        elsif k = 3 and stu <> v_baraka and abs(hashtext(stu || n || k)) % 10 < 3 then
          insert into elearning.submissions (id, "assignmentId", "studentId", "courseSpaceId", "textContent", "submittedAt", status, "maxScore", "updatedAt")
          values ('qa-el-s-' || n || '-' || k || '-' || substr(stu, 1, 8), v_a, stu, v_cs, 'Practice done.', now() - interval '1 day', 'SUBMITTED', 20, now());
        elsif k = 5 and (stu = v_baraka or abs(hashtext(stu || n || k)) % 10 < 6) then
          insert into elearning.submissions (id, "assignmentId", "studentId", "courseSpaceId", "textContent", "submittedAt", status, "maxScore", "updatedAt")
          values ('qa-el-s-' || n || '-' || k || '-' || substr(stu, 1, 8), v_a, stu, v_cs, 'This is what we did in class.', now() - interval '1 day 3 hours', 'SUBMITTED', 20, now());
        end if;
      end loop;
    end loop;

    -- A unit quiz with three multiple-choice questions
    v_q := 'qa-el-q-' || n;
    insert into elearning.quizzes (id, "courseSpaceId", title, instructions, "timeLimitMinutes", "maxAttempts", "showCorrectAfter", "passingScore", status, "publishedAt", "totalPoints", "updatedAt")
    values (v_q, v_cs, 'Unit quiz: ' || subj.subject, 'Choose the best answer. You have 15 minutes and two attempts.', 15, 2, 'AFTER_CLOSE', 50, 'PUBLISHED', now() - interval '3 days', 3, now());
    v_qs := case subj.subject
      when 'Mathematics' then array[['What is 7 + 5?','12','10','11','13'],['Which shape has three sides?','Triangle','Circle','Square','Star'],['How many tens are in 40?','4','40','14','0']]
      when 'English' then array[['Which word starts with the sound "b"?','Ball','Cat','Dog','Sun'],['What is the opposite of "big"?','Small','Tall','Long','Wide'],['Which one is a naming word?','Teacher','Run','Quickly','Happy']]
      when 'Kiswahili' then array[['Neno "maji" lina maana gani?','Water','Fire','Food','Book'],['Siku baada ya Jumatatu ni?','Jumanne','Jumatano','Ijumaa','Jumapili'],['Neno "shule" linaanza na herufi gani?','S','M','K','T']]
      when 'Science' then array[['What do plants need to grow?','Water and sunlight','Plastic','Sand only','Salt'],['Which animal lays eggs?','Hen','Cow','Dog','Goat'],['Which one is a sense organ?','Eye','Table','Book','Door']]
      else array[['Where do we go to learn every day?','School','Market','Church','Garage'],['Who helps us stay healthy?','Doctor','Driver','Singer','Painter'],['Who looks after us at home?','Our family','A stranger','A bus','A tree']]
    end;
    for k in 1..3 loop
      v_qq := 'qa-el-qq-' || n || '-' || k;
      insert into elearning.quiz_questions (id, "quizId", type, prompt, points, "orderIndex", explanation, "updatedAt")
      values (v_qq, v_q, 'MULTIPLE_CHOICE', v_qs[k][1], 1, k, 'Review the notes from this week if you were not sure.', now());
      for i in 2..5 loop
        insert into elearning.quiz_options (id, "questionId", text, "isCorrect", "orderIndex")
        values ('qa-el-qo-' || n || '-' || k || '-' || i, v_qq, v_qs[k][i], i = 2, ((i + k) % 4));
      end loop;
    end loop;
  end loop;
end $$;

commit;
