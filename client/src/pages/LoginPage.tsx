import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { api, errorMessage } from '../api.ts'
import { useAuth, type User } from '../auth.ts'

// RequireAuth stores the page the user was bounced from in location.state.from.
// Only same-app paths: "//host" would be protocol-relative.
function redirectTarget(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = (state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } }).from
    const { pathname, search, hash } = from ?? {}
    if (typeof pathname === 'string' && pathname.startsWith('/') && !pathname.startsWith('//')) {
      return pathname + (typeof search === 'string' ? search : '') + (typeof hash === 'string' ? hash : '')
    }
  }
  return '/'
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.post<User>('/api/auth/login', { email, password })
      setUser(res.data)
      navigate(redirectTarget(location.state), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <h1>Log in</h1>
      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted auth-switch">
        New to Campi? <Link to="/signup">Create an account</Link>
      </p>
    </main>
  )
}

export default LoginPage
