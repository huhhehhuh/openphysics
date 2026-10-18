# 두 개발자 인수인계

## 현재 상태

Supabase에 초기 테이블 8개와 RLS/RPC가 만들어졌고, 교사 계정 1개 및 `빵상` 팀 계정 1개가 각 `profiles`에 연결되어 있습니다. 로컬 앱에는 로그인, 비밀번호 복구, 역할별 대시보드 뼈대가 있습니다. 교사·팀 화면의 기능 버튼은 아직 데이터와 연결되지 않았습니다.

## 새 개발자 시작 순서

1. 저장소 소유자가 먼저 현재 코드를 GitHub에 올리고, 팀원을 Collaborator로 초대합니다. 팀원은 초대를 수락합니다.
2. Windows에 [Node.js LTS](https://nodejs.org/en/download)를 설치합니다. 새 명령 프롬프트에서 `node -v`와 `npm -v`가 모두 버전 번호를 출력하는지 확인합니다.
3. [GitHub Desktop](https://desktop.github.com/)에서 로그인하고 **File → Clone Repository → URL**에 `https://github.com/huhhehhuh/openphysics.git`을 입력해 클론합니다. 설치된 Git이 있다면 터미널의 `git clone`을 사용해도 됩니다.
4. 탐색기에서 클론한 `openphysics` 폴더를 엽니다. 주소창에 `cmd`를 입력하고 Enter를 누르면 **바로 그 폴더에서** 명령 프롬프트가 열립니다. 여기서 `npm install`을 실행합니다. `package.json`이 보이는 폴더가 맞습니다.
5. 같은 창에서 `copy .env.example .env`를 실행합니다. `.env`를 열어 저장소 소유자에게 받은 **Project URL**, **Publishable Key**, 팀 이메일 별칭 규칙을 채웁니다. 사용자 비밀번호는 파일이나 채팅 프롬프트에 넣지 않습니다.
6. `npm run dev`로 실행하고 터미널에 나온 `http://localhost:5173` 같은 주소를 브라우저에서 엽니다. 테스트 계정이 필요하면 저장소 소유자와 안전한 방식으로 공유하거나 별도 테스트 계정을 만듭니다.
7. `README.md`, `docs/database.md`, `docs/sql/initial_schema_applied.sql`을 읽고 개발합니다. 초기 SQL은 이미 적용됐으므로 다시 실행하지 않습니다.

명령 프롬프트를 닫거나 `Ctrl + C`를 누르면 로컬 개발 서버만 종료됩니다. 다시 열 때는 `openphysics` 폴더에서 `npm run dev`를 실행합니다. `npm install`은 처음 한 번과 의존성 변경 후에만 다시 실행하면 됩니다.

## 작업 분담

팀 담당자는 `src/pages/TeamHome.tsx` 및 팀 전용 파일에서 OP 일정 보기, 출석 시작/종료, 과제 완료, 실험일지 작성·조회, 교사 피드백 확인, PDF 다운로드를 만듭니다. 교사 담당자는 `src/pages/TeacherHome.tsx` 및 교사 전용 파일에서 일정·과제 관리, 팀별 출결 조회, 실험일지 목록·피드백을 만듭니다. 두 사람 모두 공통 로그인(`src/App.tsx`)과 DB 구조 변경은 먼저 합의합니다.

각자 별도 브랜치에서 작업해 Pull Request로 합칩니다. 한 사람이 공통 컴포넌트를 바꾸어야 하면 상대에게 변경 내용을 알려 충돌을 줄입니다.
