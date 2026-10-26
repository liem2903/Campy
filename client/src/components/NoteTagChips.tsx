import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { listTagsFromServer, tagNoteOnServer, untagNoteOnServer } from '../api.ts'
import { useNotes } from '../notes.ts'
import { noteCountText, type Tag, type TagWithNoteCount } from '../tags.ts'

const byName = (first: Tag, second: Tag) => first.name.localeCompare(second.name)

// One row of the suggestion list: an existing tag, or creating the typed name.
type Suggestion = { kind: 'existing'; tag: TagWithNoteCount } | { kind: 'create'; name: string }

// The tag stamps under a note's title. Each add or remove saves straight away, on its own: tags
// aren't part of the title and body autosave.
function NoteTagChips({ noteId, serverTags }: { noteId: string; serverTags: Tag[] }) {
  const { waitForCreate } = useNotes()
  const [noteTags, setNoteTags] = useState(serverTags)
  // null = the "+ Tag" button shows; a string = the input is open with this text in it.
  const [typedTagName, setTypedTagName] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<TagWithNoteCount[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  // Your other tags whose name contains what's typed, then "Create" when the name is new.
  // Matched the way the server stores names: trimmed and lowercased.
  const cleanedTypedName = (typedTagName ?? '').trim().toLowerCase()
  const suggestions: Suggestion[] = [
    ...allTags
      .filter((tag) => !noteTags.some((noteTag) => noteTag.id === tag.id) && tag.name.includes(cleanedTypedName))
      .map((tag) => ({ kind: 'existing' as const, tag })),
    ...(cleanedTypedName && !allTags.some((tag) => tag.name === cleanedTypedName)
      ? [{ kind: 'create' as const, name: cleanedTypedName }]
      : []),
  ]

  function openInput() {
    setTypedTagName('')
    setHighlightedIndex(0)
    // Suggestions are a nicety: if they fail to load, typing a name still works.
    listTagsFromServer().then(setAllTags, () => {})
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
      setHighlightedIndex(0)
    })
  }

  async function removeTag(removedTag: Tag) {
    await changeTagsOnServer(async (serverNoteId) => {
      await untagNoteOnServer(serverNoteId, removedTag.id)
      setNoteTags((prev) => prev.filter((tag) => tag.id !== removedTag.id))
    })
  }

  // Enter adds the highlighted suggestion, or the typed name when nothing matches.
  function addHighlightedOrTyped(event: FormEvent) {
    event.preventDefault()
    const highlighted = suggestions[highlightedIndex]
    if (highlighted) void addTag(highlighted.kind === 'existing' ? highlighted.tag.name : highlighted.name)
    else if (cleanedTypedName) void addTag(cleanedTypedName)
  }

  function moveHighlightOrClose(event: KeyboardEvent) {
    if (event.key === 'Escape') closeInput()
    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || suggestions.length === 0) return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    setHighlightedIndex((index) => (index + step + suggestions.length) % suggestions.length)
  }

  return (
    <div className="note-tags">
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
        <form className="tag-stamp-form" onSubmit={addHighlightedOrTyped}>
          <input
            className="tag-stamp-input"
            value={typedTagName}
            onChange={(e) => {
              setTypedTagName(e.target.value)
              setHighlightedIndex(0)
            }}
            onKeyDown={moveHighlightOrClose}
            onBlur={closeInput}
            maxLength={50}
            placeholder="Tag name"
            aria-label="New tag"
            aria-autocomplete="list"
            autoFocus
          />
          {suggestions.length > 0 && (
            <ul className="tag-suggestions" role="listbox">
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.kind === 'existing' ? suggestion.tag.id : 'create'}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  // mousedown, not click: it runs before the input's blur closes the list.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void addTag(suggestion.kind === 'existing' ? suggestion.tag.name : suggestion.name)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {suggestion.kind === 'existing' ? (
                    <>
                      <span>{suggestion.tag.name}</span>
                      <span className="tag-suggestion-hint">{noteCountText(suggestion.tag.noteCount)}</span>
                    </>
                  ) : (
                    <>
                      <span>Create “{suggestion.name}”</span>
                      <span className="tag-suggestion-hint">Enter</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </form>
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
