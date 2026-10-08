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
      <div className="page-content">
        <h1>This page doesn't exist</h1>
        <p>
          <Link to="/">Go home</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="page-content">
      <input
        key={note.id}
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
    </div>
  )
}

export default NotePage
