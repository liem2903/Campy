import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { logOut } from '../api.ts'
import { useAuth } from '../auth.ts'
import { useNotes } from '../notes.ts'
import { useTheme } from '../theme.ts'

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
      <Link to="/" className="brand">
        Campi
      </Link>
      <button type="button" className="sidebar-item new-page" onClick={handleNew}>
        + New page
      </button>
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
      <button type="button" className="sidebar-item theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
      </button>
      {/* Only rendered inside RequireAuth, so user is set; the ?. just satisfies the type. */}
      <div className="sidebar-item current-user">{user?.email}</div>
      <button type="button" className="sidebar-item" onClick={handleLogOut}>
        Log out
      </button>
    </aside>
  )
}

export default Sidebar
