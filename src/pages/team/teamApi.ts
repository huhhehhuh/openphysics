// 팀 화면이 Supabase(DB)와 주고받는 모든 요청을 한곳에 모은 파일입니다.
// - 팀 ID는 로그인한 계정의 profiles.team_id 를 그대로 받아 씁니다.
// - 권한은 DB의 RLS가 최종 판단합니다. 여기서 team_id 로 거르는 것은 "필요한 것만 가져오기" 위한 것입니다.
// - 출석 시각은 직접 쓰지 않고 start_attendance / finish_attendance RPC만 호출합니다.

import type { JournalTemplateType } from '../../journals/templates'
import { supabase } from '../../lib/supabase'

export type OpDay = {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string
  starts_at: string | null
  ends_at: string | null
}

export type Task = { id: string; op_day_id: string; title: string; sort_order: number }

export type Attendance = {
  id: string
  team_id: string
  op_day_id: string | null
  started_at: string
  ended_at: string | null
  end_reason: string | null
}

/** 실험일지 한 건. 양식 종류(template_type)와 칸별 입력값(form_data, JSON)으로 저장됩니다. */
export type JournalSummary = {
  id: string
  op_day_id: string
  created_at: string
  updated_at: string
  template_type: JournalTemplateType
  form_data: Record<string, string> | null
}

export type Feedback = { id: string; journal_id: string; content: string; created_at: string; teacher_name?: string | null }

function db() {
  if (!supabase) throw new Error('Supabase 연결 정보(.env)가 설정되지 않았어요.')
  return supabase
}

/** Supabase 오류를 학생이 이해할 수 있는 한국어 문장으로 바꿉니다. */
export function friendlyError(error: unknown): string {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error)
  if (message.includes('scheduled day')) return '출석은 일정 당일(한국 시간)에만 시작할 수 있어요.'
  if (message.includes('End reason is required')) return '종료 사유를 입력해 주세요.'
  if (message.includes('Active attendance not found')) return '진행 중인 출석이 없어요. 화면을 새로고침해 주세요.'
  if (message.includes('Team account required')) return '팀 계정으로 로그인해야 사용할 수 있어요.'
  if (message.includes('template_type') || message.includes('form_data')) return '실험일지 양식용 DB 설정이 아직 적용되지 않았어요. 저장소 담당자에게 알려 주세요.'
  if (message.includes('row-level security') || message.includes('permission denied')) return '이 작업을 할 권한이 없어요. 팀 계정으로 다시 로그인해 주세요.'
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return '인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
  if (message.includes('JWT') || message.includes('session')) return '로그인이 만료됐어요. 다시 로그인해 주세요.'
  return `문제가 생겼어요: ${message}`
}

// ---------- 일정 ----------

export async function fetchOpDays(): Promise<OpDay[]> {
  const { data, error } = await db().from('op_days').select('id, date, title, starts_at, ends_at').order('date')
  if (error) throw error
  return data as OpDay[]
}

// ---------- 출석 ----------

/** 우리 팀의 모든 출석 기록 (달력 표시용, 팀당 일정마다 최대 1건) */
export async function fetchTeamAttendance(teamId: string): Promise<Attendance[]> {
  const { data, error } = await db().from('attendance').select('id, team_id, op_day_id, started_at, ended_at, end_reason').eq('team_id', teamId)
  if (error) throw error
  return data as Attendance[]
}

export async function startAttendance(opDayId: string): Promise<Attendance> {
  const { data, error } = await db().rpc('start_attendance', { p_op_day_id: opDayId })
  if (error) throw error
  return data as Attendance
}

export async function startAutonomousAttendance(): Promise<Attendance> {
  const { data, error } = await db().rpc('start_attendance', { p_op_day_id: null })
  if (error) throw error
  return data as Attendance
}

export async function finishAttendance(opDayId: string, reason: string): Promise<Attendance> {
  const { data, error } = await db().rpc('finish_attendance', { p_op_day_id: opDayId, p_reason: reason })
  if (error) throw error
  return data as Attendance
}

export async function finishAttendanceById(attendanceId: string, reason: string): Promise<Attendance> {
  const { data, error } = await db().rpc('finish_attendance_by_id', { p_attendance_id: attendanceId, p_reason: reason })
  if (error) throw error
  return data as Attendance
}

// ---------- 과제 ----------

export async function fetchTasks(opDayId: string): Promise<Task[]> {
  const { data, error } = await db().from('tasks').select('id, op_day_id, title, sort_order').eq('op_day_id', opDayId).order('sort_order').order('created_at')
  if (error) throw error
  return data as Task[]
}

