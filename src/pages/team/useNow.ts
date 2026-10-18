import { useEffect, useState } from 'react'

/** 화면 표시용 현재 시각(ms). active 일 때만 intervalMs 마다 갱신합니다. DB에 저장하지 않습니다. */
export function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [active, intervalMs])
  return now
}
