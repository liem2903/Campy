import { useEffect, useState } from 'react'
import { saveNoteToServer, type SaveResult } from './api.ts'
import { removeDraftIfSaved, writeDraft } from './drafts.ts'
import { useNotes, type NoteContent } from './notes.ts'
import { RETRY_MS } from './retry.ts'

// Save this long after the last keystroke…
const DEBOUNCE_MS = 500
// …but at least this often while the user types nonstop.
const MAX_WAIT_MS = 3000

export type SaveStatus =
  | { kind: 'saved' }
  // Waiting for the debounce, or a save is in flight.
  | { kind: 'saving' }
  // Network error, 5xx or 401 Unauthorized: tries again every RETRY_MS.
  | { kind: 'retrying' }
  // 400, 404 or 413: the same content would fail again, so it waits for the next edit.
  | { kind: 'rejected'; message: string }

type AutosaverOptions = {
  noteId: string
  waitForCreate: (noteId: string) => Promise<string | null>
  onSaved: (updatedAt: string) => void
  onStatusChange: (status: SaveStatus) => void
}

// The timing and retry logic, kept out of React so it reads top to bottom.
// One autosaver per open note page.
function createAutosaver({ noteId, waitForCreate, onSaved, onStatusChange }: AutosaverOptions) {
  // The newest edit not yet sent. null = nothing to save.
  let unsavedContent: NoteContent | null = null
  // The save loop currently running, so a second trigger joins it instead of starting another.
  let runningSave: Promise<void> | null = null
  let debounceTimer: number | undefined
  let maxWaitTimer: number | undefined
  let retryTimer: number | undefined
  // Off once the page has closed: it gets one last attempt, and the draft covers the rest.
  let retriesAllowed = true

  // Called on every edit.
  function schedule(content: NoteContent) {
    writeDraft(noteId, content)
    unsavedContent = content
    onStatusChange({ kind: 'saving' })
    clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(saveNow, DEBOUNCE_MS)
    maxWaitTimer ??= window.setTimeout(saveNow, MAX_WAIT_MS)
  }

  // Sends the unsaved content now. Resolves once it's saved or the attempt failed; it never
  // rejects and doesn't wait for retries. It does wait for a request in flight, which may never
  // answer, so logout caps how long it waits.
  function saveNow(): Promise<void> {
    clearAllTimers()
    runningSave ??= sendUntilSaved().finally(() => {
      runningSave = null
    })
    return runningSave
  }

  // One save in flight at a time. Edits made meanwhile pile up in unsavedContent and go out
  // together as the next save.
  async function sendUntilSaved(): Promise<void> {
    while (unsavedContent) {
      const contentToSave = unsavedContent
      unsavedContent = null
      const result = await send(contentToSave)

      if (result === 'retry') {
        unsavedContent ??= contentToSave // keep a newer edit if one arrived meanwhile
        onStatusChange({ kind: 'retrying' })
        if (retriesAllowed) retryTimer = window.setTimeout(saveNow, RETRY_MS)
        return
      }
      if (!result.saved) {
        // A newer edit may fix it (say, a shorter title), so send that one next.
        if (unsavedContent) continue
        unsavedContent = contentToSave // still unsaved: a flush or the leave prompt should know
        onStatusChange({ kind: 'rejected', message: result.message })
        return
      }

      onSaved(result.updatedAt)
      removeDraftIfSaved(noteId, contentToSave)
    }
    onStatusChange({ kind: 'saved' })
  }

  // A new note may not be on the server yet, so wait for its create and use the id it got.
  async function send(content: NoteContent): Promise<SaveResult | 'retry'> {
    try {
      const serverId = await waitForCreate(noteId)
      if (serverId === null) return { saved: false, message: 'This note was deleted' }
      return await saveNoteToServer(serverId, content)
    } catch {
      return 'retry'
    }
  }

  function clearAllTimers() {
    clearTimeout(debounceTimer)
    clearTimeout(maxWaitTimer)
    clearTimeout(retryTimer)
    debounceTimer = maxWaitTimer = retryTimer = undefined
  }

  // The page opened (React StrictMode closes and reopens it once in dev).
  function start() {
    retriesAllowed = true
  }

  // The page closed (in-app navigation or logout): send what's left once, without retries.
  function stop(): Promise<void> {
    retriesAllowed = false
    return saveNow()
  }

  return { schedule, saveNow, start, stop }
}

// Saves a note's title and body as the user types. Returns the status to show, the function to
// call on every edit, and one that sends a pending save now (resolving once it's done or failed).
export function useAutosave(noteId: string) {
  const { waitForCreate, markNoteSaved, registerFlush } = useNotes()
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'saved' })
  // Created once per page: NotePage gives each note its own editor (key={noteId}).
  const [autosaver] = useState(() =>
    createAutosaver({
      noteId,
      waitForCreate,
      onSaved: (updatedAt) => markNoteSaved(noteId, updatedAt),
      onStatusChange: setSaveStatus,
    }),
  )

  // Flush on in-app navigation (the page unmounts) and before logout (NotesProvider calls
  // every registered flush).
  useEffect(() => {
    autosaver.start()
    const unregisterFlush = registerFlush(autosaver.saveNow)
    return () => {
      unregisterFlush()
      void autosaver.stop()
    }
  }, [autosaver, registerFlush])

  // Closing or reloading the tab with unsaved edits: ask "Leave site?". The draft would restore
  // them anyway, but only in this browser.
  const hasUnsavedEdits = saveStatus.kind !== 'saved'
  useEffect(() => {
    if (!hasUnsavedEdits) return
    const askBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', askBeforeLeaving)
    return () => window.removeEventListener('beforeunload', askBeforeLeaving)
  }, [hasUnsavedEdits])

  return { saveStatus, scheduleSave: autosaver.schedule, saveNow: autosaver.saveNow }
}
