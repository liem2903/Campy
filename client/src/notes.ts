import { createContext, useContext } from 'react'

export type Note = {
  id: string
  title: string
  body: string
  updatedAt: number
}

export type NotesContextValue = {
  // In creation order, as shown in the sidebar.
  notes: Note[]
  createNote: () => string
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void
  deleteNote: (id: string) => void
}

export const NotesContext = createContext<NotesContextValue | null>(null)

export function useNotes(): NotesContextValue {
  const value = useContext(NotesContext)
  if (!value) throw new Error('useNotes must be used inside NotesProvider')
  return value
}
