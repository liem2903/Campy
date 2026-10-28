import { useState, type KeyboardEvent } from 'react'
import { MAX_ANSWER_LENGTH, MAX_QUESTION_LENGTH, MAX_TAGS_PER_QUESTION, type QuestionFields } from '../questions.ts'
import TagNameInput from './TagNameInput.tsx'

const fieldClass =
  'box-border block w-full resize-y rounded-md border border-[var(--line)] bg-transparent px-2 py-1.5 text-[14px] leading-[1.5] text-text outline-none [font-family:inherit] focus:border-[var(--brand)]'

// A tag name the way the server stores it, or null when it can't be one.
function cleanedTagName(typedName: string): string | null {
  const cleanedName = typedName.trim().toLowerCase()
  return cleanedName.length >= 1 && cleanedName.length <= 50 ? cleanedName : null
}

// A question card open for editing. Nothing is saved until Save; Cancel or Esc goes back to the
// last saved text (or drops a card that was never saved). Ctrl/⌘ + Enter saves.
function QuestionCardEditor({ fields, aboutText, onAttachToCursorBlock, onFieldsChange, onSave, onCancel, isSaving }: {
  fields: QuestionFields
  // "General", "(deleted paragraph)" or the block's opening words.
  aboutText: string
  // Moves the card to the block the body's cursor was last in (or General when there's none).
  onAttachToCursorBlock: () => void
  onFieldsChange: (changedFields: QuestionFields) => void
  // Gets the fields to send, including a tag still typed in the input.
  onSave: (fieldsToSave: QuestionFields) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [typedTagName, setTypedTagName] = useState('')
  const canSave = fields.question.trim() !== '' && fields.answer.trim() !== '' && !isSaving

  // fields plus the typed tag, if it's a new valid one.
  function fieldsWithTypedTag(): QuestionFields {
    const tagName = cleanedTagName(typedTagName)
    if (tagName === null || fields.tags.includes(tagName) || fields.tags.length >= MAX_TAGS_PER_QUESTION) return fields
    return { ...fields, tags: [...fields.tags, tagName] }
  }

  function save() {
    if (!canSave) return
    setTypedTagName('')
    onSave(fieldsWithTypedTag())
  }

  function addPickedTag(pickedTagName: string) {
    if (!fields.tags.includes(pickedTagName)) onFieldsChange({ ...fields, tags: [...fields.tags, pickedTagName] })
    setTypedTagName('')
  }

  function cancelOrSaveOnShortcut(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel()
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      save()
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--brand)] p-3" onKeyDown={cancelOrSaveOnShortcut}>
      <div className="flex flex-col items-start gap-1 text-[12px] text-muted">
        <span>
          About: {aboutText}
          {fields.blockId !== null && (
            <button
              type="button"
              className="tag-stamp-remove ml-1"
              aria-label="Unlink from paragraph"
              onClick={() => onFieldsChange({ ...fields, blockId: null })}
            >
              ×
            </button>
          )}
        </span>
        <button
          type="button"
          onClick={onAttachToCursorBlock}
          disabled={isSaving}
          className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-muted underline-offset-2 [font-family:inherit] hover:text-text hover:underline"
        >
          Attach to current paragraph
        </button>
      </div>
      <textarea
        className={fieldClass}
        rows={2}
        value={fields.question}
        onChange={(e) => onFieldsChange({ ...fields, question: e.target.value })}
        readOnly={isSaving}
        maxLength={MAX_QUESTION_LENGTH}
        placeholder="Question"
        aria-label="Question"
        autoFocus
      />
      <textarea
        className={fieldClass}
        rows={3}
        value={fields.answer}
        onChange={(e) => onFieldsChange({ ...fields, answer: e.target.value })}
        readOnly={isSaving}
        maxLength={MAX_ANSWER_LENGTH}
        placeholder="Answer"
        aria-label="Answer"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {fields.tags.map((tagName) => (
          <span key={tagName} className="tag-stamp">
            {tagName}
            <button
              type="button"
              className="tag-stamp-remove"
              aria-label={`Remove tag ${tagName}`}
              onClick={() => onFieldsChange({ ...fields, tags: fields.tags.filter((name) => name !== tagName) })}
            >
              ×
            </button>
          </span>
        ))}
        {fields.tags.length < MAX_TAGS_PER_QUESTION && (
          <TagNameInput
            typedTagName={typedTagName}
            onTypedTagNameChange={setTypedTagName}
            takenTagNames={fields.tags}
            onPickTagName={addPickedTag}
            placeholder="+ Tag"
            ariaLabel="Add a tag to this question"
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-md border-0 bg-transparent px-3 py-1 text-[13px] text-muted [font-family:inherit] hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="cursor-pointer rounded-md border-0 bg-text px-3 py-1 text-[13px] font-medium text-bg [font-family:inherit] disabled:cursor-default disabled:opacity-35"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default QuestionCardEditor
