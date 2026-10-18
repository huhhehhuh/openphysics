-- OP Day가 없는 날에도 팀이 자율 탐구 출석을 시작할 수 있도록 하는 마이그레이션
begin;

alter table public.attendance
  alter column op_day_id drop not null;

create unique index if not exists attendance_team_active_autonomous
  on public.attendance(team_id)
  where op_day_id is null and ended_at is null;

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

    insert into public.attendance (team_id, op_day_id)
    values (team_uuid, p_op_day_id)
    on conflict (team_id, op_day_id) do nothing;

    select * into result from public.attendance
    where team_id = team_uuid and op_day_id = p_op_day_id;
  else
    select * into result from public.attendance
    where team_id = team_uuid and op_day_id is null and ended_at is null
    order by started_at desc
    limit 1;

    if not found then
      insert into public.attendance (team_id, op_day_id)
      values (team_uuid, null)
      returning * into result;
    end if;
  end if;

  return result;
end;
$$;

create or replace function public.finish_attendance_by_id(p_attendance_id uuid, p_reason text)
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
  where id = p_attendance_id
    and team_id = team_uuid
    and ended_at is null
  returning * into result;

  if not found then
    raise exception 'Active attendance not found';
  end if;
  return result;
end;
$$;

revoke all on function public.start_attendance(uuid) from public;
revoke all on function public.finish_attendance_by_id(uuid, text) from public;
grant execute on function public.start_attendance(uuid) to authenticated;
grant execute on function public.finish_attendance_by_id(uuid, text) to authenticated;

commit;
