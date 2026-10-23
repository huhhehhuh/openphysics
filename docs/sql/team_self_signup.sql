-- 과거 셀프 가입 방식: 새 계정에는 사용하지 마세요.
-- 관리자 직접 등록으로 전환하려면 manual_account_registration.sql을 실행하세요.
-- OpenPhysics: 공통 참여 코드 기반 팀 가입
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 기존 교사/팀 계정, 일정, 출결, 일지는 삭제하거나 변경하지 않습니다.

begin;

create table if not exists public.team_credentials (
  team_id uuid primary key references public.teams(id) on delete cascade,
  contact_email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.team_registration_settings (
  singleton boolean primary key default true check (singleton),
  is_open boolean not null default false,
  participation_code_hash text,
  updated_at timestamptz not null default now()
);

-- 기존 팀은 현재 Auth 이메일을 내부 연락처로 한 번 옮겨 새 로그인 방식을 바로 사용합니다.
insert into public.team_credentials (team_id, contact_email)
select profile.team_id, auth_user.email
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where profile.role = 'team'
  and profile.team_id is not null
on conflict (team_id) do update
set contact_email = excluded.contact_email;

insert into public.team_registration_settings (singleton, is_open)
values (true, false)
on conflict (singleton) do nothing;

alter table public.team_credentials enable row level security;
alter table public.team_registration_settings enable row level security;
revoke all on public.team_credentials, public.team_registration_settings from public, anon, authenticated;

create or replace function private.prepare_team_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_team_name text;
  supplied_participation_code text;
  settings public.team_registration_settings%rowtype;
  created_team_id uuid;
  generated_login_code text;
begin
  if coalesce(new.raw_user_meta_data ->> 'openphysics_signup', '') <> 'team' then
    return new;
  end if;

  requested_team_name := nullif(btrim(new.raw_user_meta_data ->> 'team_name'), '');
  supplied_participation_code := nullif(new.raw_user_meta_data ->> 'participation_code', '');

  if requested_team_name is null or supplied_participation_code is null then
    raise exception '팀 이름과 참여 코드를 모두 입력해 주세요.';
  end if;

  select * into settings
  from public.team_registration_settings
  where singleton = true;

  if not found or not settings.is_open then
    raise exception '현재 팀 가입이 닫혀 있습니다. 선생님에게 문의해 주세요.';
  end if;

  if settings.participation_code_hash is null
    or settings.participation_code_hash <> encode(extensions.digest(supplied_participation_code, 'sha256'), 'hex') then
    raise exception '참여 코드가 올바르지 않습니다.';
  end if;

  generated_login_code := 'team_' || left(replace(new.id::text, '-', ''), 12);

  insert into public.teams (name, login_code)
  values (requested_team_name, generated_login_code)
  returning id into created_team_id;

  insert into public.team_credentials (team_id, contact_email)
  values (created_team_id, new.email);

  -- 참여 코드와 연락 이메일은 Auth 사용자 메타데이터에 남기지 않습니다.
  new.raw_user_meta_data := jsonb_build_object('openphysics_team_id', created_team_id::text);
  return new;
exception
  when unique_violation then
    raise exception '이미 사용 중인 팀 이름 또는 인증용 이메일입니다.';
end;
$$;

create or replace function private.create_team_profile_after_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_team public.teams%rowtype;
  selected_team_id uuid;
begin
  if new.raw_user_meta_data ? 'openphysics_team_id' then
    selected_team_id := (new.raw_user_meta_data ->> 'openphysics_team_id')::uuid;

    select * into selected_team from public.teams where id = selected_team_id;
    if not found then
      raise exception '새 팀 정보를 확인하지 못했습니다.';
    end if;

    insert into public.profiles (id, role, team_id, display_name)
    values (new.id, 'team', selected_team.id, selected_team.name);
  end if;
  return new;
end;
$$;

create or replace function public.get_team_registration_state()
returns table (is_open boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_teacher() then
    raise exception 'Teacher account required';
  end if;

  return query select settings.is_open
  from public.team_registration_settings settings
  where settings.singleton = true;
end;
$$;

create or replace function public.set_team_registration(
  p_is_open boolean,
  p_participation_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_teacher() then
    raise exception 'Teacher account required';
  end if;

  if p_is_open and nullif(btrim(p_participation_code), '') is null then
    raise exception '가입을 열려면 새 참여 코드를 입력해 주세요.';
  end if;

  update public.team_registration_settings
  set is_open = p_is_open,
      participation_code_hash = case
        when p_is_open then encode(extensions.digest(btrim(p_participation_code), 'sha256'), 'hex')
        else participation_code_hash
      end,
      updated_at = now()
  where singleton = true;
end;
$$;

drop trigger if exists openphysics_prepare_team_signup on auth.users;
create trigger openphysics_prepare_team_signup
before insert on auth.users
for each row execute function private.prepare_team_signup();

drop trigger if exists openphysics_create_team_profile_after_signup on auth.users;
create trigger openphysics_create_team_profile_after_signup
after insert on auth.users
for each row execute function private.create_team_profile_after_signup();

revoke all on function public.get_team_registration_state() from public;
revoke all on function public.set_team_registration(boolean, text) from public;
grant execute on function public.get_team_registration_state() to authenticated;
grant execute on function public.set_team_registration(boolean, text) to authenticated;

commit;
