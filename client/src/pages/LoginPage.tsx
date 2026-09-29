import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // No auth yet: submitting just goes to the home page.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/')
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
        <button type="submit" className="primary">Log in</button>
      </form>
    </main>
  )
}

export default LoginPage
