import { useEffect, useRef, useState } from 'react'
import { downloadJournalPdf } from '../journals/downloadPdf'
import JournalDocument from '../journals/JournalDocument'
import { JOURNAL_TEMPLATES, templateTypes, type JournalTemplateType } from '../journals/templates'
import { supabase } from '../lib/supabase'
import CalendarScreen from './team/screens/CalendarScreen'
import FinishScreen from './team/screens/FinishScreen'
import SessionScreen, { type TaskProgress } from './team/screens/SessionScreen'
import TasksScreen from './team/screens/TasksScreen'
import { startAutonomousAttendance, type Attendance, type OpDay as TeamOpDay } from './team/teamApi'
import './team/team.css'
import type { Profile } from '../types'

type TeamHomeProps = { profile: Profile; onSignOut: () => void }
type OpDay = TeamOpDay
type Journal = { id: string; op_day_id: string; created_at: string; updated_at: string; template_type: JournalTemplateType; form_data: Record<string, string> | null }
type TeacherReference = { display_name: string } | { display_name: string }[] | null
type JournalFeedback = { id: string; journal_id: string; content: string; created_at: string; teacher: TeacherReference }
type JournalMode = 'home' | 'choose' | 'edit' | 'calendar' | 'session' | 'tasks' | 'finish'
const AUTONOMOUS_DAY_ID = '__autonomous__'

function koreaDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()) }

function teacherName(feedback: JournalFeedback) {
  const teacher = Array.isArray(feedback.teacher) ? feedback.teacher[0] : feedback.teacher
  const name = teacher?.display_name?.trim()
  return name ? `${name} 선생님` : '선생님'
}

