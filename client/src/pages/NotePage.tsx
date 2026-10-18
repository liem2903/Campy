import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getNoteFromServer } from '../api.ts'
import { useNotes } from '../notes.ts'

function NotePage() {
  const { noteId: noteIdFromUrl } = useParams()
  const { notes: noteList, bodies: localBodies, loading, updateNote } = useNotes()
  const listEntry = noteList.find((n) => n.id === noteIdFromUrl)

  // The server's body, tagged with its note id: while the next note loads, the old one's
  // body doesn't match noteIdFromUrl, so it never shows on the wrong page.
  const [serverReply, setServerReply] = useState<{ id: string; body: string }>()
  useEffect(() => {
    if (!noteIdFromUrl) return
    // Set by the cleanup when noteIdFromUrl changes, so a late answer can't overwrite a newer one.
    let stale = false
    void getNoteFromServer(noteIdFromUrl).then(
      // null = 404 Not Found. For a note in our list, its create hasn't reached the server yet.
      (noteDetailOrNull) =>
        !stale && setServerReply({ id: noteIdFromUrl, body: noteDetailOrNull?.body ?? '' }),
      () => {}, // Other failures stay blank until autosave adds retries (Ticket 4).
    )
    return () => {
      stale = true
    }
  }, [noteIdFromUrl])

  // Until autosave (Ticket 4), a local copy wins over the server's. undefined = still loading.
  const serverBody = serverReply && serverReply.id === noteIdFromUrl ? serverReply.body : undefined
  const shownBody = (noteIdFromUrl && localBodies[noteIdFromUrl]) ?? serverBody
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Grow the body with its content so the page scrolls, not the textarea.
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [shownBody])

  // On a reload, wait for the list rather than flash "doesn't exist".
  if (loading) return null
  // The list holds only this user's notes, so another user's id lands here too.
  if (!listEntry) {
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
  if (shownBody === undefined) return null

  return (
    <article key={listEntry.id} className="paper">
      <p className="paper-crumbs">Notes / {listEntry.title || 'Untitled'}</p>
      <input
        className="note-title"
        value={listEntry.title}
        onChange={(e) => updateNote(listEntry.id, { title: e.target.value })}
        placeholder="Untitled"
        autoFocus={listEntry.title === ''}
      />
      <textarea
        ref={bodyRef}
        className="note-body"
        value={shownBody}
        onChange={(e) => updateNote(listEntry.id, { body: e.target.value })}
        placeholder="Start writing..."
      />
    </article>
  )
}

export default NotePage
