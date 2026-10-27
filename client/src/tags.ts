// One tag, as a note carries it (GET /api/notes/:id) and as the tag endpoints return it.
export type Tag = { id: string; name: string }
// One row of GET /api/tags.
export type TagWithNoteCount = Tag & { noteCount: number }

// "1 note", "3 notes".
export function noteCountText(noteCount: number): string {
  return `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`
}

// "queue", "queue or stack": the picked tags' names, for "2 pages tagged queue or stack".
export function selectedTagNamesText(tags: Tag[], selectedTagIds: string[]): string {
  return tags.filter((tag) => selectedTagIds.includes(tag.id)).map((tag) => tag.name).join(' or ')
}
