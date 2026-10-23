# 관리자 직접 계정 등록

사이트의 셀프 가입과 공통 참여 코드는 사용하지 않습니다. **비밀번호 재설정 이메일과 로그아웃은 그대로 동작**합니다. 계정 생성 시에는 확인 이메일을 보내지 않습니다.

## 최초 전환

1. Supabase SQL Editor에서 [`sql/manual_account_registration.sql`](sql/manual_account_registration.sql)을 한 번 실행합니다. 기존 계정과 활동 기록은 유지됩니다.
2. Supabase **Authentication → Sign In / Providers**에서 **Allow new users to sign up**을 끄고 저장합니다. 기존 계정 로그인과 관리자 계정 생성은 유지됩니다.
3. 변경된 웹 코드를 배포하고, 기존처럼 로그인 전에도 호출할 수 있도록 `supabase functions deploy team-auth --no-verify-jwt`로 Edge Function도 다시 배포합니다. `APP_URL`은 배포한 사이트 주소로 유지합니다.
4. 팀/교사 이름의 이메일 매핑은 이제 DB에서 가져옵니다. `VITE_TEAM_EMAIL_TEMPLATE`, `VITE_TEAM_CODES`, `VITE_TEACHER_EMAILS`는 더 이상 사용하지 않으므로 Vercel과 로컬 `.env`에서 제거할 수 있습니다. Supabase URL과 publishable key는 그대로 둡니다.

## 새 팀 등록

1. Supabase **Authentication → Users → Add user → Create new user**에서 연락용 이메일과 초기 비밀번호를 입력하고 **Auto Confirm User**를 켭니다. **Send invitation**은 선택하지 않습니다. Auth 이메일은 실제로 재설정 메일을 받을 수 있어야 합니다. 생성된 계정의 UID를 별도로 복사할 필요는 없습니다.
2. SQL Editor에서 아래 세 값만 바꾸고 실행합니다. 이메일은 방금 만든 Auth 계정과 같아야 합니다. `login_code`는 다른 팀과 겹치지 않는 영문 소문자/숫자/`_`/`-` 3~32자로 적습니다. 화면 로그인에는 **팀 이름**을 사용합니다.

```sql
do $$
declare
  new_email text := 'team@example.com';
  new_team_name text := '새 팀 이름';
  new_login_code text := 'team05';
  new_user_id uuid;
  new_team_id uuid;
begin
  select id into new_user_id
  from auth.users
  where lower(email) = lower(new_email);

  if new_user_id is null then
    raise exception 'Auth Users에 해당 이메일이 없습니다: %', new_email;
  end if;

  insert into public.teams (name, login_code)
  values (new_team_name, new_login_code)
  returning id into new_team_id;

  insert into public.profiles (id, role, team_id, display_name)
  values (new_user_id, 'team', new_team_id, new_team_name);

  insert into public.team_credentials (team_id, contact_email)
  values (new_team_id, new_email);
end $$;
```

한 단계라도 실패하면 이 SQL의 DB 변경은 모두 취소됩니다. 다만 앞서 만든 Auth 계정은 남으므로, 오류를 수정해 SQL을 다시 실행하면 됩니다. 팀 이름이나 `login_code`가 이미 존재하면 중복 오류가 납니다.

## 새 교사 등록

1. 같은 방법으로 Auth 사용자를 **Create new user + Auto Confirm User**로 만듭니다.
2. 다음 두 값을 바꾸고 SQL Editor에서 실행합니다. 교사 로그인에는 `display_name`을 쓰므로 **교사끼리 이름을 중복하지 마세요**.

```sql
do $$
declare
  new_email text := 'teacher@example.com';
  new_teacher_name text := '선생님 성함';
  new_user_id uuid;
begin
  select id into new_user_id
  from auth.users
  where lower(email) = lower(new_email);

  if new_user_id is null then
    raise exception 'Auth Users에 해당 이메일이 없습니다: %', new_email;
  end if;

  insert into public.profiles (id, role, team_id, display_name)
  values (new_user_id, 'teacher', null, new_teacher_name);
end $$;
```

`auth.users`에 SQL로 직접 행을 넣거나 비밀번호를 저장하지 마세요. Auth 계정과 비밀번호는 Supabase Auth가 관리하며, SQL은 `teams`, `profiles`, `team_credentials`만 채웁니다. 비밀번호 재설정은 여전히 이메일을 보내므로 Supabase의 메일 발송 제한은 별도로 적용됩니다.
