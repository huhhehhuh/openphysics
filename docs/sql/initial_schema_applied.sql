begin;

create schema if not exists private;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  login_code text not null unique,
  created_at timestamptz not null default now(),
  constraint teams_name_not_blank check (length(btrim(name)) > 0),
  constraint teams_login_code_format check (login_code ~ '^[a-z0-9_-]{3,32}$')
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('team', 'teacher')),
  team_id uuid references public.teams(id) on delete restrict,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint profiles_role_team_match check (
    (role = 'team' and team_id is not null)
    or (role = 'teacher' and team_id is null)
  ),
  constraint profiles_display_name_not_blank check (length(btrim(display_name)) > 0)
);

create unique index profiles_one_account_per_team
  on public.profiles(team_id) where role = 'team';

create table public.op_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint op_days_title_not_blank check (length(btrim(title)) > 0),
  constraint op_days_time_order check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  op_day_id uuid not null references public.op_days(id) on delete cascade,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0)
);

create index tasks_op_day_order on public.tasks(op_day_id, sort_order);

create table public.task_completions (
  team_id uuid not null references public.teams(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (team_id, task_id)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  op_day_id uuid not null references public.op_days(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  unique (team_id, op_day_id),
  constraint attendance_end_state check (
    (ended_at is null and end_reason is null)
    or (
      ended_at is not null
      and ended_at >= started_at
      and nullif(btrim(end_reason), '') is not null
    )
  )
);

create index attendance_op_day on public.attendance(op_day_id);

create table public.journals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  op_day_id uuid not null references public.op_days(id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, op_day_id)
);

create index journals_op_day on public.journals(op_day_id);

create table public.journal_feedback (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  content text not null,
  created_at timestamptz not null default now(),
  constraint journal_feedback_content_not_blank check (length(btrim(content)) > 0)
);

create index journal_feedback_journal_time
  on public.journal_feedback(journal_id, created_at);

create function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'teacher'
  );
$$;

create function private.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select team_id from public.profiles
  where id = (select auth.uid()) and role = 'team';
$$;

create function private.touch_journal_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger journals_touch_updated_at
before update on public.journals
for each row execute function private.touch_journal_updated_at();

create function public.start_attendance(p_op_day_id uuid)
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

  select date into day_date from public.op_days where id = p_op_day_id;
  if day_date is null or day_date <> (now() at time zone 'Asia/Seoul')::date then
    raise exception 'Attendance can only start on the scheduled day';
  end if;

  insert into public.attendance (team_id, op_day_id)
  values (team_uuid, p_op_day_id)
  on conflict (team_id, op_day_id) do nothing;

  select * into result from public.attendance
  where team_id = team_uuid and op_day_id = p_op_day_id;
  return result;
end;
$$;

create function public.finish_attendance(p_op_day_id uuid, p_reason text)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  team_uuid uuid := private.current_team_id();
  result public.attendance;
begin
  if team_uuid is null then
    raise exception 'Team account required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'End reason is required';
  end if;

  update public.attendance
  set ended_at = clock_timestamp(), end_reason = btrim(p_reason)
  where team_id = team_uuid
    and op_day_id = p_op_day_id
    and ended_at is null
  returning * into result;

  if not found then
    raise exception 'Active attendance not found';
  end if;
  return result;
end;
$$;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.op_days enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.attendance enable row level security;
alter table public.journals enable row level security;
alter table public.journal_feedback enable row level security;

revoke all on public.teams, public.profiles, public.op_days, public.tasks,
  public.task_completions, public.attendance, public.journals,
  public.journal_feedback from public, anon, authenticated;

grant usage on schema private to authenticated;
revoke all on function private.is_teacher() from public;
revoke all on function private.current_team_id() from public;
revoke all on function private.touch_journal_updated_at() from public;
revoke all on function public.start_attendance(uuid) from public;
revoke all on function public.finish_attendance(uuid, text) from public;
grant execute on function private.is_teacher() to authenticated;
grant execute on function private.current_team_id() to authenticated;
grant execute on function public.start_attendance(uuid) to authenticated;
grant execute on function public.finish_attendance(uuid, text) to authenticated;

grant select on public.teams, public.profiles, public.op_days, public.tasks,
  public.task_completions, public.attendance, public.journals,
  public.journal_feedback to authenticated;
grant insert, update on public.op_days to authenticated;
grant insert, update, delete on public.tasks to authenticated;
grant insert (team_id, task_id) on public.task_completions to authenticated;
grant delete on public.task_completions to authenticated;
grant insert (team_id, op_day_id, content) on public.journals to authenticated;
grant update (content) on public.journals to authenticated;
grant insert (journal_id, teacher_id, content) on public.journal_feedback to authenticated;
grant update (content) on public.journal_feedback to authenticated;
grant delete on public.journal_feedback to authenticated;

create policy teams_read on public.teams
for select to authenticated
using (id = (select private.current_team_id()) or (select private.is_teacher()));

create policy profiles_read on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select private.is_teacher()));

create policy op_days_read on public.op_days
for select to authenticated using (true);
create policy op_days_teacher_insert on public.op_days
for insert to authenticated with check ((select private.is_teacher()));
create policy op_days_teacher_update on public.op_days
for update to authenticated
using ((select private.is_teacher())) with check ((select private.is_teacher()));
create policy tasks_read on public.tasks
for select to authenticated using (true);
create policy tasks_teacher_insert on public.tasks
for insert to authenticated with check ((select private.is_teacher()));
create policy tasks_teacher_update on public.tasks
for update to authenticated
using ((select private.is_teacher())) with check ((select private.is_teacher()));
create policy tasks_teacher_delete on public.tasks
for delete to authenticated using ((select private.is_teacher()));

create policy task_completions_read on public.task_completions
for select to authenticated
using (team_id = (select private.current_team_id()) or (select private.is_teacher()));
create policy task_completions_team_insert on public.task_completions
for insert to authenticated
with check (team_id = (select private.current_team_id()));
create policy task_completions_team_delete on public.task_completions
for delete to authenticated
using (team_id = (select private.current_team_id()));

create policy attendance_read on public.attendance
for select to authenticated
using (team_id = (select private.current_team_id()) or (select private.is_teacher()));

create policy journals_read on public.journals
for select to authenticated
using (team_id = (select private.current_team_id()) or (select private.is_teacher()));
create policy journals_team_insert on public.journals
for insert to authenticated
with check (team_id = (select private.current_team_id()));
create policy journals_team_update on public.journals
for update to authenticated
using (team_id = (select private.current_team_id()))
with check (team_id = (select private.current_team_id()));

create policy journal_feedback_read on public.journal_feedback
for select to authenticated
using (
  (select private.is_teacher())
  or exists (
    select 1 from public.journals
    where journals.id = journal_id
      and journals.team_id = (select private.current_team_id())
  )
);
create policy journal_feedback_teacher_insert on public.journal_feedback
for insert to authenticated
with check ((select private.is_teacher()) and teacher_id = (select auth.uid()));
create policy journal_feedback_teacher_update on public.journal_feedback
for update to authenticated
using ((select private.is_teacher()) and teacher_id = (select auth.uid()))
with check ((select private.is_teacher()) and teacher_id = (select auth.uid()));
create policy journal_feedback_teacher_delete on public.journal_feedback
for delete to authenticated
using ((select private.is_teacher()) and teacher_id = (select auth.uid()));

commit;
