import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { NotesContext, type Note } from './notes.ts'

// Browser-only storage until the notes API exists.
const STORAGE_KEY = 'campi.notes'

function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Note[]) : []
  } catch {
    return []
  }
}

function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(loadNotes)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    } catch {
      // Storage unavailable (private mode, quota): keep working in memory.
    }
  }, [notes])

  const createNote = useCallback(() => {
    const id = crypto.randomUUID()
    setNotes((prev) => [...prev, { id, title: '', body: '', updatedAt: Date.now() }])
    return id
  }, [])

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note,
        ),
      )
    },
    [],
  )

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
  }, [])

  const value = useMemo(
    () => ({ notes, createNote, updateNote, deleteNote }),
    [notes, createNote, updateNote, deleteNote],
  )

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

export default NotesProvider
