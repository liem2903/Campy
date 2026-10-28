import { useState, type Dispatch, type SetStateAction } from 'react'
import { tagNoteOnServer, untagNoteOnServer } from '../api.ts'
import { useNotes } from '../notes.ts'
import type { Tag } from '../tags.ts'
import TagNameInput from './TagNameInput.tsx'

const byName = (first: Tag, second: Tag) => first.name.localeCompare(second.name)

// The tag stamps under a note's title. Each add or remove saves straight away, on its own: tags
// aren't part of the title and body autosave. NoteEditor holds the tags, so new questions can
// start with them.
function NoteTagChips({ noteId, noteTags, setNoteTags }: {
  noteId: string
  noteTags: Tag[]
  setNoteTags: Dispatch<SetStateAction<Tag[]>>
}) {
  const { waitForCreate } = useNotes()
  // null = the "+ Tag" button shows; a string = the input is open with this text in it.
  const [typedTagName, setTypedTagName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  function openInput() {
    setTypedTagName('')
  }

  function closeInput() {
    setTypedTagName(null)
    setErrorMessage('')
  }

  // Runs a tag change against the note's server id: a note made moments ago may still be on its
  // way to the server. Shows the server's message when it fails.
  async function changeTagsOnServer(change: (serverNoteId: string) => Promise<void>) {
    try {
      const serverNoteId = await waitForCreate(noteId)
      if (serverNoteId === null) return // the note was deleted meanwhile
      await change(serverNoteId)
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't save the tag")
    }
  }

  async function addTag(name: string) {
    await changeTagsOnServer(async (serverNoteId) => {
      const addedTag = await tagNoteOnServer(serverNoteId, name)
      // Already on the note = the server changed nothing, so neither do we.
      setNoteTags((prev) => (prev.some((tag) => tag.id === addedTag.id) ? prev : [...prev, addedTag].sort(byName)))
      // Stays open, so several tags can be added in a row.
      setTypedTagName('')
    })
  }

  async function removeTag(removedTag: Tag) {
    await changeTagsOnServer(async (serverNoteId) => {
      await untagNoteOnServer(serverNoteId, removedTag.id)
      setNoteTags((prev) => prev.filter((tag) => tag.id !== removedTag.id))
    })
  }

  return (
    <div className="note-tags" onKeyDown={(e) => e.key === 'Escape' && closeInput()}>
      {noteTags.map((tag) => (
        <span key={tag.id} className="tag-stamp">
          {tag.name}
          <button type="button" className="tag-stamp-remove" aria-label={`Remove tag ${tag.name}`} onClick={() => removeTag(tag)}>
            ×
          </button>
        </span>
      ))}
      {typedTagName === null ? (
        <button type="button" className="tag-stamp-add" onClick={openInput}>
          + Tag
        </button>
      ) : (
        <TagNameInput
          typedTagName={typedTagName}
          onTypedTagNameChange={setTypedTagName}
          takenTagNames={noteTags.map((tag) => tag.name)}
          onPickTagName={(pickedTagName) => void addTag(pickedTagName)}
          onBlur={closeInput}
          placeholder="Tag name"
          ariaLabel="New tag"
          autoFocus
        />
      )}
      {errorMessage && (
        <p className="tag-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}

export default NoteTagChips
