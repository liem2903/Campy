// One tag, as a note carries it (GET /api/notes/:id) and as the tag endpoints return it.
export type Tag = { id: string; name: string }
// One row of GET /api/tags.
export type TagWithNoteCount = Tag & { noteCount: number }

// "1 note", "3 notes".
export function noteCountText(noteCount: number): string {
  return `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`
}
