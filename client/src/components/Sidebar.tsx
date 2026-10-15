import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { logOut } from '../api.ts'
import { useAuth } from '../auth.ts'
import { useNotes } from '../notes.ts'
import { useTheme } from '../theme.ts'
import BrainMark from './BrainMark.tsx'

// How long × must be held before a note is deleted; the CSS fill reads it too.
const HOLD_MS = 1200

function Sidebar() {
  const { notes, createNote, deleteNote } = useNotes()
  const { noteId } = useParams()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, setUser } = useAuth()
  const [holdingId, setHoldingId] = useState<string | null>(null)
  const holdTimer = useRef<number | undefined>(undefined)

  // Don't let a pending delete fire after the sidebar is gone.
  useEffect(() => () => clearTimeout(holdTimer.current), [])

  function handleNew() {
    navigate(`/notes/${createNote()}`)
  }

  function handleDelete(id: string) {
    deleteNote(id)
    if (id === noteId) navigate('/')
  }

  function startHold(id: string) {
    clearTimeout(holdTimer.current)
    setHoldingId(id)
    holdTimer.current = window.setTimeout(() => {
      setHoldingId(null)
      handleDelete(id)
    }, HOLD_MS)
  }

  function cancelHold() {
    clearTimeout(holdTimer.current)
    setHoldingId(null)
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
      <nav className="sidebar-nav">
        <NavLink to="/" end className="sidebar-item">
          Home
        </NavLink>
        <NavLink to="/quiz" className="sidebar-item">
          Quiz
        </NavLink>
        <NavLink to="/notes" end className="sidebar-item">
          All notes
        </NavLink>
      </nav>
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
              aria-label={`Hold to delete ${note.title || 'Untitled'}`}
              title="Hold to delete"
              data-holding={holdingId === note.id || undefined}
              style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
              onPointerDown={() => startHold(note.id)}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold(note.id)
              }}
              onKeyUp={cancelHold}
              onBlur={cancelHold}
            >
              <span className="delete-page-fill" aria-hidden="true" />×
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
