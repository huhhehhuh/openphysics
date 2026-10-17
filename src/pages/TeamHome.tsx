import type { Profile } from '../types'

type TeamHomeProps = {
  profile: Profile
  onSignOut: () => void
}

export default function TeamHome({ profile, onSignOut }: TeamHomeProps) {
  return (
    <main className="app-shell">
      <header className="topbar"><strong>Open Physics</strong><button onClick={onSignOut}>로그아웃</button></header>
      <section className="hero-panel">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>{profile.display_name} 팀, 오늘도 탐구해 볼까요?</h1>
        <p>기록은 작은 관찰에서 시작됩니다.</p>
      </section>
      <section className="dashboard-grid">
        <article className="card date-card"><p>다음 OP DAY</p><strong>일정이 아직 없어요</strong><span>선생님이 일정을 등록하면 표시됩니다.</span></article>
        <article className="card attendance-card"><p>오늘의 출석</p><strong>출석 전</strong><button className="primary-button">출석 시작하기 <span>→</span></button></article>
        <article className="card wide-card"><div><p>오늘의 과제</p><h2>등록된 과제가 없어요.</h2><span>OP DAY 일정이 생기면 팀 과제를 확인할 수 있어요.</span></div><div className="task-count">0 / 0</div></article>
      </section>
    </main>
  )
}
