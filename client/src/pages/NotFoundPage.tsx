import { Link } from 'react-router'

// Same look as NotePage's missing-note state; .page gives it the dotted canvas.
function NotFoundPage() {
  return (
    <main className="page not-found">
      <div className="page-content empty-state">
        <h1 className="auth-title">
          Page not <em>found.</em>
        </h1>
        <p className="auth-lede">There's nothing at this address.</p>
        <Link to="/" className="auth-submit">
          Go home
          <span className="auth-submit-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </main>
  )
}

export default NotFoundPage
