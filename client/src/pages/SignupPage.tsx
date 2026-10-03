import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signUp } from '../api.ts'

// No preflight reset yet, so inputs and buttons clear their browser border and font themselves.
const inputClass =
  'rounded-md border-0 bg-hover px-2.5 py-2 text-text [font:inherit] outline-none focus:ring-2 focus:ring-accent'

function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signUp(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto mt-[15vh] max-w-xs px-4">
      <h1>Sign up</h1>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          Password
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {error && (
          <p className="m-0 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="cursor-pointer rounded-md border-0 bg-accent px-3.5 py-2 text-white [font:inherit] disabled:opacity-60"
          disabled={submitting}
        >
          Sign up
        </button>
      </form>
      <p className="text-muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </main>
  )
}

export default SignupPage
