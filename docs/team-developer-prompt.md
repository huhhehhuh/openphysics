# 팀 페이지 담당 개발 AI에게 전달할 프롬프트

나는 OpenPhysics라는 반 단위 물리 탐구 기록 웹앱의 **팀 페이지**를 담당한다. 이 GitHub 저장소의 기존 코드를 이어서 개발해 줘. 먼저 `README.md`, `docs/handoff.md`, `docs/database.md`, `docs/sql/initial_schema_applied.sql`, `src/App.tsx`, `src/pages/TeamHome.tsx`를 읽고 현재 구현 상태를 확인해.

## 프로젝트 맥락

- 기술: React + TypeScript + Vite + Supabase Auth/Postgres. Supabase 클라이언트는 `src/lib/supabase.ts`에 있다.
- 관리자 1명과 여러 팀이 사용한다. 학생 개인 계정이 아니라 팀별 공용 계정이다.
- 팀은 화면에 팀 이름(예: `빵상`)과 비밀번호를 입력한다. `src/App.tsx`가 이를 내부 이메일 별칭으로 변환하고, `profiles.role`에 따라 팀/교사 화면으로 보낸다.
- Supabase DB와 RLS는 이미 만들어졌다. `docs/sql/initial_schema_applied.sql`은 기록용이며 **실제 프로젝트에 다시 실행하지 않는다**.
- 현재 팀·교사 대시보드는 디자인 뼈대다. 일정, 출석, 과제, 일지 버튼은 실제 기능과 아직 연결되지 않았다.

## 맡은 범위

`src/pages/TeamHome.tsx`와 팀 전용 컴포넌트를 구현한다. 제공된 웹 설계도를 기준으로 (1) OP 일정/달력과 오늘 일정, (2) 출석 시작·종료 및 종료 사유 입력, (3) 일정별 과제 체크리스트와 완료 수, (4) 실험일지 작성·수정·조회, (5) 교사 피드백 표시, (6) 저장된 일지의 PDF 다운로드를 완성한다. 실제 Supabase 데이터를 읽고 쓰며 로딩·오류·빈 상태를 처리한다. 출석 시각은 브라우저 시각으로 쓰지 말고 기존 `start_attendance`/`finish_attendance` RPC를 호출한다. 저장된 시각은 한국 시간으로 보여준다.

## 협업 규칙

- 교사 담당자는 `src/pages/TeacherHome.tsx`와 교사 전용 파일을 수정한다. 이 파일은 건드리지 않는다.
- 로그인/역할 분기 파일 `src/App.tsx`, 공통 스타일, DB 스키마를 바꿔야 한다면 먼저 변경 이유와 인터페이스를 다른 개발자에게 제안한다.
- 사용자의 팀 ID는 `profiles.team_id`를 기준으로 하고, 권한은 기존 RLS 정책을 따른다. 서비스 키·DB 비밀번호를 브라우저 코드에 넣지 않는다.
- `.env`는 개인 컴퓨터에만 두고 GitHub에 올리지 않는다. 빠진 설정이 있으면 값을 채팅에 붙여넣게 하지 말고 필요한 변수 이름만 안내한다.
- 별도 작업 브랜치에서 작업한 뒤 빌드를 확인하고 Pull Request로 합칠 수 있게 정리한다.

먼저 구현 순서와 필요한 DB 조회·수정 흐름을 간단히 제시하고, 실제 코드까지 작성해 줘. 막히는 사항이 생기면 무엇이 필요한지 구체적으로 알려줘.
