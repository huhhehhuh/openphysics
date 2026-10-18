// 설계도 ④: [오늘의 과제 보기] 화면. 과제 이름 옆 체크박스.
// 체크하면 task_completions 에 우리 팀 완료 기록을 추가하고, 체크를 풀면 그 기록을 지웁니다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCompletedTaskIds, fetchTasks, friendlyError, setTaskCompleted, type OpDay, type Task } from '../teamApi'
import { formatDayLong } from '../time'

type Props = {
  teamId: string
  day: OpDay
  onProgress: (done: number, total: number) => void
}

export default function TasksScreen({ teamId, day, onProgress }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [done, setDone] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true)
    setLoadError('')
    setSaveError('')
    try {
      const list = await fetchTasks(day.id)
      const completed = await fetchCompletedTaskIds(teamId, list.map((t) => t.id))
      if (isCancelled()) return
      setTasks(list)
      setDone(completed)
    } catch (err) {
      if (!isCancelled()) setLoadError(friendlyError(err))
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [teamId, day.id])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => { cancelled = true }
  }, [load])

  const completedCount = tasks.filter((t) => done.has(t.id)).length

  // 완료 수가 바뀌면 진행 중 화면의 "3/5" 숫자도 함께 바뀌도록 알려 줍니다.
  // (부모가 매번 새 함수를 넘겨도 무한 반복되지 않도록 최신 함수를 ref 에 보관합니다.)
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress
  useEffect(() => {
    if (!loading && !loadError) onProgressRef.current(completedCount, tasks.length)
  }, [completedCount, tasks.length, loading, loadError])

  async function toggle(task: Task) {
    const nextDone = !done.has(task.id)
    // 화면을 먼저 바꾸고(빠른 반응), 저장에 실패하면 원래대로 되돌립니다.
    const apply = (value: boolean) => setDone((set) => {
      const copy = new Set(set)
      if (value) copy.add(task.id)
      else copy.delete(task.id)
      return copy
    })
    apply(nextDone)
    setPending((set) => new Set(set).add(task.id))
    setSaveError('')
    try {
      await setTaskCompleted(teamId, task.id, nextDone)
    } catch (err) {
      apply(!nextDone)
      setSaveError(`'${task.title}' 저장 실패 — ${friendlyError(err)}`)
    } finally {
      setPending((set) => {
        const copy = new Set(set)
        copy.delete(task.id)
        return copy
      })
    }
  }

  const percent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <section className="team-screen">
      <p className="eyebrow">{formatDayLong(day.date)}</p>
      <h1 className="team-screen-title">오늘의 과제</h1>

      {loading ? (
        <div className="team-state" aria-busy="true"><span className="team-spinner" />과제를 불러오는 중...</div>
      ) : loadError ? (
        <div className="team-state team-state-error" role="alert">
          <strong>과제를 불러오지 못했어요.</strong>
          <span>{loadError}</span>
          <button type="button" className="outline-button" onClick={() => load()}>다시 시도</button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="team-state"><strong>등록된 과제가 없어요.</strong><span>선생님이 이 일정에 과제를 추가하면 여기에 나타나요.</span></div>
      ) : (
        <>
          <div className="team-finish-row">
            <span>{completedCount === tasks.length ? '모든 과제를 완료했어요!' : `${tasks.length - completedCount}개 남았어요`}</span>
            <strong className="team-count" aria-label={`${tasks.length}개 중 ${completedCount}개 완료`}>{completedCount}/{tasks.length}</strong>
          </div>
          <div className="team-progress" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
          <ul className="team-task-list">
            {tasks.map((task) => {
              const isDone = done.has(task.id)
              return (
                <li key={task.id}>
                  <label className={isDone ? 'is-done' : ''}>
                    <span>{task.title}</span>
                    <input type="checkbox" checked={isDone} disabled={pending.has(task.id)} onChange={() => toggle(task)} />
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {saveError && <p className="team-inline-error" role="alert">{saveError}</p>}
    </section>
  )
}
