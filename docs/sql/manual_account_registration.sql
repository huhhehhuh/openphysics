-- 한 번만 실행: 셀프 가입을 제거하고 기존 계정의 팀 이메일 매핑을 보존합니다.
-- 기존 Auth 사용자, 팀, 프로필, 일정 및 활동 데이터는 삭제하지 않습니다.

begin;

create table if not exists public.team_credentials (
  team_id uuid primary key references public.teams(id) on delete cascade,
  contact_email text not null unique,
  created_at timestamptz not null default now()
);

insert into public.team_credentials (team_id, contact_email)
select profile.team_id, auth_user.email
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where profile.role = 'team'
  and profile.team_id is not null
  and auth_user.email is not null
on conflict (team_id) do nothing;

alter table public.team_credentials enable row level security;
revoke all on public.team_credentials from public, anon, authenticated;
grant select on public.team_credentials to service_role;

drop trigger if exists openphysics_prepare_team_signup on auth.users;
drop trigger if exists openphysics_create_team_profile_after_signup on auth.users;
drop function if exists private.prepare_team_signup();
drop function if exists private.create_team_profile_after_signup();
drop function if exists public.get_team_registration_state();
drop function if exists public.set_team_registration(boolean, text);
drop table if exists public.team_registration_settings;

commit;
