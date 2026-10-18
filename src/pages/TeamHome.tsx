import { useEffect, useRef, useState } from 'react'
import { downloadJournalPdf } from '../journals/downloadPdf'
import JournalDocument from '../journals/JournalDocument'
import { JOURNAL_TEMPLATES, templateTypes, type JournalTemplateType } from '../journals/templates'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

type TeamHomeProps = { profile: Profile; onSignOut: () => void }
type OpDay = { id: string; date: string; title: string }
type Journal = { id: string; op_day_id: string; template_type: JournalTemplateType; form_data: Record<string, string> }
type TeacherReference = { display_name: string } | { display_name: string }[] | null
type JournalFeedback = { id: string; journal_id: string; content: string; created_at: string; teacher: TeacherReference }
type JournalMode = 'home' | 'choose' | 'edit'

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
  const journalRef = useRef<HTMLDivElement>(null)
  const teamId = profile.team_id

  async function loadTeamData() {
    if (!supabase || !teamId) return
    setLoading(true)
    const [daysResult, journalsResult] = await Promise.all([
      supabase.from('op_days').select('id, date, title').order('date'),
      supabase.from('journals').select('id, op_day_id, template_type, form_data').eq('team_id', teamId).order('updated_at', { ascending: false }),
    ])
    if (daysResult.error || journalsResult.error) setError('일지 데이터를 불러오지 못했어요. DB 확장 SQL이 적용되었는지 확인해 주세요.')
    const nextDays = (daysResult.data ?? []) as OpDay[]
    setOpDays(nextDays)
    const journalRows = (journalsResult.data ?? []) as Journal[]
    setJournals(journalRows)
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

  const selectedDay = opDays.find((day) => day.id === selectedDayId)
  const currentJournal = journals.find((journal) => journal.op_day_id === selectedDayId)

  function openJournal() {
    if (!selectedDayId) { setError('선생님이 OP 일정을 등록한 후 실험일지를 만들 수 있어요.'); return }
    if (currentJournal) {
      setTemplateType(currentJournal.template_type)
      setJournalData(currentJournal.form_data ?? {})
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

  if (mode === 'choose') return <main className="app-shell journal-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={() => setMode('home')} type="button">돌아가기</button></header><section className="journal-choice"><p className="eyebrow">NEW EXPERIMENT JOURNAL</p><h1>오늘 기록할 양식을 골라 주세요.</h1><p>{selectedDay?.title ?? 'OP DAY'}의 기록은 선택한 양식으로 저장돼요.</p><div className="template-grid">{templateTypes.map((type) => { const template = JOURNAL_TEMPLATES[type]; return <button className={templateType === type ? 'selected' : ''} key={type} onClick={() => setTemplateType(type)} type="button"><span>{template.subtitle}</span><h2>{template.name}</h2><p>{template.description}</p></button> })}</div><button className="primary-button journal-start-button" onClick={() => setMode('edit')} type="button">이 양식으로 작성하기 <span>→</span></button></section></main>

  if (mode === 'edit') return <main className="app-shell journal-shell"><header className="topbar"><strong>Open Physics</strong><div><button onClick={handleDownload} type="button">PDF 다운로드</button><button onClick={() => setMode('home')} type="button">← 이전으로</button></div></header><section className="journal-editor"><div className="journal-editor-intro"><p className="eyebrow">{selectedDay?.title ?? 'OP DAY'}</p><h1>실험일지 작성</h1><p>모든 변경 사항은 저장 버튼을 눌러 기록해 주세요.</p>{currentJournal && <label className="template-change">양식 변경<select value={templateType} onChange={(event) => changeTemplate(event.target.value as JournalTemplateType)}>{templateTypes.map((type) => <option key={type} value={type}>{JOURNAL_TEMPLATES[type].name} · {JOURNAL_TEMPLATES[type].subtitle}</option>)}</select></label>}</div>{error && <p className="error">{error}</p>}<div ref={journalRef}><JournalDocument templateType={templateType} data={journalData} onChange={(key, value) => setJournalData((current) => ({ ...current, [key]: value }))} /></div><div className="journal-actions">{currentJournal && <button className="danger-button" disabled={saving} onClick={() => void deleteJournal()} type="button">일지 삭제</button>}<button className="outline-button" onClick={() => setMode('home')} type="button">나중에 작성하기</button><button className="primary-button" disabled={saving} onClick={() => void saveJournal()} type="button">{saving ? '저장 중...' : '실험일지 저장하기'} <span>→</span></button></div></section></main>

  return <main className="app-shell"><header className="topbar"><strong>Open Physics</strong><button onClick={onSignOut} type="button">로그아웃</button></header><section className="hero-panel"><p className="eyebrow">WELCOME BACK</p><h1>{profile.display_name} 팀, 오늘도 탐구해 볼까요?</h1><p>기록은 작은 관찰에서 시작됩니다.</p></section>{error && <p className="error">{error}</p>}<section className="dashboard-grid"><article className="card date-card"><p>다음 OP DAY</p><strong>{loading ? '일정을 불러오는 중...' : selectedDay?.title ?? '일정이 아직 없어요'}</strong><span>{selectedDay ? selectedDay.date : '선생님이 일정을 등록하면 표시됩니다.'}</span></article><article className="card attendance-card"><p>오늘의 출석</p><strong>출석 기능 준비 중</strong><span>일지 작성은 지금 바로 시작할 수 있어요.</span></article><article className="card wide-card"><div><p>실험일지</p><h2>{currentJournal ? `${JOURNAL_TEMPLATES[currentJournal.template_type].name} 일지를 이어서 작성하세요.` : '오늘의 실험을 기록해 보세요.'}</h2><span>선택한 양식은 선생님 화면에도 같은 형식으로 표시됩니다.</span></div><button className="outline-button" onClick={openJournal} type="button">{currentJournal ? '일지 이어쓰기 →' : '실험일지 작성 →'}</button></article></section><section className="team-journal-history"><div><p className="eyebrow">SAVED JOURNALS</p><h2>저장한 실험일지</h2></div>{journals.length === 0 ? <p className="muted">아직 저장한 일지가 없어요.</p> : <div className="history-list">{journals.map((journal) => <button key={journal.id} onClick={() => { setSelectedDayId(journal.op_day_id); setTemplateType(journal.template_type); setJournalData(journal.form_data ?? {}); setMode('edit') }} type="button"><strong>{opDays.find((day) => day.id === journal.op_day_id)?.title ?? 'OP DAY'}</strong><span>{JOURNAL_TEMPLATES[journal.template_type].name} · 열어서 수정하기</span>{feedbackByJournal[journal.id]?.map((feedback) => <span className="journal-feedback-preview" key={feedback.id}><b>{teacherName(feedback)}</b>{feedback.content}</span>)}</button>)}</div>}</section></main>
}
