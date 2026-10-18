// 설계도: [일정보기] → OP 데이 일정(캘린더) 화면.
// 달력에서 OP 날짜를 누르면 그날의 시간·출석 상태·과제 목록을 아래에 보여 줍니다.
import { useEffect, useMemo, useState } from 'react'
import ScheduleCalendar from '../ScheduleCalendar'
import { fetchTasks, friendlyError, type Attendance, type JournalSummary, type OpDay, type Task } from '../teamApi'
import { formatDayLong, formatTimeRange } from '../time'

type Props = {
  opDays: OpDay[]
  today: string
  attendances: Attendance[]
  journals: JournalSummary[]
  onOpenSession: (opDayId: string) => void
  onOpenTasks: (opDayId: string) => void
  onOpenJournal: (opDayId: string) => void
}

export default function CalendarScreen({ opDays, today, attendances, journals, onOpenSession, onOpenTasks, onOpenJournal }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (opDays.find((d) => d.date >= today) ?? opDays[opDays.length - 1])?.id ?? null,
  )
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [tasksError, setTasksError] = useState('')

  const attendedDayIds = useMemo(() => new Set(attendances.flatMap((a) => a.op_day_id ? [a.op_day_id] : [])), [attendances])
  const journalDayIds = useMemo(() => new Set(journals.map((j) => j.op_day_id)), [journals])
  const selected = opDays.find((d) => d.id === selectedId) ?? null
  const attendance = attendances.find((a) => a.op_day_id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setTasks(null)
    setTasksError('')
    fetchTasks(selectedId)
      .then((list) => { if (!cancelled) setTasks(list) })
      .catch((err) => { if (!cancelled) setTasksError(friendlyError(err)) })
    return () => { cancelled = true }
  }, [selectedId])

  if (opDays.length === 0) {
    return (
      <section className="team-screen">
        <h1 className="team-screen-title">OP 데이 일정</h1>
        <div className="team-state"><strong>등록된 OP 일정이 없어요.</strong><span>선생님이 일정을 등록하면 달력에 표시돼요.</span></div>
      </section>
    )
  }

  const range = selected ? formatTimeRange(selected.starts_at, selected.ends_at) : null

  return (
    <section className="team-screen">
      <h1 className="team-screen-title">OP 데이 일정</h1>
      <ScheduleCalendar
        opDays={opDays}
        today={today}
        selectedId={selectedId}
        attendedDayIds={attendedDayIds}
        journalDayIds={journalDayIds}
        onSelect={(day) => setSelectedId(day.id)}
      />

      {selected && (
        <article className="team-day-detail" aria-live="polite">
          <div className="team-badges">
            {selected.date === today && <em className="badge-today">오늘</em>}
            {selected.date > today && <em>예정</em>}
            {attendance && <em className="badge-attend">{attendance.ended_at ? '출석 완료' : '진행 중'}</em>}
            {!attendance && selected.date < today && <em>출석 기록 없음</em>}
            {journalDayIds.has(selected.id) && <em className="badge-journal">일지 작성함</em>}
          </div>
          <h2>{selected.title}</h2>
          <span className="muted">{formatDayLong(selected.date)}{range ? ` · ${range}` : ''}</span>

          {tasksError ? (
            <p className="team-inline-error" role="alert">과제를 불러오지 못했어요. {tasksError}</p>
          ) : tasks === null ? (
            <p className="team-inline-note">과제를 불러오는 중...</p>
          ) : tasks.length === 0 ? (
            <p className="team-inline-note">등록된 과제가 없어요.</p>
          ) : (
            <ul>{tasks.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
          )}

          <div className="team-detail-actions">
            {attendance ? (
              <button type="button" className="outline-button" onClick={() => onOpenSession(selected.id)}>진행 화면 보기 →</button>
            ) : tasks && tasks.length > 0 ? (
              <button type="button" className="outline-button" onClick={() => onOpenTasks(selected.id)}>과제 체크하기 →</button>
            ) : null}
            <button type="button" className="outline-button" onClick={() => onOpenJournal(selected.id)}>
              {journalDayIds.has(selected.id) ? '실험일지 열기 →' : '실험일지 작성 →'}
            </button>
          </div>
        </article>
      )}
    </section>
  )
}
