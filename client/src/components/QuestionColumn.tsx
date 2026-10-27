import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createQuestionOnServer, deleteQuestionOnServer, listQuestionsFromServer, updateQuestionOnServer } from '../api.ts'
import { useNotes } from '../notes.ts'
import { questionCountText, type Question, type QuestionFields } from '../questions.ts'
import { RETRY_MS, wait } from '../retry.ts'
import type { Tag } from '../tags.ts'
import { useAskBeforeLeaving } from '../useAskBeforeLeaving.ts'
import QuestionCard from './QuestionCard.tsx'
import QuestionCardEditor from './QuestionCardEditor.tsx'
import QuestionTestCard from './QuestionTestCard.tsx'

const UNSAVED_QUESTION_WARNING = 'You have an unsaved question. Leave anyway?'
const HIDDEN_STORAGE_KEY = 'campi.questionsHidden'

// The one card open for editing: an existing question's id, or null for a new card not saved
// yet. startingFields is what Cancel goes back to and what "unsaved" is measured against.
type CardBeingEdited = { questionId: string | null; fields: QuestionFields; startingFields: QuestionFields }

function readHiddenPreference(): boolean {
  try {
    return localStorage.getItem(HIDDEN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberHiddenPreference(isHidden: boolean) {
  try {
    localStorage.setItem(HIDDEN_STORAGE_KEY, String(isHidden))
  } catch {
    // Storage blocked: the toggle still works, it just isn't remembered.
  }
}

function sameFields(first: QuestionFields, second: QuestionFields): boolean {
  return first.question === second.question
    && first.answer === second.answer
    && first.tags.join('\n') === second.tags.join('\n')
}

// The Cornell cue column left of a note's body: its questions oldest first, answers hidden until
// clicked. "+ Question" or Ctrl/⌘ + Alt/Option + M adds one, pre-filled with the note's tags.
// "Test yourself" swaps the list for one card at a time; NoteEditor covers the body meanwhile,
// which is why it owns isTesting.
function QuestionColumn({ noteId, noteTags, isTesting, onTestingChange }: {
  noteId: string
  noteTags: Tag[]
  isTesting: boolean
  onTestingChange: (isTesting: boolean) => void
}) {
  const { waitForCreate } = useNotes()
  // null until the first list arrives.
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [cardBeingEdited, setCardBeingEdited] = useState<CardBeingEdited | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [questionIdsShowingAnswer, setQuestionIdsShowingAnswer] = useState<ReadonlySet<string>>(new Set())
  const [isHidden, setIsHidden] = useState(readHiddenPreference)
  const testButtonRef = useRef<HTMLButtonElement>(null)
  // Set by Stop/Finish, so focus goes back to "Test yourself" instead of falling to the page.
  const shouldFocusTestButtonRef = useRef(false)

  const hasUnsavedEdit = cardBeingEdited !== null && !sameFields(cardBeingEdited.fields, cardBeingEdited.startingFields)
  useAskBeforeLeaving(hasUnsavedEdit, UNSAVED_QUESTION_WARNING)

  // Retries until it loads. A note made moments ago may still be on its way to the server.
  useEffect(() => {
    let stale = false
    void (async () => {
      for (;;) {
        try {
          const serverNoteId = await waitForCreate(noteId)
          if (stale || serverNoteId === null) return
          const loadedQuestions = await listQuestionsFromServer(serverNoteId)
          if (!stale) setQuestions(loadedQuestions)
          return
        } catch {
          await wait(RETRY_MS)
          if (stale) return
        }
      }
    })()
    return () => {
      stale = true
    }
  }, [noteId, waitForCreate])

  useEffect(() => {
    if (isTesting || !shouldFocusTestButtonRef.current) return
    shouldFocusTestButtonRef.current = false
    testButtonRef.current?.focus()
  }, [isTesting])

  function stopTest() {
    shouldFocusTestButtonRef.current = true
    onTestingChange(false)
  }

  function setHiddenAndRemember(hidden: boolean) {
    setIsHidden(hidden)
    rememberHiddenPreference(hidden)
  }

  // Only one card is open at a time, so opening another asks first if this one has changes.
  function openCard(questionId: string | null, startingFields: QuestionFields) {
    if (hasUnsavedEdit && !window.confirm(UNSAVED_QUESTION_WARNING)) return
    setCardBeingEdited({ questionId, fields: startingFields, startingFields })
    setErrorMessage('')
    setHiddenAndRemember(false)
    onTestingChange(false)
  }

  // A one-off copy of the note's tags: remove any before saving.
  function openNewCard() {
    openCard(null, { question: '', answer: '', tags: noteTags.map((tag) => tag.name) })
  }

  function openSavedCard(question: Question) {
    openCard(question.id, { question: question.question, answer: question.answer, tags: question.tags.map((tag) => tag.name) })
  }

  // event.code, not event.key: Option + M types "µ" on a Mac.
  const openNewCardOnShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.code !== 'KeyM' || !event.altKey || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    openNewCard()
  })
  useEffect(() => {
    window.addEventListener('keydown', openNewCardOnShortcut)
    return () => window.removeEventListener('keydown', openNewCardOnShortcut)
  }, [])

  async function saveCard(questionId: string | null, fieldsToSave: QuestionFields) {
    setIsSaving(true)
    try {
      const serverNoteId = await waitForCreate(noteId)
      if (serverNoteId === null) return // the note was deleted meanwhile
      const savedQuestion = questionId === null
        ? await createQuestionOnServer(serverNoteId, fieldsToSave)
        : await updateQuestionOnServer(questionId, fieldsToSave)
      setQuestions((prev) => questionId === null
        ? [...(prev ?? []), savedQuestion]
        : (prev ?? []).map((question) => (question.id === questionId ? savedQuestion : question)))
      setCardBeingEdited(null)
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't save the question")
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteAfterConfirm(deletedQuestion: Question) {
    if (!window.confirm('Delete this question?')) return
    try {
      await deleteQuestionOnServer(deletedQuestion.id)
      setQuestions((prev) => (prev ?? []).filter((question) => question.id !== deletedQuestion.id))
      setErrorMessage('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't delete the question")
    }
  }

  function toggleAnswer(questionId: string) {
    setQuestionIdsShowingAnswer((prev) => {
      const next = new Set(prev)
      if (!next.delete(questionId)) next.add(questionId)
      return next
    })
  }

  function renderEditor(editedCard: CardBeingEdited) {
    return (
      <QuestionCardEditor
        fields={editedCard.fields}
        onFieldsChange={(changedFields) => setCardBeingEdited({ ...editedCard, fields: changedFields })}
        onSave={(fieldsToSave) => saveCard(editedCard.questionId, fieldsToSave)}
        onCancel={() => setCardBeingEdited(null)}
        isSaving={isSaving}
      />
    )
  }

  const questionCountLabel = questions === null ? 'Questions' : questionCountText(questions.length)
  // Not while a card is open, so starting a test can't drop an unsaved edit.
  const canStartTest = questions !== null && questions.length > 0 && cardBeingEdited === null

  if (isTesting && questions !== null) {
    return (
      <aside className="question-column" aria-label="Questions">
        <QuestionTestCard questions={questions} onStop={stopTest} />
      </aside>
    )
  }

  return (
    <aside className="question-column" aria-label="Questions" data-hidden={isHidden || undefined}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        {isHidden ? (
          <button type="button" className="tag-stamp-add whitespace-nowrap" onClick={() => setHiddenAndRemember(false)}>
            {questionCountLabel}
          </button>
        ) : (
          <>
            <button type="button" className="tag-stamp-add whitespace-nowrap" onClick={openNewCard} aria-keyshortcuts="Control+Alt+M">
              + Question <kbd className="crumbs-key-hint tracking-normal normal-case max-sm:hidden">Ctrl + Alt + M</kbd>
            </button>
            {canStartTest && (
              <button ref={testButtonRef} type="button" className="test-card-button w-full" onClick={() => onTestingChange(true)}>
                Test yourself
              </button>
            )}
            <button
              type="button"
              onClick={() => setHiddenAndRemember(true)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12px] whitespace-nowrap text-muted [font-family:inherit] hover:text-text"
            >
              Hide questions
            </button>
          </>
        )}
      </div>
      {errorMessage && (
        <p className="tag-error" role="alert">
          {errorMessage}
        </p>
      )}
      {!isHidden && (
        <>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {questions?.map((question) => (
              <li key={question.id}>
                {cardBeingEdited?.questionId === question.id ? renderEditor(cardBeingEdited) : (
                  <QuestionCard
                    question={question}
                    isAnswerShowing={questionIdsShowingAnswer.has(question.id)}
                    onToggleAnswer={() => toggleAnswer(question.id)}
                    onEdit={() => openSavedCard(question)}
                    onDelete={() => deleteAfterConfirm(question)}
                  />
                )}
              </li>
            ))}
            {cardBeingEdited?.questionId === null && <li>{renderEditor(cardBeingEdited)}</li>}
          </ol>
          {questions?.length === 0 && cardBeingEdited === null && (
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              No questions yet. Write cues for your notes here, then test yourself on them.
            </p>
          )}
          <p className="mt-6 mb-0 text-[12px] text-muted">
            Press <kbd className="crumbs-key-hint">?</kbd> for keyboard shortcuts
          </p>
        </>
      )}
    </aside>
  )
}

export default QuestionColumn
