import { useEffect, useEffectEvent, useState } from 'react'
import { gradeFlashcardOnServer } from '../api.ts'
import { browserTimeZone, type Flashcard, type FlashcardGrade } from '../flashcards.ts'

// Keys 1–4, in button order.
const gradesInKeyOrder: FlashcardGrade[] = ['again', 'hard', 'good', 'easy']
const gradeLabels: Record<FlashcardGrade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

// One study session: the first card in the queue, Show answer (Space), then a grade (1–4). Again
// sends the card to the back until it's passed. Every grade saves at once (T4.3), so leaving
// mid-session loses nothing. Ends with a count per grade and Back.
function FlashcardStudySession({ cards, onBack }: { cards: Flashcard[]; onBack: () => void }) {
  // Cards still to pass today; the first one is shown.
  const [cardsLeftInQueue, setCardsLeftInQueue] = useState(cards)
  const [isAnswerShowing, setIsAnswerShowing] = useState(false)
  // How many times each button was pressed this session, repeats included.
  const [pressCountByGrade, setPressCountByGrade] = useState<Record<FlashcardGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 })
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const shownCard = cardsLeftInQueue[0]
  // On the summary too, or a failed last grade would go unseen.
  const saveErrorAlert = saveErrorMessage && <p role="alert" className="m-0 text-[13px] text-muted">{saveErrorMessage}</p>

  function gradeShownCard(grade: FlashcardGrade) {
    const gradedCard = cardsLeftInQueue[0]
    setPressCountByGrade((previousCounts) => ({ ...previousCounts, [grade]: previousCounts[grade] + 1 }))
    gradeFlashcardOnServer(gradedCard.questionId, grade, browserTimeZone()).then(
      // Swaps in the new intervals if the card is still queued (it is after Again); otherwise does nothing.
      (updatedCard) =>
        setCardsLeftInQueue((previousQueue) =>
          previousQueue.map((queuedCard) => (queuedCard.questionId === updatedCard.questionId ? updatedCard : queuedCard)),
        ),
      () => setSaveErrorMessage("Couldn't save a grade, so that card keeps its old schedule."),
    )
    setCardsLeftInQueue((previousQueue) =>
      grade === 'again' ? [...previousQueue.slice(1), previousQueue[0]] : previousQueue.slice(1),
    )
    setIsAnswerShowing(false)
  }

  // 1–4 once the answer shows. Not with a modifier (Ctrl + 1 switches browser tabs).
  const gradeOnNumberKey = useEffectEvent((event: KeyboardEvent) => {
    if (!isAnswerShowing || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
    const grade = gradesInKeyOrder[['1', '2', '3', '4'].indexOf(event.key)]
    if (grade) gradeShownCard(grade)
  })
  useEffect(() => {
    window.addEventListener('keydown', gradeOnNumberKey)
    return () => window.removeEventListener('keydown', gradeOnNumberKey)
  }, [])

  if (cardsLeftInQueue.length === 0) {
    return (
      <section aria-label="Flashcards" className="flex flex-col gap-4">
        <p className="m-0 text-[28px] [font-family:var(--serif)]">
          Done: {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </p>
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 text-center text-[13px]">
          {gradesInKeyOrder.map((grade) => (
            <li key={grade}>
              <span className="block text-[20px] tabular-nums">{pressCountByGrade[grade]}</span>
              <span className="text-muted">{gradeLabels[grade]}</span>
            </li>
          ))}
        </ul>
        <button type="button" autoFocus onClick={onBack} className="test-primary-button cursor-pointer border-0 [font-family:inherit]">
          Back
        </button>
        {saveErrorAlert}
      </section>
    )
  }

  return (
    <section aria-label="Flashcards" className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="text-[11px] tracking-[0.08em] text-[var(--brand)] uppercase">{shownCard.isNew ? 'New' : 'Review'}</span>
        <span>{cardsLeftInQueue.length} left</span>
      </div>
      <div className="flex min-h-[260px] flex-col gap-4 rounded-xl border border-[var(--line)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        <p className="m-0 text-[20px] leading-[1.3] break-words whitespace-pre-wrap [font-family:var(--serif)]">{shownCard.question}</p>
        {isAnswerShowing && (
          <p className="m-0 border-t border-[var(--line)] pt-3 text-[14px] leading-[1.5] break-words whitespace-pre-wrap">{shownCard.answer}</p>
        )}
        <div className="flex-1" />
        {/* Show answer unmounts while the answer shows, so after each grade it mounts again and
            autoFocus puts Space back on it. */}
        {isAnswerShowing ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-2">
              {gradesInKeyOrder.map((grade, gradeIndex) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => gradeShownCard(grade)}
                  className="test-mark-button flex-col gap-0"
                  aria-keyshortcuts={String(gradeIndex + 1)}
                >
                  {gradeLabels[grade]}
                  <span className="text-[11px] text-muted">{shownCard.nextIntervalDays[grade]}d</span>
                </button>
              ))}
            </div>
            <p className="keyboard-only m-0 text-center text-[11px] text-muted">Press 1–4</p>
          </div>
        ) : (
          <button type="button" autoFocus onClick={() => setIsAnswerShowing(true)} className="test-card-button">
            Show answer <kbd className="crumbs-key-hint">Space</kbd>
          </button>
        )}
      </div>
      {saveErrorAlert}
    </section>
  )
}

export default FlashcardStudySession
