-- Beta feedback migration: multiple attendance sessions, daily PDF journals,
-- and task completion only while an attendance session is active.
begin;

-- A team can start multiple attendance sessions for the same OP Day.
alter table public.attendance
  drop constraint if exists attendance_team_id_op_day_id_key;

drop index if exists public.attendance_team_active_autonomous;
create unique index if not exists attendance_one_active_session_per_team
  on public.attendance(team_id)
  where ended_at is null;

-- Replace the earlier autonomous-attendance helper: every press starts a new session.
create or replace function public.start_attendance(p_op_day_id uuid default null)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_uuid uuid := private.current_team_id();
  day_date date;
  result public.attendance;
begin
  if team_uuid is null then
    raise exception 'Team account required';
  end if;

  if p_op_day_id is not null then
    select date into day_date from public.op_days where id = p_op_day_id;
    if day_date is null or day_date <> (now() at time zone 'Asia/Seoul')::date then
      raise exception 'Attendance can only start on the scheduled day';
    end if;
  end if;

  insert into public.attendance (team_id, op_day_id)
  values (team_uuid, p_op_day_id)
  returning * into result;

  return result;
end;
$$;

-- Journals are one PDF submission per team per Korean calendar date.
alter table public.journals
  add column if not exists journal_date date,
  add column if not exists file_path text,
  add column if not exists file_name text;

update public.journals journal
set journal_date = coalesce(op_day.date, (journal.created_at at time zone 'Asia/Seoul')::date)
from public.op_days op_day
where journal.op_day_id = op_day.id
  and journal.journal_date is null;

update public.journals
set journal_date = (created_at at time zone 'Asia/Seoul')::date
where journal_date is null;

alter table public.journals
  alter column journal_date set not null,
  alter column op_day_id drop not null;

alter table public.journals
  drop constraint if exists journals_team_id_op_day_id_key;

create unique index if not exists journals_team_journal_date_key
  on public.journals(team_id, journal_date);

grant insert (team_id, journal_date, file_path, file_name, content) on public.journals to authenticated;
grant update (journal_date, file_path, file_name, content) on public.journals to authenticated;

-- Private Storage bucket for submitted PDFs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('experiment-journals', 'experiment-journals', false, 15728640, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 15728640,
    allowed_mime_types = array['application/pdf'];

drop policy if exists experiment_journals_team_insert on storage.objects;
create policy experiment_journals_team_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'experiment-journals'
  and (storage.foldername(name))[1] = (select private.current_team_id())::text
);

drop policy if exists experiment_journals_read on storage.objects;
create policy experiment_journals_read on storage.objects
for select to authenticated
using (
  bucket_id = 'experiment-journals'
  and (
    (select private.is_teacher())
    or (storage.foldername(name))[1] = (select private.current_team_id())::text
  )
);

drop policy if exists experiment_journals_team_delete on storage.objects;
create policy experiment_journals_team_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'experiment-journals'
  and (storage.foldername(name))[1] = (select private.current_team_id())::text
);

-- Task checks are possible only during an active attendance session for that OP Day.
drop policy if exists task_completions_team_insert on public.task_completions;
create policy task_completions_team_insert on public.task_completions
for insert to authenticated
with check (
  team_id = (select private.current_team_id())
  and exists (
    select 1
    from public.tasks task
    join public.attendance attendance on attendance.op_day_id = task.op_day_id
    where task.id = task_id
      and attendance.team_id = (select private.current_team_id())
      and attendance.ended_at is null
  )
);

drop policy if exists task_completions_team_delete on public.task_completions;
create policy task_completions_team_delete on public.task_completions
for delete to authenticated
using (
  team_id = (select private.current_team_id())
  and exists (
    select 1
    from public.tasks task
    join public.attendance attendance on attendance.op_day_id = task.op_day_id
    where task.id = task_completions.task_id
      and attendance.team_id = (select private.current_team_id())
      and attendance.ended_at is null
  )
);

commit;
