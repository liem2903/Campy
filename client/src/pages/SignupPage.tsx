import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signUp } from '../api.ts'
import { useAuth } from '../auth.ts'
import BrainMark from '../components/BrainMark.tsx'
import NoteShowcase from '../components/NoteShowcase.tsx'
import { PHYSICS_NOTE } from '../sampleNotes.ts'

function SignupPage() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      setUser(await signUp(email, password))
      navigate('/')
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
            Start a <em>notebook.</em>
          </h1>
          <p className="auth-lede">Write notes, then get quizzed on them.</p>

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
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Setting things up…' : 'Create account'}
              <span className="auth-submit-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>

        <p className="auth-foot">Write it down. Then prove you know it.</p>
      </main>

      <NoteShowcase note={PHYSICS_NOTE} />
    </div>
  )
}

export default SignupPage
