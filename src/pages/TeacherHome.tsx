import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { downloadJournalPdf } from '../journals/downloadPdf'
import JournalDocument from '../journals/JournalDocument'
import { JOURNAL_TEMPLATES, type JournalTemplateType } from '../journals/templates'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

type TeacherHomeProps = { profile: Profile; onSignOut: () => void }
type OpDay = { id: string; date: string; title: string }
type Attendance = { id: string; team_id: string; op_day_id: string; ended_at: string | null }
type Journal = { id: string; team_id: string; op_day_id: string; updated_at: string; template_type: JournalTemplateType; form_data: Record<string, string> }
type Feedback = { id: string; content: string; created_at: string }
type Team = { id: string; name: string }
type View = 'overview' | 'schedule' | 'attendance' | 'journals'

const dateFormatter = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

function formatDate(value: string) { return dateFormatter.format(new Date(`${value}T00:00:00`)) }
function localDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()) }

function relativeDay(value: string) {
  const today = new Date(`${localDate()}T00:00:00`).getTime()
  const target = new Date(`${value}T00:00:00`).getTime()
  const difference = Math.round((target - today) / 86_400_000)
  return difference === 0 ? '오늘' : difference === 1 ? '내일' : difference > 1 ? `${difference}일 후` : '지난 일정'
}

