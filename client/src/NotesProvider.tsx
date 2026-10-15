import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { createNoteOnServer, listNotes } from './api.ts'
import { useAuth } from './auth.ts'
import { NotesContext, type NoteDetail, type NoteSummary } from './notes.ts'

// Note bodies by id, browser-only until autosave (Ticket 4).
const STORAGE_KEY = 'campi.notes'
const RETRY_MS = 3000
// Failed loads before the sidebar says so.
const FAILS_BEFORE_MESSAGE = 3

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function loadBodies(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    // The old format was an array of notes; start fresh rather than misread it.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {}
  } catch {
    return {}
  }
}

function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [bodies, setBodies] = useState<Record<string, string>>(loadBodies)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const userId = useAuth().user?.id

  // Load this user's list whenever the user changes. The cleanup marks the run stale, so a
  // late answer for the previous user is dropped, and clears the list so nobody sees theirs.
  useEffect(() => {
    if (!userId) return
    let stale = false
    void (async () => {
      for (let fails = 0; ; ) {
        try {
          const list = await listNotes()
          if (stale) return
          setNotes(list)
          setLoading(false)
          setLoadFailed(false)
          return
        } catch {
          if (stale) return
          if (++fails >= FAILS_BEFORE_MESSAGE) setLoadFailed(true)
          await wait(RETRY_MS)
          if (stale) return
        }
      }
    })()
    return () => {
      stale = true
      setNotes([])
      setLoading(true)
      setLoadFailed(false)
    }
  }, [userId])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bodies))
    } catch {
      // Storage unavailable (private mode, quota): keep working in memory.
    }
  }, [bodies])

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
    // Newest first, matching the server's order.
    setNotes((prev) => [{ id, title: '', updatedAt: new Date().toISOString() }, ...prev])
    void syncCreate(id)
    return id
  }, [syncCreate])

  const updateNote = useCallback(
    (id: string, patch: Partial<Pick<NoteDetail, 'title' | 'body'>>) => {
      const { title, body } = patch
      const updatedAt = new Date().toISOString()
      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, ...(title !== undefined && { title }), updatedAt } : note,
        ),
      )
      if (body !== undefined) setBodies((prev) => ({ ...prev, [id]: body }))
    },
    [],
  )

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((note) => note.id !== id))
    setBodies(({ [id]: _removed, ...rest }) => rest)
  }, [])

  const value = useMemo(
    () => ({ notes, bodies, loading, loadFailed, createNote, updateNote, deleteNote }),
    [notes, bodies, loading, loadFailed, createNote, updateNote, deleteNote],
  )

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

export default NotesProvider
