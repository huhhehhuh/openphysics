import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import TeamHome from './pages/TeamHome'
import TeacherHome from './pages/TeacherHome'
import type { Profile } from './types'

type Role = 'team' | 'teacher'

function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [role, setRole] = useState<Role>('team')
  const [screen, setScreen] = useState<'sign-in' | 'recovery'>('sign-in')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase 연결 정보를 먼저 설정해 주세요.')
      return
    }

    setLoading(true)
    const { data, error: functionError } = await supabase.functions.invoke('team-auth', {
      body: { action: 'sign-in', role, name: identity.trim(), password },
    })
    setLoading(false)
    const session = data?.session as Session | undefined
    if (functionError || !session?.access_token || !session.refresh_token) {
      setError(`${role === 'team' ? '팀' : '선생님'} 이름 또는 비밀번호를 확인해 주세요.`)
      return
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (sessionError || !sessionData.session) {
      setError('로그인 정보를 저장하지 못했어요. 다시 시도해 주세요.')
      return
    }
    onSignedIn(sessionData.session)
  }

  async function handlePasswordRecovery(event: FormEvent) {
    event.preventDefault()
    setRecoveryError('')
    setRecoveryMessage('')
    if (!supabase) {
      setRecoveryError('Supabase 연결 정보를 먼저 설정해 주세요.')
      return
    }

    setRecoveryLoading(true)
    const { error: functionError } = await supabase.functions.invoke('team-auth', {
      body: { action: 'reset-password', role, name: identity.trim() },
    })
    setRecoveryLoading(false)
    if (functionError) {
      setRecoveryError('재설정 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setRecoveryMessage('등록된 이메일이 있다면 비밀번호 재설정 링크를 보냈어요.')
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <p className="eyebrow">SCIENCE CLUB · 2026</p>
        <h1>Open<br />Physics</h1>
        <p>탐구의 과정이 기록이 되는 곳.<br />오늘의 실험을 시작해 보세요.</p>
      </section>
      <section className="login-card" aria-label={screen === 'sign-in' ? '로그인' : '비밀번호 재설정'}>
        <div className="logo-mark">OP</div>
        {screen === 'sign-in' ? <>
          <h2>다시 만나서 반가워요.</h2>
          <p className="muted">팀 또는 교사 계정으로 로그인하세요.</p>
          <div className="role-tabs" role="tablist" aria-label="로그인 유형">
            <button className={role === 'team' ? 'active' : ''} onClick={() => setRole('team')} type="button">참여팀</button>
            <button className={role === 'teacher' ? 'active' : ''} onClick={() => setRole('teacher')} type="button">선생님</button>
          </div>
          <form onSubmit={handleSubmit}>
            <label>
              {role === 'team' ? '팀 이름' : '선생님 이름'}
              <input
                autoComplete="username"
                autoFocus
                value={identity}
                onChange={(event) => setIdentity(event.target.value)}
                placeholder={role === 'team' ? '예: 빵상' : '예: 임미옥'}
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
          <div className="login-secondary-actions"><button className="login-secondary-action" type="button" onClick={() => setScreen('recovery')}>비밀번호를 잊으셨나요?</button></div>
        </> : <>
          <h2>비밀번호 재설정</h2>
          <p className="muted">등록한 인증용 이메일로 재설정 링크를 보냅니다.</p>
          <form onSubmit={handlePasswordRecovery}>
            <label>
              {role === 'team' ? '팀 이름' : '선생님 이름'}
              <input autoFocus value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder={role === 'team' ? '예: 빵상' : '예: 임미옥'} required />
            </label>
            {recoveryError && <p className="error" role="alert">{recoveryError}</p>}
            {recoveryMessage && <p className="signup-message" role="status">{recoveryMessage}</p>}
            <button className="primary-button" disabled={recoveryLoading} type="submit">
              {recoveryLoading ? '전송 중...' : '재설정 링크 보내기'} <span>→</span>
            </button>
          </form>
          <button className="login-secondary-action" type="button" onClick={() => setScreen('sign-in')}>로그인으로 돌아가기</button>
        </>}
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
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileCheckedUserId, setProfileCheckedUserId] = useState<string | null>(null)
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
      setProfileLoading(false)
      setProfileCheckedUserId(null)
      return
    }
    let active = true
    setProfileLoading(true)
    supabase.from('profiles').select('id, display_name, role, team_id').eq('id', session.user.id).single()
      .then(({ data }) => {
        if (active) {
          setProfile(data as Profile | null)
          setProfileCheckedUserId(session.user.id)
          setProfileLoading(false)
        }
      })
    return () => { active = false }
  }, [session?.user.id])

  async function signOut() {
    await supabase?.auth.signOut()
  }

  async function requestPasswordReset() {
    if (!supabase || !session?.user.email) {
      window.alert('비밀번호 재설정 이메일을 보낼 계정을 찾지 못했어요.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
      redirectTo: `${window.location.origin}/`,
    })
    if (error) {
      window.alert(`비밀번호 재설정 이메일을 보내지 못했어요: ${error.message}`)
      return
    }
    window.alert('비밀번호 재설정 링크를 현재 계정 이메일로 보냈어요. 이메일의 링크를 열어 새 비밀번호를 설정해 주세요.')
  }

  if (loading) return <main className="loading-screen">Open Physics를 불러오는 중...</main>
  if (passwordRecovery) return <PasswordRecovery onComplete={() => setPasswordRecovery(false)} />
  if (!session) return <Login onSignedIn={setSession} />
  if (profileLoading || profileCheckedUserId !== session.user.id) return <main className="loading-screen">권한을 확인하는 중...</main>
  if (!profile) return <main className="loading-screen">프로필이 등록되지 않았어요. 관리자에게 문의해 주세요.<button onClick={() => void signOut()} type="button">로그아웃</button></main>
  return profile.role === 'teacher'
    ? <TeacherHome profile={profile} onRequestPasswordReset={requestPasswordReset} onSignOut={signOut} />
    : <TeamHome profile={profile} onRequestPasswordReset={requestPasswordReset} onSignOut={signOut} />
}
