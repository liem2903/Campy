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
      <h1>Welcome to Campi</h1>
      <p className="muted">You don't have any pages yet.</p>
      <button
        type="button"
        className="primary"
        onClick={() => navigate(`/notes/${createNote()}`)}
      >
        Create your first page
      </button>
    </div>
  )
}

export default WorkspaceHome
