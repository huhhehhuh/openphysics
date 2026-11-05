-- PDF 실험일지 제출자(학번·이름) 기록을 위한 확장 SQL입니다.
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 기존 실험일지는 제출자 정보가 NULL인 상태로 유지됩니다.

alter table public.journals
  add column if not exists submitter_student_number text,
  add column if not exists submitter_name text;

alter table public.journals
  drop constraint if exists journals_submitter_student_number_not_blank,
  add constraint journals_submitter_student_number_not_blank
    check (submitter_student_number is null or length(btrim(submitter_student_number)) > 0),
  drop constraint if exists journals_submitter_name_not_blank,
  add constraint journals_submitter_name_not_blank
    check (submitter_name is null or length(btrim(submitter_name)) > 0);

grant insert (team_id, journal_date, file_path, file_name, content, submitter_student_number, submitter_name)
  on public.journals to authenticated;

grant update (team_id, journal_date, file_path, file_name, content, submitter_student_number, submitter_name)
  on public.journals to authenticated;
