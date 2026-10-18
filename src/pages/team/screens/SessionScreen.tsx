// 설계도 ②: 출석 후 "진행 중" 화면.
// [오늘의 과제 보기]  현재 0시간 00분 진행중  [실험일지 작성] [작성내용 보기] [끝내기]
import type { Attendance, OpDay } from '../teamApi'
import { formatDayLong, formatDuration, formatHoursMinutes, formatTime } from '../time'
import { useNow } from '../useNow'

export type TaskProgress = { done: number; total: number } | null

type Props = {
  day: OpDay
  attendance: Attendance
  taskProgress: TaskProgress
  onOpenTasks: () => void
  onWriteJournal: () => void
  onOpenJournalList: () => void
  onFinish: () => void
  tasksAvailable: boolean
}

export default function SessionScreen({ day, attendance, taskProgress, onOpenTasks, onWriteJournal, onOpenJournalList, onFinish, tasksAvailable }: Props) {
  const active = attendance.ended_at === null
  const now = useNow(active, 1000)
  const started = new Date(attendance.started_at).getTime()

  return (
    <section className="team-screen">
      <p className="eyebrow">{formatDayLong(day.date)}</p>
      <h1 className="team-screen-title">{day.title}</h1>

      {tasksAvailable && active ? <button type="button" className="team-pill-button" onClick={onOpenTasks}>
        오늘의 과제 보기{taskProgress && taskProgress.total > 0 ? ` (${taskProgress.done}/${taskProgress.total})` : ''}
      </button> : <p className="team-inline-note">과제 체크는 해당 OP Day 출석을 진행 중일 때만 할 수 있어요.</p>}

      {/* 출석을 마친 뒤에도 진행 중일 때와 같은 모양으로 보여 줘서, 당일에 과제·일지를 다시 고칠 수 있어요. */}
      <div className="team-timer-box" aria-live="off">
        {active ? (
          <>
            <span>현재</span>
            <strong>{formatHoursMinutes(now - started)}</strong>
            <span>진행중</span>
            <small>{formatTime(attendance.started_at)} 시작 · {formatDuration(now - started)}</small>
          </>
        ) : (
          <>
            <span>총</span>
            <strong>{formatHoursMinutes(new Date(attendance.ended_at!).getTime() - started)}</strong>
            <span>진행</span>
            <small>{formatTime(attendance.started_at)} – {formatTime(attendance.ended_at!)} · 사유: {attendance.end_reason}</small>
          </>
        )}
      </div>

      <div className="team-session-grid">
        <button type="button" className="team-tile" onClick={onWriteJournal}>실험일지<br />제출</button>
        <button type="button" className="team-tile" onClick={onOpenJournalList}>제출 기록<br />보기</button>
        {active ? (
          <button type="button" className="team-tile is-finish" onClick={onFinish}>끝내기</button>
        ) : (
          <div className="team-tile is-finish is-ended" aria-label={`출석 종료 ${formatTime(attendance.ended_at!)}`}>
            출석 종료<small>{formatTime(attendance.ended_at!)}</small>
          </div>
        )}
      </div>
    </section>
  )
}
