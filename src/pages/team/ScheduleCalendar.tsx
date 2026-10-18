// 한 달 달력. OP 일정이 있는 날짜만 누를 수 있고, 출석·일지 여부를 작은 점으로 보여 줍니다.
import { useEffect, useMemo, useState } from 'react'
import type { OpDay } from './teamApi'

type Props = {
  opDays: OpDay[]
  today: string
  selectedId: string | null
  attendedDayIds: Set<string>
  journalDayIds: Set<string>
  onSelect: (day: OpDay) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function monthKey(date: string) {
  return date.slice(0, 7) // 'YYYY-MM'
}

function shiftMonth(key: string, diff: number) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + diff, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function ScheduleCalendar({ opDays, today, selectedId, attendedDayIds, journalDayIds, onSelect }: Props) {
  const selected = opDays.find((day) => day.id === selectedId)
  const [month, setMonth] = useState(() => monthKey(selected?.date ?? today))

  // 목록 등 다른 곳에서 날짜를 고르면 달력도 그 달로 이동합니다.
  useEffect(() => {
    if (selected) setMonth(monthKey(selected.date))
  }, [selected?.date])

  const byDate = useMemo(() => new Map(opDays.map((day) => [day.date, day])), [opDays])

  const cells = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const list: (string | null)[] = Array(firstWeekday).fill(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(`${month}-${String(d).padStart(2, '0')}`)
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [month])

  const [year, monthNumber] = month.split('-').map(Number)
  const opDaysThisMonth = opDays.filter((day) => monthKey(day.date) === month).length

  return (
    <div className="team-calendar">
      <div className="team-calendar-head">
        <button type="button" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
        <strong>{year}년 {monthNumber}월</strong>
        <button type="button" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
      </div>
      <div className="team-calendar-grid" role="grid">
        {WEEKDAYS.map((w) => <span key={w} className="team-calendar-weekday">{w}</span>)}
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const day = byDate.get(date)
          const classes = ['team-calendar-day']
          if (day) classes.push('has-op')
          if (date === today) classes.push('is-today')
          if (day && day.id === selectedId) classes.push('is-selected')
          return (
            <button
              key={date}
              type="button"
              className={classes.join(' ')}
              disabled={!day}
              onClick={() => day && onSelect(day)}
              aria-label={day ? `${date} ${day.title}` : date}
              aria-pressed={day ? day.id === selectedId : undefined}
            >
              {Number(date.slice(8))}
              {day && (
                <span className="team-calendar-dots" aria-hidden="true">
                  {attendedDayIds.has(day.id) && <i className="dot-attend" />}
                  {journalDayIds.has(day.id) && <i className="dot-journal" />}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="team-calendar-foot">
        <span>{opDaysThisMonth > 0 ? `이번 달 OP 일정 ${opDaysThisMonth}개` : '이 달에는 OP 일정이 없어요.'}</span>
        <span className="team-legend"><i className="dot-attend" />출석 <i className="dot-journal" />일지</span>
        {month !== monthKey(today) && <button type="button" className="team-link-button" onClick={() => setMonth(monthKey(today))}>오늘로</button>}
      </div>
    </div>
  )
}
