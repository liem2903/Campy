import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <main className="login">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Go home</Link>
      </p>
    </main>
  )
}

export default NotFoundPage
