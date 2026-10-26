import { useEffect, useState, type FormEvent } from 'react'
import { createTagOnServer, deleteTagOnServer, listTagsFromServer, renameTagOnServer } from '../api.ts'
import { noteCountText, type TagWithNoteCount } from '../tags.ts'

// Every tag as a card with its note count. Create, rename and delete here; adding a tag to a note
// happens on the note. After each change the list is fetched again, so names, order and counts
// are the server's.
function TagsPage() {
  // null until the first list arrives.
  const [tags, setTags] = useState<TagWithNoteCount[] | null>(null)
  // null = the "+ New tag" button shows; a string = its input is open with this text in it.
  const [newTagName, setNewTagName] = useState<string | null>(null)
  // The tag being renamed and the name typed so far; null = no rename in progress.
  const [tagBeingRenamed, setTagBeingRenamed] = useState<{ id: string; typedName: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    listTagsFromServer().then(setTags, () => setErrorMessage("Couldn't load your tags. Try reloading the page."))
  }, [])

  // Runs one change, then reloads the list. Shows the server's message (e.g. a 409 Conflict's
  // "A tag called queue already exists") and returns false when it fails.
  async function changeThenReload(change: () => Promise<unknown>): Promise<boolean> {
    try {
      await change()
      setTags(await listTagsFromServer())
      setErrorMessage('')
      return true
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
      return false
    }
  }

  // On success the input stays open and empty, so several tags can be made in a row.
  async function createTypedTag(event: FormEvent) {
    event.preventDefault()
    if (!newTagName?.trim()) return
    if (await changeThenReload(() => createTagOnServer(newTagName))) setNewTagName('')
  }

  // On a failed rename the input stays open with the typed name, so it can be fixed.
  async function saveRename(event: FormEvent) {
    event.preventDefault()
    if (!tagBeingRenamed?.typedName.trim()) return
    const { id, typedName } = tagBeingRenamed
    if (await changeThenReload(() => renameTagOnServer(id, typedName))) setTagBeingRenamed(null)
  }

  async function deleteAfterConfirm(tag: TagWithNoteCount) {
    const question = tag.noteCount === 0
      ? `Delete ${tag.name}?`
      : `Remove ${tag.name} from ${noteCountText(tag.noteCount)}?`
    if (window.confirm(question)) await changeThenReload(() => deleteTagOnServer(tag.id))
  }

  return (
    <div className="page-content tags-page">
      <h1 className="auth-title">
        Your <em>tags.</em>
      </h1>
      {newTagName === null ? (
        <button type="button" className="tag-stamp-add" onClick={() => setNewTagName('')}>
          + New tag
        </button>
      ) : (
        <form className="tag-stamp-form" onSubmit={createTypedTag}>
          <input
            className="tag-stamp-input"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNewTagName(null)}
            onBlur={() => newTagName.trim() === '' && setNewTagName(null)}
            maxLength={50}
            placeholder="Tag name"
            aria-label="New tag"
            autoFocus
          />
        </form>
      )}
      {errorMessage && (
        <p className="tag-error" role="alert">
          {errorMessage}
        </p>
      )}
      {tags?.length === 0 && <p className="auth-lede">No tags yet. Add one here or on a note.</p>}
      <ul className="tag-shelf">
        {tags?.map((tag) => (
          <li key={tag.id} className="tag-card">
            {tagBeingRenamed?.id === tag.id ? (
              <form className="tag-stamp-form" onSubmit={saveRename}>
                <input
                  className="tag-stamp-input"
                  value={tagBeingRenamed.typedName}
                  onChange={(e) => setTagBeingRenamed({ id: tag.id, typedName: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && setTagBeingRenamed(null)}
                  maxLength={50}
                  aria-label={`New name for ${tag.name}`}
                  autoFocus
                />
              </form>
            ) : (
              <span className="tag-stamp">{tag.name}</span>
            )}
            <span className="tag-card-count">
              {tag.noteCount}
              <small>{tag.noteCount === 1 ? 'note' : 'notes'}</small>
            </span>
            <span className="tag-card-actions">
              <button type="button" onClick={() => setTagBeingRenamed({ id: tag.id, typedName: tag.name })}>
                Rename
              </button>
              <button type="button" onClick={() => deleteAfterConfirm(tag)}>
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TagsPage
