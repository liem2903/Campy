import { createContext, useContext } from 'react'
import type { Tag } from './tags.ts'

// One row of GET /api/notes. updatedAt is an ISO string; tagIds lets All Notes filter by tag.
export type NoteSummary = { id: string; title: string; updatedAt: string; tagIds: string[] }
// How a list item's marker is drawn: dots or numbers.
export type ListItemStyle = 'bullet' | 'numbered'
// One block of a note's body, as GET and PUT /api/notes/:id carry it: a paragraph, or a list
// item with its nested items. Consecutive list items form one list.
export type NoteBlock =
  | { id: string; type: 'text'; properties: { text: string } }
  | { id: string; type: 'list_item'; properties: { text: string; style: ListItemStyle }; children: NoteBlock[] }
// One note from GET /api/notes/:id. Tags are in name order and saved on their own, not by autosave.
export type NoteDetail = Omit<NoteSummary, 'tagIds'> & { blocks: NoteBlock[]; tags: Tag[] }
// The part of a note the user edits. Autosave sends both fields on every save.
export type NoteContent = Pick<NoteDetail, 'title' | 'blocks'>

export type NotesContextValue = {
  // Most recently edited first, as the server returns them.
  notes: NoteSummary[]
  loading: boolean
  // Set after a few failed loads; retries keep going.
  loadFailed: boolean
  createNote: () => string
  // Puts an edited note first with its new title, as the server will order it once saved.
  moveEditedNoteToTop: (id: string, title: string) => void
  // Keeps a note's tag ids in the list in step with tags added or removed on the note page.
  replaceTagIdsOfNoteInList: (id: string, tagIds: string[]) => void
  // Swaps the local updatedAt for the server's after a successful save.
  markNoteSaved: (id: string, updatedAt: string) => void
  // Removes the note from the list, stops its autosave and deletes its draft at once; the server
  // delete happens in the background.
  deleteNote: (id: string) => void
  // Resolves to the id the server stores the note under, once its create has succeeded (the id
  // changes after a 409 Conflict). null = the note was deleted.
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
