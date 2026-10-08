import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { logIn } from '../api.ts'
import { useAuth } from '../auth.ts'

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
    <main className="login">
      <h1>Log in</h1>
      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting}>
          Log in
        </button>
      </form>
      <p className="muted">
        No account yet? <Link to="/signup">Create one</Link>
      </p>
    </main>
  )
}

export default LoginPage
