import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { createQuestionOnServer, deleteQuestionOnServer, listQuestionsFromServer, updateQuestionOnServer } from '../api.ts'
import { addQuestionKeys } from '../keyboardLabels.ts'
import { useNotes } from '../notes.ts'
import { aboutText, isAboutDeletedBlock, questionCountText, type NoteBodyForQuestions, type Question, type QuestionFields } from '../questions.ts'
import { RETRY_MS, wait } from '../retry.ts'
import type { Tag } from '../tags.ts'
import { useAskBeforeLeaving } from '../useAskBeforeLeaving.ts'
import QuestionCard from './QuestionCard.tsx'
import QuestionCardEditor from './QuestionCardEditor.tsx'
import QuestionTestCard from './QuestionTestCard.tsx'

const UNSAVED_QUESTION_WARNING = 'You have an unsaved question. Leave anyway?'
const HIDDEN_STORAGE_KEY = 'campi.questionsHidden'
// The space between two cues when the lower one isn't pushed down to its block.
const CUE_GAP_PX = 12

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
    && first.blockId === second.blockId
}

// General questions (and ones whose block is gone) first, then each block's in reading order;
// oldest first within each. Sorting is stable, and questions arrive oldest first.
function inCueOrder(questions: Question[], blockTexts: Map<string, string>): Question[] {
  const readingIndexByBlockId = new Map([...blockTexts.keys()].map((blockId, index) => [blockId, index]))
  const cueRank = (question: Question) => readingIndexByBlockId.get(question.blockId ?? '') ?? -1
  return [...questions].sort((first, second) => cueRank(first) - cueRank(second))
}

