import { Link, useNavigate } from 'react-router'
import { useNotes } from '../notes.ts'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function AllNotesPage() {
  const { notes, loading, createNote } = useNotes()
  const navigate = useNavigate()

  // Blank until the list arrives, so the empty state doesn't flash.
  if (loading) return null
  if (notes.length === 0) {
    return (
      <div className="page-content empty-state">
        <h1 className="auth-title">
          A blank <em>page.</em>
        </h1>
        <p className="auth-lede">Write a note, then turn it into flashcards and quizzes.</p>
        <button
          type="button"
          className="auth-submit"
          onClick={() => navigate(`/notes/${createNote()}`)}
        >
          Create your first page
          <span className="auth-submit-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="page-content library">
      <h1 className="auth-title">
        All <em>notes.</em>
      </h1>
      <p className="auth-lede">
        {notes.length} {notes.length === 1 ? 'page' : 'pages'}, most recently edited first.
      </p>
      <div className="library-grid">
        {notes.map((note) => (
          <Link key={note.id} to={`/notes/${note.id}`} className="library-card">
            <span className="library-card-title">{note.title || 'Untitled'}</span>
            <span className="library-card-date">{dateFormat.format(new Date(note.updatedAt))}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default AllNotesPage
