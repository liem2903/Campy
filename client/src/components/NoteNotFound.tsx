import { Link } from 'react-router'

// Shown for a note id that isn't in the user's list: deleted, mistyped or another user's.
function NoteNotFound() {
  return (
    <div className="page-content empty-state">
      <h1 className="auth-title">
        Nothing <em>here.</em>
      </h1>
      <p className="auth-lede">This page doesn't exist, or it was deleted.</p>
      <Link to="/" className="auth-submit">
        Back to your notes
        <span className="auth-submit-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  )
}

export default NoteNotFound
