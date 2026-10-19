import { createContext, useContext } from 'react'

// One row of GET /api/notes. updatedAt is an ISO string.
export type NoteSummary = { id: string; title: string; updatedAt: string }
// One note from GET /api/notes/:id (Ticket 3).
export type NoteDetail = NoteSummary & { body: string }
// The part of a note the user edits. Autosave sends both fields on every save.
export type NoteContent = Pick<NoteDetail, 'title' | 'body'>

export type NotesContextValue = {
  // Most recently edited first, as the server returns them.
  notes: NoteSummary[]
  loading: boolean
  // Set after a few failed loads; retries keep going.
  loadFailed: boolean
  createNote: () => string
  // Puts an edited note first with its new title, as the server will order it once saved.
  moveEditedNoteToTop: (id: string, title: string) => void
  // Swaps the local updatedAt for the server's after a successful save.
  markNoteSaved: (id: string, updatedAt: string) => void
  deleteNote: (id: string) => void
  // Resolves to the id the server stores the note under, once its create has succeeded (the id
  // changes after a 409 Conflict). null = deleted before it reached the server.
  waitForCreate: (id: string) => Promise<string | null>
  // Each open note page registers its autosave flush; the returned function unregisters it.
  registerFlush: (flush: () => Promise<void>) => () => void
  // Sends every pending save now. Logout awaits it so nothing typed is lost.
  flushAllSaves: () => Promise<void>
}

export const NotesContext = createContext<NotesContextValue | null>(null)

export function useNotes(): NotesContextValue {
  const value = useContext(NotesContext)
  if (!value) throw new Error('useNotes must be used inside NotesProvider')
  return value
}
