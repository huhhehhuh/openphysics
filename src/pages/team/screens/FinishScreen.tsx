// 설계도 ③: [끝내기] 화면.
// 0월 0일 / 종료 시각 / 사유 / 현재 과제 수행도 3/5 / [제출] [취소]
// 화면의 종료 시각은 "지금 제출하면 대략 이 시각"이라는 미리보기이고,
// 실제 종료 시각은 제출할 때 서버(finish_attendance RPC)가 기록합니다.
import { FormEvent, useState } from 'react'
import { finishAttendanceById, friendlyError, type Attendance, type OpDay } from '../teamApi'
import { formatDayLong, formatDuration, formatTime } from '../time'
import { useNow } from '../useNow'
import type { TaskProgress } from './SessionScreen'

type Props = {
  day: OpDay
  attendance: Attendance
  taskProgress: TaskProgress
  onFinished: (attendance: Attendance) => void
  onCancel: () => void
}

const REASON_PRESETS = ['오늘 탐구 활동 완료', '정규 일정 종료', '개인 사정으로 조기 종료']

export default function FinishScreen({ day, attendance, taskProgress, onFinished, onCancel }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const now = useNow(true, 1000)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('종료 사유를 입력해 주세요.')
      return
    }
    // 이 화면 자체가 확인 단계(설계도의 [제출] / [취소])라서 팝업 확인 창은 띄우지 않습니다.
    // (팝업이 막힌 브라우저에서는 확인 창이 '아니요'로 처리돼 제출이 안 되는 문제가 있었어요.)
    setBusy(true)
    setError('')
    try {
      onFinished(await finishAttendanceById(attendance.id, trimmed))
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  const remaining = taskProgress ? taskProgress.total - taskProgress.done : 0

  return (
    <form className="team-screen" onSubmit={handleSubmit}>
      <h1 className="team-screen-title">{formatDayLong(day.date)}</h1>
      <p className="team-screen-sub">{day.title} 탐구를 마칠까요?</p>

      <div className="team-finish-card">
        <div className="team-finish-row"><span>시작 시각</span><strong>{formatTime(attendance.started_at)}</strong></div>
        <div className="team-finish-row"><span>종료 시각</span><strong>{formatTime(new Date(now).toISOString())} <small className="muted">(제출 시 서버 기록)</small></strong></div>
        <div className="team-finish-row"><span>진행 시간</span><strong>{formatDuration(now - new Date(attendance.started_at).getTime())}</strong></div>

        <label>
          사유
          <textarea rows={4} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 오늘 탐구 활동 완료" disabled={busy} autoFocus />
        </label>
        <div className="team-reason-chips" aria-label="자주 쓰는 사유">
          {REASON_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => setReason(preset)} disabled={busy}>{preset}</button>)}
        </div>

        <div className="team-finish-row">
          <span>현재 과제 수행도</span>
          <strong className="team-count">{taskProgress ? `${taskProgress.done}/${taskProgress.total}` : '…'}</strong>
        </div>
        {taskProgress && remaining > 0 && <p className="team-inline-note">아직 완료하지 않은 과제가 {remaining}개 있어요. 그래도 종료할 수 있어요.</p>}
      <p className="team-inline-note">제출하면 이번 탐구 출석이 종료되고, 다시 시작할 수 없어요.</p>
      </div>

      {error && <p className="team-inline-error" role="alert">{error}</p>}
      <div className="team-button-row">
        <button type="submit" className="primary-button" disabled={busy}>{busy ? '제출 중...' : '제출'}</button>
        <button type="button" className="outline-button" onClick={onCancel} disabled={busy}>취소</button>
      </div>
    </form>
  )
}
