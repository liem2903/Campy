import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { createNoteOnServer } from './api.ts'
import { NotesContext, type Note } from './notes.ts'

// Browser-only storage until the notes API exists.
const STORAGE_KEY = 'campi.notes'
const RETRY_MS = 3000

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

  // Lets a long-running loop see the current notes; its own `notes` would be a stale snapshot.
  const notesRef = useRef(notes)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const navigate = useNavigate()

  // Creates the note on the server in the background, retrying until it succeeds.
  // The ref is only current after an await, so `gone()` is checked right after each one.
  const syncCreate = useCallback(
    async (firstId: string) => {
      let id = firstId
      const gone = () => !notesRef.current.some((note) => note.id === id)
      for (;;) {
        try {
          if ((await createNoteOnServer(id)) === 'created') return
          if (gone()) return
          // 409 Conflict: another user already owns this id, so switch to a fresh one.
          const oldId = id
          const newId = crypto.randomUUID()
          setNotes((prev) => prev.map((note) => (note.id === oldId ? { ...note, id: newId } : note)))
          if (window.location.pathname === `/notes/${oldId}`) {
            navigate(`/notes/${newId}`, { replace: true })
          }
          id = newId
        } catch {
          await wait(RETRY_MS)
          if (gone()) return
        }
      }
    },
    [navigate],
  )

  const createNote = useCallback(() => {
    const id = crypto.randomUUID()
    setNotes((prev) => [...prev, { id, title: '', body: '', updatedAt: Date.now() }])
    void syncCreate(id)
    return id
  }, [syncCreate])

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
