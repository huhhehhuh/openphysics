# DB 계약

이 문서는 2026-10-18 기준 Supabase 프로젝트에 이미 적용된 초기 SQL의 요약입니다. 정확한 컬럼·제약·RLS·RPC 정의는 [initial_schema_applied.sql](sql/initial_schema_applied.sql)에 있습니다. **이미 적용한 초기 SQL을 같은 프로젝트에서 다시 실행하지 마세요.** 향후 변경은 별도 증분 SQL로 기록합니다.

## 관계

| 테이블 | 주요 컬럼 | 용도 |
| --- | --- | --- |
| `teams` | `id`, `name`, `login_code` | 팀 정보. `name`과 `login_code`는 각각 고유 |
| `profiles` | `id`, `role`, `team_id`, `display_name` | `id`는 `auth.users.id`; `role`은 `team` 또는 `teacher` |
| `op_days` | `id`, `date`, `title`, `starts_at`, `ends_at` | OP 날짜와 일정. 날짜는 고유 |
| `tasks` | `id`, `op_day_id`, `title`, `sort_order` | 일정별 과제 |
| `task_completions` | `team_id`, `task_id`, `completed_at` | 팀별 과제 완료; 두 ID가 복합 기본키 |
| `attendance` | `id`, `team_id`, `op_day_id`, `started_at`, `ended_at`, `end_reason` | 팀별 일정당 출결 1건 |
| `journals` | `id`, `team_id`, `op_day_id`, `content`, `created_at`, `updated_at` | 팀별 일정당 일지 1건. 현재 본문은 `text` 하나 |
| `journal_feedback` | `id`, `journal_id`, `teacher_id`, `content`, `created_at` | 일지별 교사 댓글 |

`team_id`는 `teams.id`이고, 계정별 팀은 로그인 후 `profiles.team_id`에서 가져옵니다. 팀 이름은 현재 `빵상`, DB의 로그인 코드는 `team01`입니다. 이메일 별칭의 `bbangssang`은 프론트엔드 로그인 변환용 코드이며 DB의 `teams.login_code`와 다릅니다.

## 권한과 시간

- Supabase Auth 로그인 후 `profiles.role`로 화면을 분기합니다. DB의 RLS가 팀별 접근을 제한하므로 화면에서 팀 ID를 감추는 것만으로 권한을 판단하지 않습니다.
- 팀 계정은 자기 팀의 `attendance`, `journals`, `task_completions`, `journal_feedback`만 조회할 수 있습니다. 과제 완료와 일지 작성은 자기 팀 것만 가능합니다.
- 교사는 전체 팀 기록을 조회하고 `op_days`, `tasks`, `journal_feedback`을 관리합니다. 일정 삭제 시 연결된 과제·출석·일지도 외래키 설정에 따라 함께 삭제될 수 있습니다.
- 출석 시작·종료는 테이블 직접 수정이 아니라 `supabase.rpc('start_attendance', { p_op_day_id })`, `supabase.rpc('finish_attendance', { p_op_day_id, p_reason })`를 사용합니다. 시작은 서울 날짜가 일정 날짜와 같을 때만 됩니다. 종료 사유는 필수입니다. 시간은 서버에서 기록한 `timestamptz`이며 화면에는 한국 시간으로 표시합니다.
- 팀당 동시에 한 명만 로그인하도록 제한하는 기능은 아직 없습니다. 한 팀 계정을 여러 기기에서 쓰면 동시에 접속할 수 있습니다.
- PDF 다운로드는 일지 데이터를 이용해 앱에서 생성할 예정이며, PDF 파일을 저장하는 DB 컬럼은 없습니다.

## 로그인 매핑

학생은 팀 이름과 비밀번호를 입력합니다. `src/App.tsx`가 `VITE_TEAM_CODES`에서 팀 이름을 이메일 별칭 코드로 바꾸고, `VITE_TEAM_EMAIL_TEMPLATE`과 결합해 Supabase Auth에 전달합니다. 이 환경변수는 각 개발자 컴퓨터에 필요합니다. 팀이 추가되면 두 개발자의 로컬 설정과 배포 설정을 함께 갱신해야 합니다.
