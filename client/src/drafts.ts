import type { NoteContent } from './notes.ts'

// Unsaved edits per note, kept in localStorage until the server has them. They survive an
// expired session, a closed tab or a crash, and NotePage restores them on open.
// Storage errors (private mode, quota) are swallowed: drafts are a safety net, not a must.

const draftKey = (noteId: string) => `campi.draft.${noteId}`

export function readDraft(noteId: string): NoteContent | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(draftKey(noteId)) ?? 'null')
    return isNoteContent(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeDraft(noteId: string, content: NoteContent): void {
  try {
    localStorage.setItem(draftKey(noteId), JSON.stringify(content))
  } catch {
    // Storage unavailable: autosave still works, there's just no safety net.
  }
}

// Removes the draft only if it still holds `savedContent`. If a newer edit has overwritten it
// (say, the note was reopened while this save was in flight), that edit isn't saved yet: keep it.
export function removeDraftIfSaved(_noteId: string, _savedContent: NoteContent): void {
  throw new Error('Not implemented')
}

// After a 409 Conflict the note gets a new id; its draft follows it.
export function moveDraft(fromNoteId: string, toNoteId: string): void {
  const draft = readDraft(fromNoteId)
  if (!draft) return
  writeDraft(toNoteId, draft)
  removeDraft(fromNoteId)
}

export function removeDraft(noteId: string): void {
  try {
    localStorage.removeItem(draftKey(noteId))
  } catch {
    // Storage unavailable: nothing was stored, so nothing to remove.
  }
}

function isNoteContent(_value: unknown): _value is NoteContent {
  throw new Error('Not implemented')
}