export default function TeacherHome({ profile, onSignOut }: TeacherHomeProps) {
  const [view, setView] = useState<View>('overview')
  const [opDays, setOpDays] = useState<OpDay[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [journals, setJournals] = useState<Journal[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const journalRef = useRef<HTMLDivElement>(null)

  async function loadDashboard() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const [opDaysResult, attendanceResult, journalsResult, teamsResult] = await Promise.all([
      supabase.from('op_days').select('id, date, title').order('date'),
      supabase.from('attendance').select('id, team_id, op_day_id, ended_at').order('started_at', { ascending: false }),
      supabase.from('journals').select('id, team_id, op_day_id, updated_at, template_type, form_data').order('updated_at', { ascending: false }),
      supabase.from('teams').select('id, name').order('name'),
    ])
    const firstError = [opDaysResult, attendanceResult, journalsResult, teamsResult].find((result) => result.error)?.error
    if (firstError) setError('대시보드 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    setOpDays((opDaysResult.data ?? []) as OpDay[])
    setAttendance((attendanceResult.data ?? []) as Attendance[])
    setJournals((journalsResult.data ?? []) as Journal[])
    setTeams((teamsResult.data ?? []) as Team[])
    setLoading(false)
  }

  useEffect(() => { void loadDashboard() }, [])

  const teamNames = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams])
  const upcomingDays = opDays.filter((day) => day.date >= localDate()).slice(0, 3)
  const todayOpDay = opDays.find((day) => day.date === localDate())
  const todayAttendance = todayOpDay ? attendance.filter((item) => item.op_day_id === todayOpDay.id) : []
  const completedToday = todayAttendance.filter((item) => item.ended_at).length

  async function createSchedule(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !scheduleTitle.trim() || !scheduleDate) return
    setSaving(true)
    setError('')
    const { error: insertError } = await supabase.from('op_days').insert({ title: scheduleTitle.trim(), date: scheduleDate })
    setSaving(false)
    if (insertError) {
      setError(insertError.code === '23505' ? '해당 날짜에는 이미 OP 일정이 있어요.' : '일정을 저장하지 못했어요.')
      return
    }
    setScheduleTitle(''); setScheduleDate(''); setShowScheduleForm(false)
    await loadDashboard()
  }

  const navigation: Array<{ id: View; label: string }> = [
    { id: 'overview', label: '대시보드' }, { id: 'schedule', label: 'OP 일정' },
    { id: 'attendance', label: '출결 현황' }, { id: 'journals', label: '실험일지' },
  ]

  const titleFor = (opDayId: string) => opDays.find((day) => day.id === opDayId)?.title ?? 'OP DAY'

  async function openJournal(journal: Journal) {
    if (!supabase) return
    setSelectedJournal(journal)
    setFeedbackText('')
    const { data, error: feedbackError } = await supabase.from('journal_feedback').select('id, content, created_at').eq('journal_id', journal.id).order('created_at')
    if (feedbackError) setError('피드백을 불러오지 못했어요.')
    setFeedback((data ?? []) as Feedback[])
  }

  async function saveFeedback(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !selectedJournal || !feedbackText.trim()) return
    setFeedbackSaving(true)
    const { error: feedbackError } = await supabase.from('journal_feedback').insert({ journal_id: selectedJournal.id, teacher_id: profile.id, content: feedbackText.trim() })
    setFeedbackSaving(false)
    if (feedbackError) { setError('피드백을 저장하지 못했어요.'); return }
    setFeedbackText('')
    await openJournal(selectedJournal)
  }

  return <main className="teacher-shell">
    <header className="teacher-topbar">
      <button className="wordmark" onClick={() => setView('overview')} type="button">Open Physics</button>
      <div className="teacher-account"><span>{profile.display_name} 선생님</span><button onClick={onSignOut} type="button">로그아웃</button></div>
    </header>
    <div className="teacher-layout">
      <aside className="teacher-sidebar" aria-label="교사 메뉴">
        <div className="teacher-profile-mark">OP</div>
        <nav>{navigation.map((item) => <button className={view === item.id ? 'active' : ''} key={item.id} onClick={() => setView(item.id)} type="button">{item.label}</button>)}</nav>
        <p>OPEN PHYSICS<br />TEACHER SPACE</p>
      </aside>
      <section className="teacher-content">
        {error && <div className="teacher-notice" role="alert">{error}<button onClick={() => void loadDashboard()} type="button">다시 불러오기</button></div>}
        {view !== 'overview' && !selectedJournal && <button className="back-button" onClick={() => setView('overview')} type="button">← 이전으로</button>}
        {view === 'overview' && <>
          <section className="teacher-heading"><p className="eyebrow">TEACHER DASHBOARD · 2026</p><h1>좋은 아침이에요,<br /><em>{profile.display_name}</em> 선생님.</h1><p>오늘의 Open Physics를 한눈에 확인하세요.</p></section>
          <section className="teacher-metrics" aria-label="오늘의 현황">
            <article><span>등록된 참여팀</span><strong>{loading ? '–' : teams.length}</strong><small>함께 탐구하는 팀</small></article>
            <article><span>오늘 출석 시작</span><strong>{loading ? '–' : todayAttendance.length}</strong><small>{todayOpDay ? todayOpDay.title : '오늘은 OP 일정이 없어요'}</small></article>
            <article><span>오늘 출석 종료</span><strong>{loading ? '–' : completedToday}</strong><small>기록을 마친 팀</small></article>
            <article><span>작성된 실험일지</span><strong>{loading ? '–' : journals.length}</strong><small>전체 저장 기록</small></article>
          </section>
          <section className="teacher-panels">
            <article className="teacher-panel upcoming-panel"><div className="panel-title"><div><p>UPCOMING OP DAY</p><h2>다가오는 일정</h2></div><button className="text-button" onClick={() => setView('schedule')} type="button">전체 보기 →</button></div><div className="schedule-list">{loading ? <p className="empty-copy">일정을 불러오는 중이에요.</p> : upcomingDays.length === 0 ? <p className="empty-copy">아직 등록된 일정이 없어요.<br />첫 OP DAY를 만들어 보세요.</p> : upcomingDays.map((day) => <button className="schedule-row" key={day.id} onClick={() => setView('schedule')} type="button"><span className="date-badge"><b>{new Date(`${day.date}T00:00:00`).getDate()}</b><small>{new Date(`${day.date}T00:00:00`).toLocaleDateString('ko-KR', { month: 'short' })}</small></span><span><strong>{day.title}</strong><small>{formatDate(day.date)} · {relativeDay(day.date)}</small></span><i>→</i></button>)}</div></article>
            <article className="teacher-panel attendance-summary"><div className="panel-title"><div><p>LIVE ATTENDANCE</p><h2>오늘의 출결</h2></div><button className="text-button" onClick={() => setView('attendance')} type="button">상세 보기 →</button></div>{todayOpDay ? <><div className="attendance-number"><strong>{todayAttendance.length}</strong><span>/ {teams.length} 팀 출석 시작</span></div><div className="attendance-progress"><span style={{ width: `${teams.length ? (todayAttendance.length / teams.length) * 100 : 0}%` }} /></div><p className="attendance-caption">{completedToday}팀이 오늘의 기록을 마쳤어요.</p></> : <p className="empty-copy">오늘 등록된 OP 일정이 없어요.</p>}</article>
            <article className="teacher-panel journals-panel"><div className="panel-title"><div><p>JOURNAL INBOX</p><h2>최근 실험일지</h2></div><button className="text-button" onClick={() => setView('journals')} type="button">모두 보기 →</button></div><div className="journal-list">{loading ? <p className="empty-copy">일지를 불러오는 중이에요.</p> : journals.length === 0 ? <p className="empty-copy">아직 저장된 실험일지가 없어요.</p> : journals.slice(0, 4).map((journal) => <div className="journal-row" key={journal.id}><span className="journal-icon">⌁</span><span><strong>{teamNames.get(journal.team_id) ?? '참여팀'}</strong><small>{titleFor(journal.op_day_id)} · {new Date(journal.updated_at).toLocaleDateString('ko-KR')}</small></span><button onClick={() => { setView('journals'); void openJournal(journal) }} type="button">보기</button></div>)}</div></article>
          </section>
        </>}
        {view === 'schedule' && <section className="management-view"><div className="management-heading"><div><p className="eyebrow">OP DAY PLANNER</p><h1>OP 일정 관리</h1><p>일정을 만든 뒤 다음 단계에서 과제를 연결할 수 있어요.</p></div><button className="primary-button compact" onClick={() => setShowScheduleForm(!showScheduleForm)} type="button">{showScheduleForm ? '취소' : '+ 일정 추가'}</button></div>{showScheduleForm && <form className="schedule-form" onSubmit={createSchedule}><label>일정 제목<input value={scheduleTitle} onChange={(event) => setScheduleTitle(event.target.value)} placeholder="예: 10월 OP DAY" required /></label><label>날짜<input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} required /></label><button className="primary-button compact" disabled={saving} type="submit">{saving ? '저장 중...' : '일정 저장'}</button></form>}<div className="management-list">{opDays.length === 0 ? <p className="empty-copy">등록된 OP 일정이 없어요.</p> : opDays.map((day) => <article key={day.id}><span>{formatDate(day.date)}</span><strong>{day.title}</strong><small>{relativeDay(day.date)}</small></article>)}</div></section>}
        {view === 'attendance' && <section className="management-view"><div className="management-heading"><div><p className="eyebrow">ATTENDANCE LOG</p><h1>팀별 출결 현황</h1><p>출석 시작과 종료 기록을 확인할 수 있어요.</p></div></div><div className="management-list">{attendance.length === 0 ? <p className="empty-copy">아직 출석 기록이 없어요.</p> : attendance.map((item) => <article key={item.id}><span>{teamNames.get(item.team_id) ?? '참여팀'}</span><strong>{titleFor(item.op_day_id)}</strong><small>{item.ended_at ? '출석 종료' : '현재 진행 중'}</small></article>)}</div></section>}
        {view === 'journals' && <section className="management-view"><div className="management-heading"><div><p className="eyebrow">EXPERIMENT JOURNALS</p><h1>실험일지 관리</h1><p>팀이 선택한 양식 그대로 읽고 피드백을 남길 수 있어요.</p></div></div>{selectedJournal ? <div className="journal-review"><div className="journal-review-bar"><button className="text-button" onClick={() => setSelectedJournal(null)} type="button">← 목록으로</button><button className="outline-button" onClick={() => journalRef.current && void downloadJournalPdf(journalRef.current, `${teamNames.get(selectedJournal.team_id) ?? '참여팀'}-${titleFor(selectedJournal.op_day_id)}`)} type="button">PDF 다운로드</button></div><div ref={journalRef}><JournalDocument readOnly templateType={selectedJournal.template_type} data={selectedJournal.form_data ?? {}} title={`${teamNames.get(selectedJournal.team_id) ?? '참여팀'} · ${titleFor(selectedJournal.op_day_id)}`} /></div><section className="feedback-box"><p className="eyebrow">TEACHER FEEDBACK</p><h2>교사 피드백</h2>{feedback.length === 0 ? <p className="empty-copy">아직 남긴 피드백이 없어요.</p> : feedback.map((item) => <article key={item.id}><p>{item.content}</p><small>{new Date(item.created_at).toLocaleString('ko-KR')}</small></article>)}<form onSubmit={saveFeedback}><label>새 피드백<textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="다음 실험을 위한 구체적인 피드백을 작성해 주세요." rows={4} /></label><button className="primary-button compact" disabled={feedbackSaving} type="submit">{feedbackSaving ? '저장 중...' : '피드백 저장'}</button></form></section></div> : <div className="management-list">{journals.length === 0 ? <p className="empty-copy">아직 작성된 일지가 없어요.</p> : journals.map((journal) => <button className="journal-management-row" key={journal.id} onClick={() => void openJournal(journal)} type="button"><span>{teamNames.get(journal.team_id) ?? '참여팀'}</span><strong>{titleFor(journal.op_day_id)}</strong><small>{JOURNAL_TEMPLATES[journal.template_type].name} · 마지막 저장: {new Date(journal.updated_at).toLocaleString('ko-KR')}</small><i>→</i></button>)}</div>}</section>}
      </section>
    </div>
  </main>
}
