import { Navigate, useNavigate } from 'react-router'
import { useNotes } from '../notes.ts'

function WorkspaceHome() {
  const { notes, createNote } = useNotes()
  const navigate = useNavigate()

  if (notes.length > 0) {
    const latest = notes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
    return <Navigate to={`/notes/${latest.id}`} replace />
  }

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

export default WorkspaceHome
