import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth.ts'
import { NotesContext, type Note } from './notes.ts'

// Browser-only storage until the notes API exists, one key per user so people
// sharing a browser don't see each other's notes in the app. Not a security
// boundary: anyone with the browser can still read every user's notes in DevTools.
const LEGACY_STORAGE_KEY = 'campi.notes'

function storageKey(userId: string): string {
  return `campi.notes.${userId}`
}

function parseNotes(raw: string | null): Note[] {
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  return Array.isArray(parsed) ? (parsed as Note[]) : []
}

function loadNotes(key: string): Note[] {
  try {
    const own = localStorage.getItem(key)
    if (own !== null) return parseNotes(own)
    // Notes saved before per-user keys belong to whoever logs in first; hand them
    // over once so nobody loses them, and nobody else sees them.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy === null) return []
    // Parse first: corrupt legacy data throws here and is left untouched.
    const notes = parseNotes(legacy)
    localStorage.setItem(key, legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return notes
  } catch {
    return []
  }
}

// Remounted (via key) whenever the user changes, so one user's notes can never
// be written under another user's key.
function UserNotesProvider({ storageKey: key, children }: { storageKey: string | null; children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(() => (key ? loadNotes(key) : []))

  useEffect(() => {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(notes))
    } catch {
      // Storage unavailable (private mode, quota): keep working in memory.
    }
  }, [key, notes])

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

function NotesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const key = user ? storageKey(user.id) : null
  return (
    <UserNotesProvider key={key ?? 'signed-out'} storageKey={key}>
      {children}
    </UserNotesProvider>
  )
}

export default NotesProvider
