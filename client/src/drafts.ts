import type { NoteBlock, NoteContent } from './notes.ts'

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
export function removeDraftIfSaved(noteId: string, savedContent: NoteContent): void {
  const draft = readDraft(noteId)
  const draftIsSavedContent =
    draft?.title === savedContent.title && JSON.stringify(draft.blocks) === JSON.stringify(savedContent.blocks)
  if (draftIsSavedContent) removeDraft(noteId)
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

// An old { title, body } draft or a corrupted one fails here and is ignored, instead of crashing
// the editor when it reads each block.
function isNoteContent(value: unknown): value is NoteContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'blocks' in value &&
    typeof value.title === 'string' &&
    Array.isArray(value.blocks) &&
    value.blocks.every(isNoteBlock)
  )
}

// A paragraph, or a list item whose children are all valid blocks too.
function isNoteBlock(value: unknown): value is NoteBlock {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('type' in value) ||
    !('properties' in value) ||
    typeof value.id !== 'string' ||
    typeof value.properties !== 'object' ||
    value.properties === null ||
    !('text' in value.properties) ||
    typeof value.properties.text !== 'string'
  ) return false
  if (value.type === 'text') return true
  return (
    value.type === 'list_item' &&
    'style' in value.properties &&
    (value.properties.style === 'bullet' || value.properties.style === 'numbered') &&
    'children' in value &&
    Array.isArray(value.children) &&
    value.children.every(isNoteBlock)
  )
}
