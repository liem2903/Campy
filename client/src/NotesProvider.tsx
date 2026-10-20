import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { createNoteOnServer, deleteNoteOnServer, listNotes } from './api.ts'
import { useAuth } from './auth.ts'
import { moveDraft, removeDraft } from './drafts.ts'
import { NotesContext, type NoteSummary } from './notes.ts'
import { RETRY_MS, wait } from './retry.ts'

// Failed loads before the sidebar says so.
const FAILS_BEFORE_MESSAGE = 3
// Where note bodies lived before autosave. Removed once on load.
const OLD_BODIES_STORAGE_KEY = 'campi.notes'

function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<NoteSummary[]>([])
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

  // Bodies are on the server now, so the old browser-only copy is just stale data.
  useEffect(() => {
    try {
      localStorage.removeItem(OLD_BODIES_STORAGE_KEY)
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }, [])

  // Lets a long-running loop see the current notes; its own `notes` would be a stale snapshot.
  const notesRef = useRef(notes)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  // Note id → the id its create finally succeeded under (null = deleted). Autosave awaits
  // this before saving a new note. Entries stay after they resolve: a resolved promise still gives
  // the right answer, and there's one small entry per note created this session.
  const finalIdsRef = useRef(new Map<string, Promise<string | null>>())
  const navigate = useNavigate()

  // Creates the note on the server in the background, retrying until it succeeds.
  // Resolves to the id it was created under, or null if the note was deleted first.
  // The ref is only current after an await, so `gone()` is checked right after each one.
  const syncCreate = useCallback(
    async (firstId: string): Promise<string | null> => {
      let id = firstId
      const gone = () => !notesRef.current.some((note) => note.id === id)
      for (;;) {
        try {
          if ((await createNoteOnServer(id)) === 'created') return id
          if (gone()) return null
          // 409 Conflict: another user already owns this id, so switch to a fresh one.
          const oldId = id
          const newId = crypto.randomUUID()
          // Saves made under either id wait for the same create.
          finalIdsRef.current.set(newId, finalIdsRef.current.get(oldId)!)
          moveDraft(oldId, newId)
          setNotes((prev) => prev.map((note) => (note.id === oldId ? { ...note, id: newId } : note)))
          if (window.location.pathname === `/notes/${oldId}`) {
            navigate(`/notes/${newId}`, { replace: true })
          }
          id = newId
        } catch {
          await wait(RETRY_MS)
          if (gone()) return null
        }
      }
    },
    [navigate],
  )

  const createNote = useCallback(() => {
    const id = crypto.randomUUID()
    // Newest first, matching the server's order.
    setNotes((prev) => [{ id, title: '', updatedAt: new Date().toISOString() }, ...prev])
    finalIdsRef.current.set(id, syncCreate(id))
    return id
  }, [syncCreate])

  // A note already on the server (loaded in the list) has no entry and resolves to its own id.
  const waitForCreate = useCallback(
    (id: string) => finalIdsRef.current.get(id) ?? Promise.resolve(id),
    [],
  )

  // Runs on every keystroke, so the sidebar updates before the save goes out.
  const moveEditedNoteToTop = useCallback((id: string, title: string) => {
    setNotes((prev) => {
      const editedNote = prev.find((note) => note.id === id)
      if (!editedNote) return prev
      const otherNotes = prev.filter((note) => note.id !== id)
      return [{ ...editedNote, title, updatedAt: new Date().toISOString() }, ...otherNotes]
    })
  }, [])

  const markNoteSaved = useCallback((id: string, updatedAt: string) => {
    setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, updatedAt } : note)))
  }, [])

  // Removes the note right away and deletes it on the server in the background.
  const deleteNote = useCallback(
    (id: string) => {
      // Read before the next line replaces it: it resolves to the id the server has the note under.
      const serverIdPromise = waitForCreate(id)
      // From now on autosave gets null ("deleted") for this note, so it sends no more saves.
      finalIdsRef.current.set(id, Promise.resolve(null))
      setNotes((prev) => prev.filter((note) => note.id !== id))
      removeDraft(id)
      void syncDelete(serverIdPromise)
    },
    [waitForCreate],
  )

  // The flush function of every open note page's autosave.
  const flushesRef = useRef(new Set<() => Promise<void>>())

  const registerFlush = useCallback((flush: () => Promise<void>) => {
    flushesRef.current.add(flush)
    return () => {
      flushesRef.current.delete(flush)
    }
  }, [])

  const flushAllSaves = useCallback(async () => {
    await Promise.all([...flushesRef.current].map((flush) => flush()))
  }, [])

  const value = useMemo(
    () => ({
      notes,
      loading,
      loadFailed,
      createNote,
      moveEditedNoteToTop,
      markNoteSaved,
      deleteNote,
      waitForCreate,
      registerFlush,
      flushAllSaves,
    }),
    [notes, loading, loadFailed, createNote, moveEditedNoteToTop, markNoteSaved, deleteNote,
      waitForCreate, registerFlush, flushAllSaves],
  )

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

// Deletes the note on the server, retrying until it's gone. It waits for the note's create
// first: a DELETE that beat the POST would get a 404, and then the POST would bring the note back.
async function syncDelete(serverIdPromise: Promise<string | null>): Promise<void> {
  const serverId = await serverIdPromise
  if (serverId === null) return // its create never succeeded, so the server has nothing to delete
  for (;;) {
    try {
      await deleteNoteOnServer(serverId)
      return
    } catch {
      await wait(RETRY_MS)
    }
  }
}

export default NotesProvider