/** 주어진 과제들 중 우리 팀이 완료한 과제 ID 목록 */
export async function fetchCompletedTaskIds(teamId: string, taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set()
  const { data, error } = await db().from('task_completions').select('task_id').eq('team_id', teamId).in('task_id', taskIds)
  if (error) throw error
  return new Set((data as { task_id: string }[]).map((row) => row.task_id))
}

export async function setTaskCompleted(teamId: string, taskId: string, done: boolean): Promise<void> {
  if (done) {
    const { error } = await db().from('task_completions').insert({ team_id: teamId, task_id: taskId })
    // 23505 = 이미 완료로 기록됨(다른 기기에서 먼저 체크한 경우). 원하는 상태이므로 성공으로 봅니다.
    if (error && error.code !== '23505') throw error
  } else {
    const { error } = await db().from('task_completions').delete().eq('team_id', teamId).eq('task_id', taskId)
    if (error) throw error
  }
}

// ---------- 실험일지 ----------
// 양식 정의·화면(JournalDocument)·PDF는 src/journals/ 의 기존 구현을 그대로 사용하고,
// 여기서는 DB 읽기/쓰기만 담당합니다. 저장 형식은 template_type + form_data(JSON) 입니다.

export const TEMPLATE_LABELS: Record<string, string> = { basic: '기본형', advanced: '심화연구형', cumulative: '누적형' }

const JOURNAL_COLUMNS = 'id, op_day_id, created_at, updated_at, template_type, form_data'

export async function fetchJournalList(teamId: string): Promise<JournalSummary[]> {
  const { data, error } = await db().from('journals').select(JOURNAL_COLUMNS).eq('team_id', teamId).order('updated_at', { ascending: false })
  if (error) throw error
  return data as JournalSummary[]
}

/** 일지 저장. 처음이면 새로 추가하고, 이미 있으면 양식과 입력값만 수정합니다. (DB 권한에 맞춘 방식) */
export async function saveJournalForm(teamId: string, opDayId: string, templateType: JournalTemplateType, formData: Record<string, string>, existingId: string | null): Promise<void> {
  const payload = { template_type: templateType, form_data: formData }
  if (!existingId) {
    const { error } = await db().from('journals').insert({ ...payload, team_id: teamId, op_day_id: opDayId })
    if (!error) return
    // 23505 = 다른 기기에서 같은 날 일지를 먼저 만든 경우 → 그 일지를 수정합니다.
    if (error.code !== '23505') throw error
    const { data: found, error: findError } = await db().from('journals').select('id').eq('team_id', teamId).eq('op_day_id', opDayId).single()
    if (findError || !found) throw error
    existingId = (found as { id: string }).id
  }
  const { error } = await db().from('journals').update(payload).eq('id', existingId)
  if (error) throw error
}

export async function deleteJournal(journalId: string): Promise<void> {
  const { error } = await db().from('journals').delete().eq('id', journalId)
  if (error) throw error
}

// ---------- 교사 피드백 ----------

export async function fetchFeedback(journalId: string): Promise<Feedback[]> {
  const { data, error } = await db().from('journal_feedback').select('id, journal_id, content, created_at').eq('journal_id', journalId).order('created_at')
  if (error) throw error
  return data as Feedback[]
}

/** 여러 일지의 피드백을 한 번에 가져옵니다. (작성내용 보기 목록용) */
export async function fetchFeedbackForJournals(journalIds: string[]): Promise<Feedback[]> {
  if (journalIds.length === 0) return []
  // 교사 이름도 함께 가져옵니다. (main 의 기존 팀 화면과 같은 방식)
  const withName = await db().from('journal_feedback')
    .select('id, journal_id, content, created_at, teacher:profiles!journal_feedback_teacher_id_fkey(display_name)')
    .in('journal_id', journalIds).order('created_at')
  if (!withName.error) {
    type Row = Feedback & { teacher: { display_name: string } | { display_name: string }[] | null }
    return (withName.data as Row[]).map(({ teacher, ...rest }) => {
      const t = Array.isArray(teacher) ? teacher[0] : teacher
      return { ...rest, teacher_name: t?.display_name?.trim() || null }
    })
  }
  // 이름을 읽을 권한이 없으면 피드백 내용만 가져옵니다. ("선생님"으로 표시)
  const { data, error } = await db().from('journal_feedback').select('id, journal_id, content, created_at').in('journal_id', journalIds).order('created_at')
  if (error) throw error
  return data as Feedback[]
}
