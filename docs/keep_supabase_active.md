# Supabase 무료 플랜 Keep-alive

Supabase 무료 플랜은 최근 7일 동안 DB 활동이 적으면 프로젝트를 일시중지할 수 있습니다. 이 저장소의 GitHub Actions는 하루 한 번, 데이터를 변경하지 않는 전용 RPC를 호출합니다. 유료 플랜처럼 일시중지가 완전히 보장되는 것은 아니며, 이미 일시중지된 프로젝트를 자동으로 재개하지도 못합니다.

## 최초 설정

1. Supabase **SQL Editor**에서 [`sql/keep_alive.sql`](sql/keep_alive.sql) 전체를 한 번 실행합니다.
2. GitHub 저장소에서 **Settings → Secrets and variables → Actions → New repository secret**으로 이동합니다.
3. 아래 두 Secret을 만듭니다.

| Secret 이름 | 입력할 값 |
| --- | --- |
| `SUPABASE_URL` | 로컬 `.env`의 `VITE_SUPABASE_URL` 값 |
| `SUPABASE_PUBLISHABLE_KEY` | 로컬 `.env`의 `VITE_SUPABASE_PUBLISHABLE_KEY` 값 |

`SUPABASE_PUBLISHABLE_KEY`는 브라우저 앱에서도 사용하는 공개 키입니다. 그래도 GitHub 로그와 설정 화면에 불필요하게 노출하지 않도록 Secret으로 저장합니다. **`service_role` 키는 절대 입력하지 마세요.**

4. 이 파일들을 GitHub에 push합니다.
5. GitHub 저장소의 **Actions → Keep Supabase Active → Run workflow**를 눌러 한 번 실행합니다. 초록색 성공 표시가 나오면 완료입니다.

이후 매일 한국 시간 12:17 전후에 자동 실행됩니다. GitHub Actions의 예약 실행은 몇 분 지연될 수 있습니다.

## 일시중지된 경우

프로젝트가 이미 일시중지된 상태라면 Supabase Dashboard에서 먼저 **Resume project**를 눌러야 합니다. 재개해도 DB, Auth, Storage 데이터는 유지됩니다.
