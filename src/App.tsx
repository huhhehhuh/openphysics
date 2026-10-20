import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import TeamHome from './pages/TeamHome'
import TeacherHome from './pages/TeacherHome'
import type { Profile } from './types'

type Role = 'team' | 'teacher'

function legacyTeamEmail(teamName: string) {
  const codes = JSON.parse(import.meta.env.VITE_TEAM_CODES || '{}') as Record<string, string>
  const teamCode = codes[teamName.trim()]
  const template = import.meta.env.VITE_TEAM_EMAIL_TEMPLATE as string | undefined

  if (!teamCode || !template) return null
  return template.replace('{teamCode}', teamCode)
}

function teacherEmail(teacherName: string) {
  const teachers = JSON.parse(import.meta.env.VITE_TEACHER_EMAILS || '{}') as Record<string, string>
  return teachers[teacherName.trim()] ?? null
}

function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [role, setRole] = useState<Role>('team')
  const [screen, setScreen] = useState<'sign-in' | 'team-signup' | 'team-recovery'>('sign-in')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signupTeamName, setSignupTeamName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [participationCode, setParticipationCode] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordAgain, setSignupPasswordAgain] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [signupMessage, setSignupMessage] = useState('')
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
    if (role === 'team') {
      const legacyEmail = legacyTeamEmail(identity)
      if (legacyEmail) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: legacyEmail, password })
        setLoading(false)
        if (signInError || !data.session) {
          setError('팀 이름 또는 비밀번호를 확인해 주세요.')
          return
        }
        onSignedIn(data.session)
        return
      }

      const { data, error: functionError } = await supabase.functions.invoke('team-auth', {
        body: { action: 'sign-in', teamName: identity.trim(), password },
      })
      setLoading(false)
      const session = data?.session as Session | undefined
      if (functionError || !session?.access_token || !session.refresh_token) {
        setError('팀 이름 또는 비밀번호를 확인해 주세요.')
        return
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      if (sessionError) {
        setError('로그인 정보를 저장하지 못했어요. 다시 시도해 주세요.')
        return
      }
      onSignedIn(session)
      return
    }

    const email = teacherEmail(identity)
    if (!email) {
      setLoading(false)
      setError('등록되지 않은 선생님입니다. 이름과 .env 설정을 확인해 주세요.')
      return
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError || !data.session) {
      setError('아이디 또는 비밀번호를 확인해 주세요.')
      return
    }

    onSignedIn(data.session)
  }

  async function handleTeamSignup(event: FormEvent) {
    event.preventDefault()
    setSignupError('')
    setSignupMessage('')

    if (!supabase) {
      setSignupError('Supabase 연결 정보를 먼저 설정해 주세요.')
      return
    }
    if (signupPassword.length < 8) {
      setSignupError('비밀번호는 8자 이상으로 입력해 주세요.')
      return
    }
    if (signupPassword !== signupPasswordAgain) {
      setSignupError('비밀번호가 서로 일치하지 않아요.')
      return
    }

    setSignupLoading(true)
    const { data, error: signupRequestError } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          openphysics_signup: 'team',
          team_name: signupTeamName.trim(),
          participation_code: participationCode,
        },
      },
    })
    setSignupLoading(false)

    if (signupRequestError) {
      setSignupError(signupRequestError.message)
      return
    }
    if (data.session) {
      onSignedIn(data.session)
      return
    }
    setSignupMessage('가입 확인 이메일을 보냈어요. 이메일의 링크를 연 뒤 로그인해 주세요.')
  }

  async function handleTeamPasswordRecovery(event: FormEvent) {
    event.preventDefault()
    setSignupError('')
    setSignupMessage('')
    if (!supabase) {
      setSignupError('Supabase 연결 정보를 먼저 설정해 주세요.')
      return
    }

    setSignupLoading(true)
    const { error: functionError } = await supabase.functions.invoke('team-auth', {
      body: { action: 'reset-password', teamName: identity.trim() },
    })
    setSignupLoading(false)
    if (functionError) {
      setSignupError('재설정 요청을 처리하지 못했어요. 팀 이름을 확인하거나 선생님에게 문의해 주세요.')
      return
    }
    setSignupMessage('등록된 인증용 이메일로 비밀번호 재설정 링크를 보냈어요.')
  }

  return (
    <main className="login-shell">
      <section className="login-intro">
        <p className="eyebrow">SCIENCE CLUB · 2026</p>
        <h1>Open<br />Physics</h1>
        <p>탐구의 과정이 기록이 되는 곳.<br />오늘의 실험을 시작해 보세요.</p>
      </section>
      <section className="login-card" aria-label={screen === 'sign-in' ? '로그인' : '팀 계정 만들기'}>
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
          {role === 'team' && <div className="login-secondary-actions"><button className="login-secondary-action" type="button" onClick={() => setScreen('team-signup')}>새 팀 계정 만들기</button><button className="login-secondary-action" type="button" onClick={() => setScreen('team-recovery')}>비밀번호를 잊으셨나요?</button></div>}
        </> : <>
          {screen === 'team-signup' ? <>
            <h2>팀 계정 만들기</h2>
            <p className="muted">참여 코드가 맞으면 팀 계정이 바로 만들어져요.</p>
            <form onSubmit={handleTeamSignup}>
            <label>
              팀 이름
              <input autoFocus value={signupTeamName} onChange={(event) => setSignupTeamName(event.target.value)} placeholder="예: 탐구 1팀" required />
            </label>
            <label>
              팀 이메일
              <input type="email" autoComplete="email" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} placeholder="team@example.com" required />
            </label>
            <label>
              참여 코드
              <input value={participationCode} onChange={(event) => setParticipationCode(event.target.value)} placeholder="선생님에게 받은 공통 코드" required />
            </label>
            <label>
              비밀번호
              <input type="password" autoComplete="new-password" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} placeholder="8자 이상" required />
            </label>
            <label>
              비밀번호 확인
              <input type="password" autoComplete="new-password" value={signupPasswordAgain} onChange={(event) => setSignupPasswordAgain(event.target.value)} placeholder="비밀번호를 다시 입력" required />
            </label>
            {signupError && <p className="error" role="alert">{signupError}</p>}
            {signupMessage && <p className="signup-message" role="status">{signupMessage}</p>}
            <button className="primary-button" disabled={signupLoading} type="submit">
              {signupLoading ? '계정 만드는 중...' : '팀 계정 만들기'} <span>→</span>
            </button>
            </form>
            <button className="login-secondary-action" type="button" onClick={() => setScreen('sign-in')}>로그인으로 돌아가기</button>
          </> : <>
            <h2>비밀번호 재설정</h2>
            <p className="muted">등록한 인증용 이메일로 재설정 링크를 보냅니다.</p>
            <form onSubmit={handleTeamPasswordRecovery}>
              <label>
                팀 이름
                <input autoFocus value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="예: 빵상" required />
              </label>
              {signupError && <p className="error" role="alert">{signupError}</p>}
              {signupMessage && <p className="signup-message" role="status">{signupMessage}</p>}
              <button className="primary-button" disabled={signupLoading} type="submit">
                {signupLoading ? '전송 중...' : '재설정 링크 보내기'} <span>→</span>
              </button>
            </form>
            <button className="login-secondary-action" type="button" onClick={() => setScreen('sign-in')}>로그인으로 돌아가기</button>
          </>}
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
  if (!profile) return <main className="loading-screen">권한을 확인하는 중...</main>
  return profile.role === 'teacher'
    ? <TeacherHome profile={profile} onRequestPasswordReset={requestPasswordReset} onSignOut={signOut} />
    : <TeamHome profile={profile} onRequestPasswordReset={requestPasswordReset} onSignOut={signOut} />
}
