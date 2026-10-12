import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { logIn } from '../api.ts'
import { useAuth } from '../auth.ts'
import BrainMark from '../components/BrainMark.tsx'
import NoteShowcase from '../components/NoteShowcase.tsx'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Where RequireAuth bounced them from, or the workspace home.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setUser(await logIn(email, password))
      // replace: Back shouldn't return to the login form.
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <main className="auth-panel">
        <Link to="/login" className="auth-brand">
          <BrainMark />
          Campi
        </Link>

        <div className="auth-body">
          <h1 className="auth-title">
            Welcome <em>back.</em>
          </h1>
          <p className="auth-lede">Your notes are right where you left them.</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Opening your notes…' : 'Continue'}
              <span className="auth-submit-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </form>

          <p className="auth-switch">
            New to Campi? <Link to="/signup">Create an account</Link>
          </p>
        </div>

        <p className="auth-foot">Write it down. Then prove you know it.</p>
      </main>

      <NoteShowcase />
    </div>
  )
}

export default LoginPage