export default function TeamHome({ profile, onSignOut }: TeamHomeProps) {
  const [opDays, setOpDays] = useState<OpDay[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [feedbackByJournal, setFeedbackByJournal] = useState<Record<string, JournalFeedback[]>>({})
  const [selectedDayId, setSelectedDayId] = useState('')
  const [templateType, setTemplateType] = useState<JournalTemplateType>('basic')
  const [journalData, setJournalData] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<JournalMode>('home')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [taskProgress, setTaskProgress] = useState<TaskProgress>(null)
  const journalRef = useRef<HTMLDivElement>(null)
  const historyPop = useRef(false)
  const historyInitialized = useRef(false)
  const teamId = profile.team_id

  async function loadTeamData() {
    if (!supabase || !teamId) return
    setLoading(true)
    const [daysResult, journalsResult, attendanceResult] = await Promise.all([
      supabase.from('op_days').select('id, date, title, starts_at, ends_at').order('date'),
      supabase.from('journals').select('id, op_day_id, created_at, updated_at, template_type, form_data').eq('team_id', teamId).order('updated_at', { ascending: false }),
      supabase.from('attendance').select('id, team_id, op_day_id, started_at, ended_at, end_reason').eq('team_id', teamId),
    ])
    if (daysResult.error || journalsResult.error || attendanceResult.error) setError('팀 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    const nextDays = (daysResult.data ?? []) as OpDay[]
    setOpDays(nextDays)
    const journalRows = (journalsResult.data ?? []) as Journal[]
    setJournals(journalRows)
    setAttendances((attendanceResult.data ?? []) as Attendance[])
    const journalIds = journalRows.map((journal) => journal.id)
    if (journalIds.length > 0) {
      const { data: feedbackRows, error: feedbackError } = await supabase.from('journal_feedback').select('id, journal_id, content, created_at, teacher:profiles!journal_feedback_teacher_id_fkey(display_name)').in('journal_id', journalIds).order('created_at')
      if (feedbackError) setError('교사 피드백을 불러오지 못했어요.')
      const groupedFeedback = ((feedbackRows ?? []) as JournalFeedback[]).reduce<Record<string, JournalFeedback[]>>((current, feedback) => {
        current[feedback.journal_id] = [...(current[feedback.journal_id] ?? []), feedback]
        return current
      }, {})
      setFeedbackByJournal(groupedFeedback)
    } else {
      setFeedbackByJournal({})
    }
    setSelectedDayId((current) => current || nextDays.find((day) => day.date >= koreaDate())?.id || nextDays[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => { void loadTeamData() }, [teamId])

  useEffect(() => {
    const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    window.history.replaceState({ ...currentState, openPhysicsScreen: 'team-home' }, '', window.location.href)
    historyInitialized.current = true

    function handleHistoryChange(event: PopStateEvent) {
      const screen = event.state?.openPhysicsScreen
      if (!screen) return
      historyPop.current = true
      if (event.state?.opDayId) setSelectedDayId(event.state.opDayId)
      const nextMode: JournalMode = screen === 'team-calendar' ? 'calendar' : screen === 'team-session' ? 'session' : screen === 'team-tasks' ? 'tasks' : screen === 'team-finish' ? 'finish' : screen === 'team-journal-edit' ? 'edit' : screen === 'team-journal-choose' ? 'choose' : 'home'
      setMode(nextMode)
    }

    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    if (!historyInitialized.current) return
    if (historyPop.current) {
      historyPop.current = false
      return
    }
    const screen = mode === 'edit' ? 'team-journal-edit' : mode === 'choose' ? 'team-journal-choose' : mode === 'calendar' ? 'team-calendar' : mode === 'session' ? 'team-session' : mode === 'tasks' ? 'team-tasks' : mode === 'finish' ? 'team-finish' : 'team-home'
    if (window.history.state?.openPhysicsScreen === screen && window.history.state?.opDayId === selectedDayId) return
    window.history.pushState({ ...window.history.state, openPhysicsScreen: screen, opDayId: selectedDayId }, '', window.location.href)
  }, [mode, selectedDayId])

  useEffect(() => {
    function handleBackShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key !== '[' || mode === 'home') return
      event.preventDefault()
      window.history.back()
    }

    window.addEventListener('keydown', handleBackShortcut, true)
    return () => window.removeEventListener('keydown', handleBackShortcut, true)
  }, [mode])

  const selectedDay = opDays.find((day) => day.id === selectedDayId) ?? (selectedDayId === AUTONOMOUS_DAY_ID ? {
    id: AUTONOMOUS_DAY_ID, date: koreaDate(), title: '자율 탐구', starts_at: null, ends_at: null,
  } : undefined)
  const currentJournal = journals.find((journal) => journal.op_day_id === selectedDayId)

  function openJournal(dayId = selectedDayId) {
    if (!dayId) { setError('선생님이 OP 일정을 등록한 후 실험일지를 만들 수 있어요.'); return }
    const journal = journals.find((item) => item.op_day_id === dayId)
    setSelectedDayId(dayId)
    if (journal) {
      setTemplateType(journal.template_type)
      setJournalData(journal.form_data ?? {})
      setMode('edit')
      return
    }
    setTemplateType('basic')
    setJournalData({})
    setMode('choose')
  }

  async function saveJournal() {
    if (!supabase || !teamId || !selectedDayId) return
    setSaving(true); setError('')
    const payload = { template_type: templateType, form_data: journalData }
    const result = currentJournal
      ? await supabase.from('journals').update(payload).eq('id', currentJournal.id)
      : await supabase.from('journals').insert({ ...payload, team_id: teamId, op_day_id: selectedDayId })
    setSaving(false)
    if (result.error) { setError('일지를 저장하지 못했어요. DB 확장 SQL 적용 여부를 확인해 주세요.'); return }
    await loadTeamData()
    setMode('home')
  }

  async function deleteJournal() {
    if (!supabase || !currentJournal) return
    const shouldDelete = window.confirm('이 실험일지를 삭제할까요? 삭제한 내용은 복구할 수 없습니다.')
    if (!shouldDelete) return

    setSaving(true)
    setError('')
    const { error: deleteError } = await supabase.from('journals').delete().eq('id', currentJournal.id)
    setSaving(false)
    if (deleteError) {
      setError('일지를 삭제하지 못했어요. 일지 삭제 권한 SQL이 적용되었는지 확인해 주세요.')
      return
    }
    setJournalData({})
    await loadTeamData()
    setMode('home')
  }

  async function handleDownload() {
    if (!journalRef.current) return
    await downloadJournalPdf(journalRef.current, `${profile.display_name}-${selectedDay?.title ?? '실험일지'}`)
  }

  function changeTemplate(nextTemplateType: JournalTemplateType) {
    if (nextTemplateType === templateType) return
    const shouldChange = window.confirm('양식을 바꾸면 지금까지 작성한 내용이 모두 삭제됩니다. 계속할까요?')
    if (!shouldChange) return
    setTemplateType(nextTemplateType)
    setJournalData({})
  }

  const todayDay = opDays.find((day) => day.date === koreaDate()) ?? null
  const todayAttendance = attendances.find((attendance) => attendance.op_day_id === todayDay?.id)
    ?? attendances.find((attendance) => attendance.op_day_id === null && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(attendance.started_at)) === koreaDate())
    ?? null
  const selectedAttendance = selectedDayId === AUTONOMOUS_DAY_ID
    ? attendances.find((attendance) => attendance.op_day_id === null && attendance.ended_at === null) ?? todayAttendance
    : attendances.find((attendance) => attendance.op_day_id === selectedDayId) ?? null

  async function startToday() {
    if (!supabase) {
      setError('Supabase 연결 정보가 없어요.')
      return
    }
    setError('')
    const existing = todayDay
      ? attendances.find((attendance) => attendance.op_day_id === todayDay.id)
      : attendances.find((attendance) => attendance.op_day_id === null && attendance.ended_at === null)
    if (existing) {
      setSelectedDayId(todayDay?.id ?? AUTONOMOUS_DAY_ID)
      setMode('session')
      return
    }
    if (!todayDay) {
      try {
        const autonomous = await startAutonomousAttendance()
        setAttendances((current) => [...current, autonomous])
        setSelectedDayId(AUTONOMOUS_DAY_ID)
        setMode('session')
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : '자율 출석을 시작하지 못했어요.')
      }
      return
    }
    const { data, error: startError } = await supabase.rpc('start_attendance', { p_op_day_id: todayDay.id })
    if (startError) {
      setError(startError.message.includes('scheduled day') ? '출석은 일정 당일에만 시작할 수 있어요.' : '출석을 시작하지 못했어요.')
      return
    }
    setAttendances((current) => [...current, data as Attendance])
    setSelectedDayId(todayDay.id)
    setMode('session')
  }

  function openTeamScreen(nextMode: JournalMode, opDayId = selectedDayId) {
    if (opDayId) setSelectedDayId(opDayId)
    setMode(nextMode)
  }

  function handleFinished(attendance: Attendance) {
    setAttendances((current) => [...current.filter((item) => item.id !== attendance.id), attendance])
    setMode('home')
  }

  if (mode === 'calendar') return <main className="app-shell team-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header><CalendarScreen opDays={opDays} today={koreaDate()} attendances={attendances} journals={journals} onOpenSession={(opDayId) => openTeamScreen('session', opDayId)} onOpenTasks={(opDayId) => openTeamScreen('tasks', opDayId)} onOpenJournal={(opDayId) => openJournal(opDayId)} /></main>

  if (mode === 'tasks' && selectedDay && selectedDayId !== AUTONOMOUS_DAY_ID) return <main className="app-shell team-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header><TasksScreen teamId={teamId!} day={selectedDay} onProgress={(done, total) => setTaskProgress({ done, total })} /></main>

  if ((mode === 'session' || mode === 'finish') && selectedDay && selectedAttendance) {
    return <main className="app-shell team-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header>{mode === 'session' ? <SessionScreen day={selectedDay} attendance={selectedAttendance} taskProgress={selectedDayId === AUTONOMOUS_DAY_ID ? null : taskProgress} autonomous={selectedDayId === AUTONOMOUS_DAY_ID} onOpenTasks={() => setMode('tasks')} onWriteJournal={openJournal} onOpenJournalList={() => setMode('home')} onFinish={() => setMode('finish')} /> : <FinishScreen day={selectedDay} attendance={selectedAttendance} taskProgress={taskProgress} autonomous={selectedDayId === AUTONOMOUS_DAY_ID} onFinished={handleFinished} onCancel={() => setMode('session')} />}</main>
  }

  if (mode === 'choose') return <main className="app-shell journal-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => setMode('home')} type="button">돌아가기</button></header><section className="journal-choice"><p className="eyebrow">NEW EXPERIMENT JOURNAL</p><h1>오늘 기록할 양식을 골라 주세요.</h1><p>{selectedDay?.title ?? 'OP DAY'}의 기록은 선택한 양식으로 저장돼요.</p><div className="template-grid">{templateTypes.map((type) => { const template = JOURNAL_TEMPLATES[type]; return <button className={templateType === type ? 'selected' : ''} key={type} onClick={() => setTemplateType(type)} type="button"><span>{template.subtitle}</span><h2>{template.name}</h2><p>{template.description}</p></button> })}</div><button className="primary-button journal-start-button" onClick={() => setMode('edit')} type="button">이 양식으로 작성하기 <span>→</span></button></section></main>

  if (mode === 'edit') return <main className="app-shell journal-shell"><header className="topbar"><strong>Open Physics</strong><div><button onClick={handleDownload} type="button">PDF 다운로드</button><button onClick={() => setMode('home')} type="button">← 이전으로</button></div></header><section className="journal-editor"><div className="journal-editor-intro"><p className="eyebrow">{selectedDay?.title ?? 'OP DAY'}</p><h1>실험일지 작성</h1><p>모든 변경 사항은 저장 버튼을 눌러 기록해 주세요.</p>{currentJournal && <label className="template-change">양식 변경<select value={templateType} onChange={(event) => changeTemplate(event.target.value as JournalTemplateType)}>{templateTypes.map((type) => <option key={type} value={type}>{JOURNAL_TEMPLATES[type].name} · {JOURNAL_TEMPLATES[type].subtitle}</option>)}</select></label>}</div>{error && <p className="error">{error}</p>}<div ref={journalRef}><JournalDocument templateType={templateType} data={journalData} onChange={(key, value) => setJournalData((current) => ({ ...current, [key]: value }))} /></div><div className="journal-actions">{currentJournal && <button className="danger-button" disabled={saving} onClick={() => void deleteJournal()} type="button">일지 삭제</button>}<button className="outline-button" onClick={() => setMode('home')} type="button">나중에 작성하기</button><button className="primary-button" disabled={saving} onClick={() => void saveJournal()} type="button">{saving ? '저장 중...' : '실험일지 저장하기'} <span>→</span></button></div></section></main>

  return <main className="app-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={onSignOut} type="button">로그아웃</button></header><section className="hero-panel"><p className="eyebrow">WELCOME BACK</p><h1>{profile.display_name} 팀, 오늘도 탐구해 볼까요?</h1><p>기록은 작은 관찰에서 시작됩니다.</p></section>{error && <p className="error">{error}</p>}<section className="dashboard-grid"><button className="card date-card team-card-button" onClick={() => setMode('calendar')} type="button"><p>다음 OP DAY</p><strong>{loading ? '일정을 불러오는 중...' : selectedDay?.title ?? '일정이 아직 없어요'}</strong><span>{selectedDay ? selectedDay.date : '선생님이 일정을 등록하면 표시됩니다.'}</span><small>달력에서 일정과 과제 보기 →</small></button><button className="card attendance-card team-card-button" onClick={() => void startToday()} type="button"><p>오늘의 출석</p><strong>{todayAttendance?.ended_at ? '출석 완료' : todayAttendance ? '탐구 진행 중' : '출석 시작'}</strong><span>{todayDay ? todayDay.title : '자율 탐구로 시작할 수 있어요.'}</span></button><article className="card wide-card"><div><p>실험일지</p><h2>{currentJournal ? `${JOURNAL_TEMPLATES[currentJournal.template_type].name} 일지를 이어서 작성하세요.` : '오늘의 실험을 기록해 보세요.'}</h2><span>선택한 양식은 선생님 화면에도 같은 형식으로 표시됩니다.</span></div><button className="outline-button" onClick={() => openJournal()} type="button">{currentJournal ? '일지 이어쓰기 →' : '실험일지 작성 →'}</button></article></section><section className="team-journal-history"><div><p className="eyebrow">SAVED JOURNALS</p><h2>저장한 실험일지</h2></div>{journals.length === 0 ? <p className="muted">아직 저장한 일지가 없어요.</p> : <div className="history-list">{journals.map((journal) => <button key={journal.id} onClick={() => { setSelectedDayId(journal.op_day_id); setTemplateType(journal.template_type); setJournalData(journal.form_data ?? {}); setMode('edit') }} type="button"><strong>{opDays.find((day) => day.id === journal.op_day_id)?.title ?? 'OP DAY'}</strong><span>{JOURNAL_TEMPLATES[journal.template_type].name} · 열어서 수정하기</span>{feedbackByJournal[journal.id]?.map((feedback) => <span className="journal-feedback-preview" key={feedback.id}><b>{teacherName(feedback)}</b>{feedback.content}</span>)}</button>)}</div>}</section></main>
}
