import { createContext, useContext } from 'react'

// One row of GET /api/notes. updatedAt is an ISO string.
export type NoteSummary = { id: string; title: string; updatedAt: string }
// One note from GET /api/notes/:id (Ticket 3).
export type NoteDetail = NoteSummary & { body: string }

export type NotesContextValue = {
  // Most recently edited first, as the server returns them.
  notes: NoteSummary[]
  // Bodies by note id, kept in localStorage until autosave (Ticket 4).
  bodies: Record<string, string>
  loading: boolean
  // Set after a few failed loads; retries keep going.
  loadFailed: boolean
  createNote: () => string
  updateNote: (id: string, patch: Partial<Pick<NoteDetail, 'title' | 'body'>>) => void
  deleteNote: (id: string) => void
}

export const NotesContext = createContext<NotesContextValue | null>(null)

export function useNotes(): NotesContextValue {
  const value = useContext(NotesContext)
  if (!value) throw new Error('useNotes must be used inside NotesProvider')
  return value
}
