// 날짜·시간을 한국 시간(Asia/Seoul)으로 보여 주는 도우미 함수 모음입니다.
// 여기서 만든 값은 "화면 표시용"이고, DB에 저장하는 시각은 항상 서버(RPC)가 만듭니다.

const SEOUL = 'Asia/Seoul'

/** 지금 서울 날짜를 'YYYY-MM-DD' 형태로 돌려줍니다. (op_days.date 와 비교용) */
export function seoulToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SEOUL, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** 'YYYY-MM-DD' 문자열을 시간대 영향 없이 Date 로 바꿉니다. (UTC 자정 기준) */
function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

/** '2026-10-18' → '10월 18일 (일)' */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'long', day: 'numeric', weekday: 'short' }).format(dateOnly(date))
}

/** '2026-10-18' → '2026년 10월 18일 일요일' */
export function formatDayLong(date: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(dateOnly(date))
}

/** 서버 timestamptz → '오후 2:05' (한국 시간) */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: SEOUL, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

/** 서버 timestamptz → '10월 18일 오후 2:05' (한국 시간) */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: SEOUL, month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

/** 일정 시작~종료 시각 표시. 시각이 없으면 null */
export function formatTimeRange(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt && !endsAt) return null
  if (startsAt && endsAt) return `${formatTime(startsAt)} – ${formatTime(endsAt)}`
  return startsAt ? `${formatTime(startsAt)} 시작` : `${formatTime(endsAt!)} 종료`
}

/** 밀리초 → '1시간 05분 09초' */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}시간 ${pad(m)}분 ${pad(s)}초` : `${m}분 ${pad(s)}초`
}

/** 밀리초 → '0시간 12분' (설계도의 "현재 0시간 00분 진행중" 표시용) */
export function formatHoursMinutes(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(totalMinutes / 60)}시간 ${String(totalMinutes % 60).padStart(2, '0')}분`
}

/** '2026-10-14' → '10/14' */
export function formatMonthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
}
