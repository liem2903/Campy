import { useState, type KeyboardEvent } from 'react'
import { listTagsFromServer } from '../api.ts'
import { noteCountText, type TagWithNoteCount } from '../tags.ts'

// One row of the suggestion list: an existing tag, or creating the typed name.
type Suggestion = { kind: 'existing'; tag: TagWithNoteCount } | { kind: 'create'; name: string }

// A tag-name input that lists your other tags while it has focus: those whose name contains what's
// typed, then "Create" when the name is new. Enter or a click picks a row. The parent owns the text.
function TagNameInput({ typedTagName, onTypedTagNameChange, takenTagNames, onPickTagName, onBlur, placeholder, ariaLabel, autoFocus = false }: {
  typedTagName: string
  onTypedTagNameChange: (changedTagName: string) => void
  // Tags already on the note or question: left out of the list.
  takenTagNames: string[]
  // Gets the name trimmed and lowercased, the way the server stores it.
  onPickTagName: (pickedTagName: string) => void
  onBlur?: () => void
  placeholder: string
  ariaLabel: string
  autoFocus?: boolean
}) {
  const [allTags, setAllTags] = useState<TagWithNoteCount[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  const cleanedTypedName = typedTagName.trim().toLowerCase()
  const suggestions: Suggestion[] = [
    ...allTags
      .filter((tag) => !takenTagNames.includes(tag.name) && tag.name.includes(cleanedTypedName))
      .map((tag) => ({ kind: 'existing' as const, tag })),
    ...(cleanedTypedName && !allTags.some((tag) => tag.name === cleanedTypedName)
      ? [{ kind: 'create' as const, name: cleanedTypedName }]
      : []),
  ]

  function startSuggesting() {
    setIsFocused(true)
    setHighlightedIndex(0)
    // Suggestions are a nicety: if they fail to load, typing a name still works.
    listTagsFromServer().then(setAllTags, () => {})
  }

  function pickSuggestion(suggestion: Suggestion) {
    onPickTagName(suggestion.kind === 'existing' ? suggestion.tag.name : suggestion.name)
    setHighlightedIndex(0)
  }

  // Enter picks the highlighted row; arrows move it. Esc and Ctrl/⌘ + Enter are left to the parent.
  function pickOrMoveHighlight(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      const highlighted = suggestions[highlightedIndex]
      if (highlighted) pickSuggestion(highlighted)
    }
    if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || suggestions.length === 0) return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    setHighlightedIndex((index) => (index + step + suggestions.length) % suggestions.length)
  }

  return (
    <span className="tag-stamp-form">
      <input
        className="tag-stamp-input"
        value={typedTagName}
        onChange={(e) => {
          onTypedTagNameChange(e.target.value)
          setHighlightedIndex(0)
        }}
        onFocus={startSuggesting}
        onBlur={() => {
          setIsFocused(false)
          onBlur?.()
        }}
        onKeyDown={pickOrMoveHighlight}
        maxLength={50}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        autoFocus={autoFocus}
      />
      {isFocused && suggestions.length > 0 && (
        <ul className="tag-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.kind === 'existing' ? suggestion.tag.id : 'create'}
              role="option"
              aria-selected={index === highlightedIndex}
              // mousedown, not click: it runs before the input's blur hides the list.
              onMouseDown={(e) => {
                e.preventDefault()
                pickSuggestion(suggestion)
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
    </span>
  )
}

export default TagNameInput
