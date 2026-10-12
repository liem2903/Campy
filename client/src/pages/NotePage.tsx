import { useLayoutEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { useNotes } from '../notes.ts'

function NotePage() {
  const { noteId } = useParams()
  const { notes, updateNote } = useNotes()
  const note = notes.find((n) => n.id === noteId)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Grow the body with its content so the page scrolls, not the textarea.
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [note?.body])

  if (!note) {
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

  return (
    <article key={note.id} className="paper">
      <p className="paper-crumbs">Notes / {note.title || 'Untitled'}</p>
      <input
        className="note-title"
        value={note.title}
        onChange={(e) => updateNote(note.id, { title: e.target.value })}
        placeholder="Untitled"
        autoFocus={note.title === ''}
      />
      <textarea
        ref={bodyRef}
        className="note-body"
        value={note.body}
        onChange={(e) => updateNote(note.id, { body: e.target.value })}
        placeholder="Start writing..."
      />
    </article>
  )
}

export default NotePage
