# OpenPhysics

한 반의 물리 탐구 활동을 팀과 교사가 함께 기록하는 웹앱입니다. React, TypeScript, Vite, Supabase Auth/Postgres를 사용합니다.

## 로컬 실행

1. `npm install`
2. `.env.example`을 `.env`로 복사하고 Supabase Project URL, Publishable Key, 팀·교사 이름 로그인용 이메일 연결 규칙을 입력
3. `npm run dev`
4. 터미널에 표시된 로컬 주소 열기

`.env`는 Git에서 제외됩니다. 각 개발자가 자기 컴퓨터에 따로 만듭니다. `sb_secret_...`, `service_role`, DB 비밀번호, 사용자 비밀번호를 코드나 GitHub에 넣지 마세요. `VITE_` 변수는 브라우저 번들에 포함되므로 이메일 템플릿에는 개인 이메일보다 프로젝트 전용 주소가 적합합니다.

## 협업 경계

- 팀 화면: `src/pages/TeamHome.tsx`와 팀 전용 컴포넌트
- 교사 화면: `src/pages/TeacherHome.tsx`와 교사 전용 컴포넌트
- 공통 로그인/역할 분기: `src/App.tsx`
- 공통 Supabase 클라이언트: `src/lib/supabase.ts`
- DB 계약: `docs/database.md`와 `docs/sql/initial_schema_applied.sql`

현재 로그인, 비밀번호 복구, 역할별 화면 분기와 대시보드 디자인만 구현되어 있습니다. 대시보드의 일정·출석·과제·일지 버튼과 수치는 아직 실제 DB에 연결되지 않았습니다.

두 개발자는 각자 작업용 브랜치에서 자기 화면을 구현하고, GitHub Pull Request로 합칩니다. 공통 파일이나 DB 스키마 변경은 먼저 함께 합의합니다. 자세한 인수인계는 [docs/handoff.md](docs/handoff.md)를 보세요.
