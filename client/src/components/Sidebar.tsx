import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { api } from '../api.ts'
import { useAuth } from '../auth.ts'
import { useNotes } from '../notes.ts'
import { useTheme } from '../theme.ts'

function Sidebar() {
  const { notes, createNote, deleteNote } = useNotes()
  const { noteId } = useParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, setUser } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  function handleNew() {
    navigate(`/notes/${createNote()}`)
  }

  function handleDelete(id: string) {
    deleteNote(id)
    if (id === noteId) navigate('/')
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Log out locally anyway. If the server was unreachable the cookie and
      // session may survive, so a reload could log the user back in.
    }
    setUser(null)
    // replace: the back button shouldn't return to a workspace page.
    navigate('/login', { replace: true })
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
      {user && (
        <p className="account-email" title={user.email}>
          {user.email}
        </p>
      )}
      <button type="button" className="sidebar-item logout-button"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>
    </aside>
  )
}

export default Sidebar
