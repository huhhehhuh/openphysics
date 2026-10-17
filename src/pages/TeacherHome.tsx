import type { Profile } from '../types'

type TeacherHomeProps = {
  profile: Profile
  onSignOut: () => void
}

export default function TeacherHome({ profile, onSignOut }: TeacherHomeProps) {
  return (
    <main className="app-shell">
      <header className="topbar"><strong>Open Physics</strong><button onClick={onSignOut}>로그아웃</button></header>
      <section className="hero-panel teacher-hero"><p className="eyebrow">TEACHER DASHBOARD</p><h1>{profile.display_name}님, 관리할 준비가 됐어요.</h1><p>일정, 출결, 실험일지를 한 곳에서 관리하세요.</p></section>
      <section className="dashboard-grid teacher-grid">
        <article className="card"><p>OP 일정 관리</p><h2>새 일정 만들기</h2><button className="outline-button">일정 추가 →</button></article>
        <article className="card"><p>출결 관리</p><h2>오늘 출석 현황</h2><strong>0개 팀</strong></article>
        <article className="card wide-card"><div><p>실험일지</p><h2>아직 작성된 일지가 없어요.</h2><span>팀이 일지를 저장하면 여기에서 피드백을 남길 수 있어요.</span></div><button className="outline-button">일지 보기 →</button></article>
      </section>
    </main>
  )
}
