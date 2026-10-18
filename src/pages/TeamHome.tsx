import { ChangeEvent, useEffect, useRef, useState } from 'react'
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
type Journal = { id: string; op_day_id: string | null; journal_date: string; updated_at: string; file_path: string | null; file_name: string | null }
type TeacherReference = { display_name: string } | { display_name: string }[] | null
type JournalFeedback = { id: string; journal_id: string; content: string; created_at: string; teacher: TeacherReference }
type TeamMode = 'home' | 'calendar' | 'session' | 'tasks' | 'finish' | 'journal'

const AUTONOMOUS_DAY_ID = '__autonomous__'
const JOURNAL_BUCKET = 'experiment-journals'

function koreaDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()) }
function dateFromTimestamp(value: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(value)) }
function displayDate(value: string) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${value}T00:00:00`)) }

function teacherName(feedback: JournalFeedback) {
  const teacher = Array.isArray(feedback.teacher) ? feedback.teacher[0] : feedback.teacher
  const name = teacher?.display_name?.trim()
  return name ? `${name} 선생님` : '선생님'
}

export default function TeamHome({ profile, onSignOut }: TeamHomeProps) {
  const [opDays, setOpDays] = useState<OpDay[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [feedbackByJournal, setFeedbackByJournal] = useState<Record<string, JournalFeedback[]>>({})
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [selectedDayId, setSelectedDayId] = useState('')
  const [selectedAttendanceId, setSelectedAttendanceId] = useState('')
  const [journalDate, setJournalDate] = useState(koreaDate())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mode, setMode] = useState<TeamMode>('home')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [taskProgress, setTaskProgress] = useState<TaskProgress>(null)
  const historyPop = useRef(false)
  const historyInitialized = useRef(false)
  const teamId = profile.team_id

  async function loadTeamData() {
    if (!supabase || !teamId) return
    setLoading(true)
    const [daysResult, journalsResult, attendanceResult] = await Promise.all([
      supabase.from('op_days').select('id, date, title, starts_at, ends_at').order('date'),
      supabase.from('journals').select('id, op_day_id, journal_date, updated_at, file_path, file_name').eq('team_id', teamId).order('journal_date', { ascending: false }),
      supabase.from('attendance').select('id, team_id, op_day_id, started_at, ended_at, end_reason').eq('team_id', teamId).order('started_at', { ascending: false }),
    ])
    if (daysResult.error || journalsResult.error || attendanceResult.error) setError('팀 데이터를 불러오지 못했어요. DB 확장 SQL 적용 여부를 확인해 주세요.')
    const nextDays = (daysResult.data ?? []) as OpDay[]
    const nextJournals = (journalsResult.data ?? []) as Journal[]
    setOpDays(nextDays)
    setJournals(nextJournals)
    setAttendances((attendanceResult.data ?? []) as Attendance[])
    const journalIds = nextJournals.map((journal) => journal.id)
    if (journalIds.length > 0) {
      const { data } = await supabase.from('journal_feedback').select('id, journal_id, content, created_at, teacher:profiles!journal_feedback_teacher_id_fkey(display_name)').in('journal_id', journalIds).order('created_at')
      const grouped = ((data ?? []) as JournalFeedback[]).reduce<Record<string, JournalFeedback[]>>((current, feedback) => {
        current[feedback.journal_id] = [...(current[feedback.journal_id] ?? []), feedback]
        return current
      }, {})
      setFeedbackByJournal(grouped)
    } else setFeedbackByJournal({})
    setSelectedDayId((current) => current || nextDays.find((day) => day.date >= koreaDate())?.id || nextDays[0]?.id || '')
    setLoading(false)
  }

  useEffect(() => { void loadTeamData() }, [teamId])

  useEffect(() => {
    const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    window.history.replaceState({ ...currentState, openPhysicsScreen: 'team-home' }, '', window.location.href)
    historyInitialized.current = true
    function onPop(event: PopStateEvent) {
      const screen = event.state?.openPhysicsScreen
      if (!screen) return
      historyPop.current = true
      if (event.state?.opDayId) setSelectedDayId(event.state.opDayId)
      if (event.state?.attendanceId) setSelectedAttendanceId(event.state.attendanceId)
      if (event.state?.journalDate) setJournalDate(event.state.journalDate)
      setMode(screen === 'team-calendar' ? 'calendar' : screen === 'team-session' ? 'session' : screen === 'team-tasks' ? 'tasks' : screen === 'team-finish' ? 'finish' : screen === 'team-journal' ? 'journal' : 'home')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!historyInitialized.current) return
    if (historyPop.current) { historyPop.current = false; return }
    const screen = mode === 'calendar' ? 'team-calendar' : mode === 'session' ? 'team-session' : mode === 'tasks' ? 'team-tasks' : mode === 'finish' ? 'team-finish' : mode === 'journal' ? 'team-journal' : 'team-home'
    const state = { ...window.history.state, openPhysicsScreen: screen, opDayId: selectedDayId, attendanceId: selectedAttendanceId, journalDate }
    if (window.history.state?.openPhysicsScreen === screen && window.history.state?.attendanceId === selectedAttendanceId && window.history.state?.journalDate === journalDate) return
    window.history.pushState(state, '', window.location.href)
  }, [journalDate, mode, selectedAttendanceId, selectedDayId])

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === '[' && mode !== 'home') { event.preventDefault(); window.history.back() }
    }
    window.addEventListener('keydown', onKeydown, true)
    return () => window.removeEventListener('keydown', onKeydown, true)
  }, [mode])

  const todayDay = opDays.find((day) => day.date === koreaDate()) ?? null
  const activeAttendance = attendances.find((attendance) => attendance.ended_at === null) ?? null
  const selectedAttendance = attendances.find((attendance) => attendance.id === selectedAttendanceId) ?? activeAttendance
  const selectedDay = opDays.find((day) => day.id === selectedDayId)
  const sessionDay = selectedAttendance?.op_day_id ? opDays.find((day) => day.id === selectedAttendance.op_day_id) : undefined
  const shownSessionDay = sessionDay ?? (selectedAttendance ? { id: AUTONOMOUS_DAY_ID, date: dateFromTimestamp(selectedAttendance.started_at), title: '자율 탐구', starts_at: null, ends_at: null } : undefined)
  const currentJournal = journals.find((journal) => journal.journal_date === journalDate) ?? null
  const todayJournal = journals.find((journal) => journal.journal_date === koreaDate()) ?? null

  function openJournal(date = koreaDate()) { setError(''); setJournalDate(date); setSelectedFile(null); setMode('journal') }
  function selectAttendance(attendance: Attendance) { setSelectedAttendanceId(attendance.id); setSelectedDayId(attendance.op_day_id ?? AUTONOMOUS_DAY_ID); setMode('session') }

  async function startToday() {
    if (!supabase) { setError('Supabase 연결 정보가 없어요.'); return }
    setError('')
    if (activeAttendance) { selectAttendance(activeAttendance); return }
    try {
      const result = todayDay
        ? await supabase.rpc('start_attendance', { p_op_day_id: todayDay.id })
        : { data: await startAutonomousAttendance(), error: null }
      if (result.error || !result.data) throw result.error ?? new Error('출석 기록을 만들지 못했어요.')
      const attendance = result.data as Attendance
      setAttendances((current) => [attendance, ...current])
      selectAttendance(attendance)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '출석을 시작하지 못했어요.')
    }
  }

  async function uploadJournal() {
    if (!supabase || !teamId || !selectedFile) { setError('업로드할 PDF 파일을 선택해 주세요.'); return }
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) { setError('PDF 파일만 제출할 수 있어요.'); return }
    if (selectedFile.size > 15 * 1024 * 1024) { setError('PDF 파일은 15MB 이하만 업로드할 수 있어요.'); return }
    setSaving(true); setError('')
    const path = `${teamId}/${journalDate}/${crypto.randomUUID()}.pdf`
    const { error: uploadError } = await supabase.storage.from(JOURNAL_BUCKET).upload(path, selectedFile, { contentType: 'application/pdf' })
    if (uploadError) { setSaving(false); setError(`PDF 업로드에 실패했어요: ${uploadError.message}`); return }
    const { error: saveError } = await supabase.from('journals').upsert({ team_id: teamId, journal_date: journalDate, file_path: path, file_name: selectedFile.name, content: '' }, { onConflict: 'team_id,journal_date' })
    if (saveError) {
      await supabase.storage.from(JOURNAL_BUCKET).remove([path])
      setSaving(false); setError(`제출 기록을 저장하지 못했어요: ${saveError.message}`); return
    }
    if (currentJournal?.file_path) await supabase.storage.from(JOURNAL_BUCKET).remove([currentJournal.file_path])
    setSelectedFile(null); setSaving(false)
    await loadTeamData(); setMode('home')
  }

  async function openJournalPdf(journal: Journal) {
    if (!supabase || !journal.file_path) { setError('이전 양식으로 저장된 일지라 PDF 파일이 없어요.'); return }
    const { data, error: urlError } = await supabase.storage.from(JOURNAL_BUCKET).createSignedUrl(journal.file_path, 60)
    if (urlError || !data?.signedUrl) { setError('PDF를 열지 못했어요.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function deleteJournal() {
    if (!supabase || !currentJournal || !window.confirm('이 날짜의 실험일지 PDF를 삭제할까요? 삭제한 파일은 복구할 수 없습니다.')) return
    setSaving(true)
    const { error: deleteError } = await supabase.from('journals').delete().eq('id', currentJournal.id)
    if (!deleteError && currentJournal.file_path) await supabase.storage.from(JOURNAL_BUCKET).remove([currentJournal.file_path])
    setSaving(false)
    if (deleteError) { setError('실험일지를 삭제하지 못했어요.'); return }
    await loadTeamData(); setMode('home')
  }

  function handleFinished(attendance: Attendance) { setAttendances((current) => current.map((item) => item.id === attendance.id ? attendance : item)); setMode('home') }
  function openAttendanceForDay(opDayId: string) {
    const records = attendances.filter((attendance) => attendance.op_day_id === opDayId)
    const target = records.find((attendance) => attendance.ended_at === null) ?? records[0]
    if (target) selectAttendance(target)
  }

  if (mode === 'calendar') return <main className="app-shell team-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header><CalendarScreen opDays={opDays} today={koreaDate()} attendances={attendances} journals={journals} onOpenSession={openAttendanceForDay} onOpenJournal={() => openJournal()} /></main>

  if (mode === 'tasks' && selectedAttendance && selectedAttendance.ended_at === null && selectedDay && selectedAttendance.op_day_id === selectedDay.id) return <main className="app-shell team-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header><TasksScreen teamId={teamId!} day={selectedDay} onProgress={(done, total) => setTaskProgress({ done, total })} /></main>

  if ((mode === 'session' || mode === 'finish') && selectedAttendance && shownSessionDay) {
    const tasksAvailable = selectedAttendance.ended_at === null && selectedAttendance.op_day_id !== null
    return <main className="app-shell team-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header>{mode === 'session' ? <SessionScreen day={shownSessionDay} attendance={selectedAttendance} taskProgress={tasksAvailable ? taskProgress : null} tasksAvailable={tasksAvailable} onOpenTasks={() => { if (tasksAvailable) { setSelectedDayId(selectedAttendance.op_day_id!); setMode('tasks') } }} onWriteJournal={() => openJournal()} onOpenJournalList={() => setMode('home')} onFinish={() => setMode('finish')} /> : <FinishScreen day={shownSessionDay} attendance={selectedAttendance} taskProgress={tasksAvailable ? taskProgress : null} onFinished={handleFinished} onCancel={() => setMode('session')} />}</main>
  }

  if (mode === 'journal') return <main className="app-shell journal-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => window.history.back()} type="button">← 이전으로</button></header><section className="journal-editor pdf-journal-editor"><div className="journal-editor-intro"><p className="eyebrow">PDF EXPERIMENT JOURNAL</p><h1>실험일지 PDF 제출</h1><p>OP Day와 관계없이 날짜별로 PDF 한 개를 제출할 수 있어요. 같은 날짜에 다시 올리면 기존 파일이 새 파일로 교체됩니다.</p><p><b>제출 형식은 PDF만 가능합니다.</b> HWP, Word, 이미지 등 다른 파일은 제출할 수 없어요. 파일 크기는 15MB 이하로 준비해 주세요.</p></div>{error && <p className="error">{error}</p>}<label className="journal-date-input">기록 날짜<input type="date" value={journalDate} max={koreaDate()} onChange={(event) => { setJournalDate(event.target.value); setSelectedFile(null) }} /></label><section className="pdf-upload-card"><strong>{displayDate(journalDate)}</strong>{currentJournal?.file_name ? <p>현재 제출본: <b>{currentJournal.file_name}</b></p> : <p>아직 이 날짜에 제출한 PDF가 없어요.</p>}{currentJournal?.file_path && <button className="outline-button" onClick={() => void openJournalPdf(currentJournal)} type="button">현재 PDF 열기</button>}<label className="pdf-file-input">새 PDF 선택 (PDF만 가능)<input accept="application/pdf,.pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setSelectedFile(event.target.files?.[0] ?? null)} type="file" />{selectedFile && <span>{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)}MB</span>}</label></section><div className="journal-actions">{currentJournal && <button className="danger-button" disabled={saving} onClick={() => void deleteJournal()} type="button">일지 삭제</button>}<button className="outline-button" onClick={() => setMode('home')} type="button">나중에 제출하기</button><button className="primary-button" disabled={saving || !selectedFile} onClick={() => void uploadJournal()} type="button">{saving ? '업로드 중...' : currentJournal ? '새 PDF로 교체 제출' : 'PDF 제출하기'}</button></div></section></main>

  return <main className="app-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={onSignOut} type="button">로그아웃</button></header><section className="hero-panel"><p className="eyebrow">WELCOME BACK</p><h1>{profile.display_name} 팀, 오늘도 탐구해 볼까요?</h1><p>기록은 작은 관찰에서 시작됩니다.</p></section>{error && <p className="error">{error}</p>}<section className="dashboard-grid"><button className="card date-card team-card-button" onClick={() => setMode('calendar')} type="button"><p>다음 OP DAY</p><strong>{loading ? '일정을 불러오는 중...' : selectedDay?.title ?? '일정이 아직 없어요'}</strong><span>{selectedDay ? selectedDay.date : '선생님이 일정을 등록하면 표시됩니다.'}</span><small>달력에서 일정과 과제 보기 →</small></button><button className="card attendance-card team-card-button" onClick={() => void startToday()} type="button"><p>오늘의 출석</p><strong>{activeAttendance ? '탐구 진행 중' : '출석 시작'}</strong><span>{activeAttendance ? '진행 중인 출석 기록을 이어서 볼 수 있어요.' : todayDay ? todayDay.title : '자율 탐구로 시작할 수 있어요.'}</span><small>{activeAttendance ? '진행 기록 이어보기 →' : '같은 날에도 종료 후 다시 시작할 수 있어요 →'}</small></button><article className="card wide-card"><div><p>실험일지 PDF</p><h2>{todayJournal ? '오늘 제출한 PDF를 확인하거나 교체하세요.' : '오늘의 실험일지 PDF를 제출해 보세요.'}</h2><span>OP Day가 아닌 날에도 날짜별로 PDF 한 개를 제출할 수 있습니다.</span></div><button className="outline-button" onClick={() => openJournal()} type="button">{todayJournal ? 'PDF 열기·교체 →' : 'PDF 제출 →'}</button></article></section><section className="team-journal-history"><div><p className="eyebrow">SAVED PDF JOURNALS</p><h2>제출한 실험일지</h2></div>{journals.length === 0 ? <p className="muted">아직 제출한 PDF가 없어요.</p> : <div className="history-list">{journals.map((journal) => <button key={journal.id} onClick={() => { setJournalDate(journal.journal_date); setMode('journal') }} type="button"><strong>{displayDate(journal.journal_date)}</strong><span>{journal.file_name ?? '기존 양식 기록'} · 열기 또는 교체 제출</span>{feedbackByJournal[journal.id]?.map((feedback) => <span className="journal-feedback-preview" key={feedback.id}><b>{teacherName(feedback)}</b>{feedback.content}</span>)}</button>)}</div>}</section></main>
}
