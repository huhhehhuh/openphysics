import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import TeamHome from './pages/TeamHome'
import TeacherHome from './pages/TeacherHome'
import type { Profile } from './types'

type Role = 'team' | 'teacher'

function teamEmail(teamName: string) {
  const codes = JSON.parse(import.meta.env.VITE_TEAM_CODES || '{}') as Record<string, string>
  const teamCode = codes[teamName.trim()]
  const template = import.meta.env.VITE_TEAM_EMAIL_TEMPLATE as string | undefined

  if (!teamCode || !template) return null
  return template.replace('{teamCode}', teamCode)
}

function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [role, setRole] = useState<Role>('team')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase 연결 정보를 먼저 설정해 주세요.')
      return
    }

    const email = role === 'teacher' ? identity.trim() : teamEmail(identity)
    if (!email) {
      setError('등록되지 않은 팀입니다. 팀 이름과 .env 설정을 확인해 주세요.')
      return
    }

    setLoading(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError || !data.session) {
      setError('아이디 또는 비밀번호를 확인해 주세요.')
      return
    }

    onSignedIn(data.session)
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <p className="eyebrow">SCIENCE CLUB · 2026</p>
        <h1>Open<br />Physics</h1>
        <p>탐구의 과정이 기록이 되는 곳.<br />오늘의 실험을 시작해 보세요.</p>
      </section>
      <section className="login-card" aria-label="로그인">
        <div className="logo-mark">OP</div>
        <h2>다시 만나서 반가워요.</h2>
        <p className="muted">팀 또는 교사 계정으로 로그인하세요.</p>
        <div className="role-tabs" role="tablist" aria-label="로그인 유형">
          <button className={role === 'team' ? 'active' : ''} onClick={() => setRole('team')} type="button">참여팀</button>
          <button className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')} type="button">선생님</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            {role === 'team' ? '팀 이름' : '이메일'}
            <input
              autoComplete={role === 'team' ? 'username' : 'email'}
              autoFocus
              value={identity}
              onChange={(event) => setIdentity(event.target.value)}
              placeholder={role === 'team' ? '예: 빵상' : 'teacher@example.com'}
              required
            />
          </label>
          <label>
            비밀번호
            <span className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호 입력"
                required
              />
              <button className="password-visibility-button" onClick={() => setShowPassword((current) => !current)} type="button">
                {showPassword ? '숨기기' : '보기'}
              </button>
            </span>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? '로그인 중...' : '로그인'} <span>→</span>
          </button>
        </form>
        {!isSupabaseConfigured && <p className="setup-note">개발 모드: `.env` 설정 후 실제 로그인할 수 있어요.</p>}
      </section>
    </main>
  )
}

function PasswordRecovery({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 입력해 주세요.')
      return
    }
    if (password !== passwordAgain) {
      setError('비밀번호가 서로 일치하지 않아요.')
      return
    }
    if (!supabase) {
      setError('Supabase 연결 정보를 먼저 설정해 주세요.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError('비밀번호 변경에 실패했어요. 새 리셋 링크로 다시 시도해 주세요.')
      return
    }

    window.history.replaceState({}, '', window.location.pathname)
    onComplete()
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <p className="eyebrow">OPEN PHYSICS</p>
        <h1>새로운<br />시작</h1>
        <p>팀에서 함께 사용할 새 비밀번호를<br />안전하게 정해 주세요.</p>
      </section>
      <section className="login-card" aria-label="비밀번호 재설정">
        <div className="logo-mark">OP</div>
        <h2>새 비밀번호 설정</h2>
        <p className="muted">8자 이상으로 입력해 주세요.</p>
        <form onSubmit={handleSubmit} className="recovery-form">
          <label>
            새 비밀번호
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label>
            새 비밀번호 확인
            <input type="password" autoComplete="new-password" value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading} type="submit">
            {loading ? '변경 중...' : '비밀번호 변경'} <span>→</span>
          </button>
        </form>
      </section>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).finally(() => setLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null)
      return
    }
    supabase.from('profiles').select('id, display_name, role, team_id').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data as Profile | null))
  }, [session])

  async function signOut() {
    await supabase?.auth.signOut()
  }

  if (loading) return <main className="loading-screen">Open Physics를 불러오는 중...</main>
  if (passwordRecovery) return <PasswordRecovery onComplete={() => setPasswordRecovery(false)} />
  if (!session) return <Login onSignedIn={setSession} />
  if (!profile) return <main className="loading-screen">권한을 확인하는 중...</main>
  return profile.role === 'teacher'
    ? <TeacherHome profile={profile} onSignOut={signOut} />
    : <TeamHome profile={profile} onSignOut={signOut} />
}