// The Cornell cue column left of a note's body. Each question sits level with the block it's
// about (pushed down if the cue above reaches past it); General ones sit at the top. Answers stay
// hidden until clicked. "+ Question" or Ctrl + Alt + M (Control + Option + M on a Mac) adds one about the block the
// cursor was last in, pre-filled with the note's tags.
// "Test yourself" swaps the list for one card at a time; NoteEditor covers the body meanwhile,
// which is why it owns isTesting.
function QuestionColumn({ noteId, noteTags, noteBody, isTesting, onTestingChange }: {
  noteId: string
  noteTags: Tag[]
  noteBody: NoteBodyForQuestions
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
  const cueListRef = useRef<HTMLOListElement>(null)
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

  // Sets each cue's top margin so it starts level with its block, or CUE_GAP_PX below the cue
  // above when that one already reaches past it. Straight on the DOM: it's layout, not state.
  // Off when the column sits below the body (narrow screens).
  const alignCuesWithBlocks = useEffectEvent(() => {
    const cueList = cueListRef.current
    const bodyElement = noteBody.bodyElementRef.current
    if (!cueList || !bodyElement) return
    const isBesideBody = bodyElement.getBoundingClientRect().left >= cueList.getBoundingClientRect().right
    let cuesBottom = 0 // from the list's top
    for (const cueItem of cueList.children as HTMLCollectionOf<HTMLElement>) {
      const { blockId } = cueItem.dataset
      const blockElement = isBesideBody && blockId ? bodyElement.querySelector(`[data-id="${blockId}"]`) : null
      // Both read together: each margin set can change the page height and so its scroll position.
      const blockTop = blockElement ? blockElement.getBoundingClientRect().top - cueList.getBoundingClientRect().top : 0
      const gapAbove = cueItem === cueList.firstElementChild ? 0 : CUE_GAP_PX
      const marginTop = Math.max(gapAbove, blockTop - cuesBottom)
      cueItem.style.marginTop = `${marginTop}px`
      cuesBottom += marginTop + cueItem.offsetHeight
    }
  })
  // Every render: a body edit, an opened card or a shown answer can all move things.
  useLayoutEffect(() => alignCuesWithBlocks())
  // Changes without a render: the body resizing (window width), and a font arriving, which
  // changes text heights on both sides (the cue font only loads once a cue uses it).
  useEffect(() => {
    const bodyElement = noteBody.bodyElementRef.current
    if (!bodyElement) return
    const resizeObserver = new ResizeObserver(() => alignCuesWithBlocks())
    resizeObserver.observe(bodyElement)
    const realignOnFontLoad = () => alignCuesWithBlocks()
    document.fonts.addEventListener('loadingdone', realignOnFontLoad)
    return () => {
      resizeObserver.disconnect()
      document.fonts.removeEventListener('loadingdone', realignOnFontLoad)
    }
  }, [noteBody.bodyElementRef])

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
    openCard(null, { question: '', answer: '', tags: noteTags.map((tag) => tag.name), blockId: noteBody.readCursorBlockId() })
  }

  function openSavedCard(question: Question) {
    openCard(question.id, {
      question: question.question,
      answer: question.answer,
      tags: question.tags.map((tag) => tag.name),
      blockId: question.blockId,
    })
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
      // A block typed moments ago may not have autosaved yet; the server refuses a block it lacks.
      if (fieldsToSave.blockId !== null) await noteBody.saveNow()
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

  function renderEditor(editedCard: CardBeingEdited, blockWasDeleted: boolean) {
    return (
      <QuestionCardEditor
        fields={editedCard.fields}
        aboutText={aboutText(editedCard.fields.blockId, blockWasDeleted, blockTexts)}
        onAttachToCursorBlock={() =>
          setCardBeingEdited({ ...editedCard, fields: { ...editedCard.fields, blockId: noteBody.readCursorBlockId() } })}
        onFieldsChange={(changedFields) => setCardBeingEdited({ ...editedCard, fields: changedFields })}
        onSave={(fieldsToSave) => saveCard(editedCard.questionId, fieldsToSave)}
        onCancel={() => setCardBeingEdited(null)}
        isSaving={isSaving}
      />
    )
  }

  const blockTexts = noteBody.readBlockTexts()
  // "0 questions" reads like a counter waiting for something, so an empty column just says Questions.
  const questionCountLabel = questions === null || questions.length === 0 ? 'Questions' : questionCountText(questions.length)
  // Not while a card is open, so starting a test can't drop an unsaved edit.
  const canStartTest = questions !== null && questions.length > 0 && cardBeingEdited === null

  if (isTesting && questions !== null) {
    return (
      <aside className="question-column" aria-label="Questions">
        <QuestionTestCard noteId={noteId} questions={questions} onStop={stopTest} />
      </aside>
    )
  }

  return (
    <aside className="question-column" aria-label="Questions" data-hidden={isHidden || undefined}>
      {/* One quiet row: the count (click to hide or show the cues), then Test and +. Shortcuts
          live in the "?" panel and the tooltips, not on the page. */}
      <div className="cue-header">
        <button
          type="button"
          className="cue-header-label"
          aria-expanded={!isHidden}
          title={isHidden ? 'Show questions' : 'Hide questions'}
          onClick={() => setHiddenAndRemember(!isHidden)}
        >
          {questionCountLabel}
        </button>
        {!isHidden && (
          <>
            {canStartTest && (
              <button ref={testButtonRef} type="button" className="cue-header-action" onClick={() => onTestingChange(true)}>
                Test
              </button>
            )}
            <button
              type="button"
              className="cue-header-action cue-header-add"
              onClick={openNewCard}
              aria-label="Add question"
              aria-keyshortcuts="Control+Alt+M"
              title={`Add question (${addQuestionKeys})`}
            >
              +
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
          {/* Flex, so a cue's top margin can't collapse through the list and move the list instead. */}
          <ol ref={cueListRef} className="m-0 flex list-none flex-col p-0">
            {inCueOrder(questions ?? [], blockTexts).map((question) => {
              const editedCard = cardBeingEdited?.questionId === question.id ? cardBeingEdited : null
              // While open, the card sits by the block it's being moved to.
              const cueBlockId = editedCard ? editedCard.fields.blockId : question.blockId
              return (
                <li key={question.id} data-block-id={cueBlockId ?? undefined}>
                  {editedCard ? renderEditor(editedCard, question.blockWasDeleted) : (
                    <QuestionCard
                      question={question}
                      noteTags={noteTags}
                      isAboutDeletedBlock={isAboutDeletedBlock(question.blockId, question.blockWasDeleted, blockTexts)}
                      isAnswerShowing={questionIdsShowingAnswer.has(question.id)}
                      onToggleAnswer={() => toggleAnswer(question.id)}
                      onEdit={() => openSavedCard(question)}
                      onDelete={() => deleteAfterConfirm(question)}
                    />
                  )}
                </li>
              )
            })}
            {cardBeingEdited?.questionId === null && (
              <li data-block-id={cardBeingEdited.fields.blockId ?? undefined}>{renderEditor(cardBeingEdited, false)}</li>
            )}
          </ol>
          {questions?.length === 0 && cardBeingEdited === null && (
            <p className="m-0 text-[13px] leading-[1.5] text-muted">
              No questions yet. Press + to write a cue about a paragraph, then test yourself.
              <span className="keyboard-only">
                {' '}Press <kbd className="crumbs-key-hint !ml-0">?</kbd> for shortcuts.
              </span>
            </p>
          )}
        </>
      )}
    </aside>
  )
}

export default QuestionColumn
