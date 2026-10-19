import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { readDraft } from '../drafts.ts'
import { useNotes, type NoteContent } from '../notes.ts'
import { useAutosave, type SaveStatus } from '../useAutosave.ts'

const saveStatusLabels: Record<Exclude<SaveStatus['kind'], 'rejected'>, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  retrying: "Couldn't save. Retrying…",
}

// The title and body of one note, saved as the user types. NotePage renders it with
// key={noteId}, so each note gets a fresh editor and autosave.
function NoteEditor({ noteId, serverContent }: { noteId: string; serverContent: NoteContent }) {
  const { moveEditedNoteToTop } = useNotes()
  const { saveStatus, scheduleSave } = useAutosave(noteId)
  // Edits that never reached the server (expired session, closed tab, crash) win over its copy.
  const [restoredDraft] = useState(() => readDraft(noteId))
  const [content, setContent] = useState<NoteContent>(restoredDraft ?? serverContent)

  function edit(editedContent: NoteContent) {
    setContent(editedContent)
    moveEditedNoteToTop(noteId, editedContent.title)
    scheduleSave(editedContent)
  }

  // A restored draft is already on screen but not on the server: save it straight away.
  // Every dependency is stable, so this runs once, on open.
  useEffect(() => {
    if (!restoredDraft) return
    moveEditedNoteToTop(noteId, restoredDraft.title)
    scheduleSave(restoredDraft)
  }, [restoredDraft, noteId, moveEditedNoteToTop, scheduleSave])

  // Grow the body with its content so the page scrolls, not the textarea.
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content.body])

  const saveFailed = saveStatus.kind === 'retrying' || saveStatus.kind === 'rejected'
  const saveStatusText = saveStatus.kind === 'rejected' ? saveStatus.message : saveStatusLabels[saveStatus.kind]

  return (
    <article className="paper">
      <p className="paper-crumbs">
        Notes / {content.title || 'Untitled'}
        <span className="save-status" data-failed={saveFailed || undefined} role="status">
          {saveStatusText}
        </span>
      </p>
      <input
        className="note-title"
        value={content.title}
        onChange={(e) => edit({ ...content, title: e.target.value })}
        placeholder="Untitled"
        autoFocus={content.title === ''}
      />
      <textarea
        ref={bodyRef}
        className="note-body"
        value={content.body}
        onChange={(e) => edit({ ...content, body: e.target.value })}
        placeholder="Start writing..."
      />
    </article>
  )
}

export default NoteEditor
