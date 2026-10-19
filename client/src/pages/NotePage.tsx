import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getNoteFromServer } from '../api.ts'
import NoteEditor from '../components/NoteEditor.tsx'
import { useNotes, type NoteContent } from '../notes.ts'
import { RETRY_MS, wait } from '../retry.ts'

function NotePage() {
  const { noteId: noteIdFromUrl } = useParams()
  const { notes: noteList, loading } = useNotes()
  const listEntry = noteList.find((n) => n.id === noteIdFromUrl)

  // The server's copy, tagged with its note id: while the next note loads, the old one's
  // content doesn't match noteIdFromUrl, so it never shows on the wrong page.
  const [serverReply, setServerReply] = useState<{ id: string; content: NoteContent }>()
  useEffect(() => {
    if (!noteIdFromUrl) return
    // Set by the cleanup when noteIdFromUrl changes, so a late answer can't overwrite a newer one.
    let stale = false
    void (async () => {
      for (;;) {
        try {
          // null = 404 Not Found. For a note in our list, its create hasn't reached the server yet.
          const noteDetailOrNull = await getNoteFromServer(noteIdFromUrl)
          if (stale) return
          const content = { title: noteDetailOrNull?.title ?? '', body: noteDetailOrNull?.body ?? '' }
          setServerReply({ id: noteIdFromUrl, content })
          return
        } catch {
          // Network error or 5xx: stay blank and try again.
          await wait(RETRY_MS)
          if (stale) return
        }
      }
    })()
    return () => {
      stale = true
    }
  }, [noteIdFromUrl])

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
  if (serverReply?.id !== listEntry.id) return null

  return <NoteEditor key={listEntry.id} noteId={listEntry.id} serverContent={serverReply.content} />
}

export default NotePage
