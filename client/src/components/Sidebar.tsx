import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { logOut } from '../api.ts'
import { useAuth } from '../auth.ts'
import { useNotes } from '../notes.ts'
import { useTheme } from '../theme.ts'
import BrainMark from './BrainMark.tsx'

function Sidebar() {
  const { notes, createNote, deleteNote } = useNotes()
  const { noteId } = useParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, setUser } = useAuth()

  function handleNew() {
    navigate(`/notes/${createNote()}`)
  }

  function handleDelete(id: string) {
    deleteNote(id)
    if (id === noteId) navigate('/')
  }

  // Only forget the user once the server has ended the session; on failure they stay logged in.
  async function handleLogOut() {
    await logOut()
    navigate('/login', { replace: true })
    setUser(null)
  }

  return (
    <aside className="sidebar">
      <Link to="/" className="auth-brand sidebar-brand">
        <BrainMark />
        Campi
      </Link>
      <button type="button" className="new-page" onClick={handleNew}>
        New page
        <span className="new-page-plus" aria-hidden="true">
          +
        </span>
      </button>
      <p className="sidebar-label">Notes</p>
      <nav className="page-list">
        {notes.map((note) => (
          <div key={note.id} className="page-row">
            <NavLink to={`/notes/${note.id}`} className="sidebar-item page-link">
              {note.title || 'Untitled'}
            </NavLink>
            <button
              type="button"
              className="delete-page"
              aria-label={`Delete ${note.title || 'Untitled'}`}
              onClick={() => handleDelete(note.id)}
            >
              ×
            </button>
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        {/* Only rendered inside RequireAuth, so user is set; the ?. just satisfies the type. */}
        <div className="current-user" title={user?.email}>
          {user?.email}
        </div>
        <div className="sidebar-actions">
          <button type="button" className="sidebar-item" onClick={toggleTheme}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <button type="button" className="sidebar-item" onClick={handleLogOut}>
            Log out
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
