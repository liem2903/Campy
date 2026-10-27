import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Question } from '../questions.ts'

// Test mode: the note's questions one at a time, each answer hidden until "Show answer" (focused,
// so Space shows it). Each answer is then marked Wrong (1) or Right (2); after the last one, a score
// with Blurt or Review notes. Esc anywhere on the page stops. Nothing is saved.
type QuestionMark = 'wrong' | 'right'

function QuestionTestCard({ noteId, questions, onStop }: { noteId: string; questions: Question[]; onStop: () => void }) {
  const [shownQuestionIndex, setShownQuestionIndex] = useState(0)
  const [isAnswerShowing, setIsAnswerShowing] = useState(false)
  // Keyed by id, so marking again after "Previous" replaces the old mark instead of counting twice.
  const [markByQuestionId, setMarkByQuestionId] = useState<Record<string, QuestionMark>>({})
  const shownQuestion = questions[shownQuestionIndex]
  // Marking the last question moves one past the end: that index is the score screen.
  const isShowingScore = shownQuestionIndex === questions.length
  const blurtLinkRef = useRef<HTMLAnchorElement>(null)

  function showQuestionAt(questionIndex: number) {
    setShownQuestionIndex(questionIndex)
    setIsAnswerShowing(false)
  }

  function markShownQuestion(mark: QuestionMark) {
    setMarkByQuestionId((previousMarks) => ({ ...previousMarks, [shownQuestion.id]: mark }))
    showQuestionAt(shownQuestionIndex + 1)
  }

  // Not when Esc is closing a dialog (the shortcuts panel) instead.
  const stopOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || (event.target instanceof Element && event.target.closest('dialog'))) return
    onStop()
  })
  // 1 = Wrong, 2 = Right, once the answer shows (same keys as the flashcard grades in T4). Not with
  // a modifier (Ctrl + 1 switches browser tabs), nor while the shortcuts panel is open.
  const markOnNumberKey = useEffectEvent((event: KeyboardEvent) => {
    if (!isAnswerShowing || isShowingScore || event.repeat) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.target instanceof Element && event.target.closest('dialog')) return
    if (event.key === '1') markShownQuestion('wrong')
    if (event.key === '2') markShownQuestion('right')
  })
  useEffect(() => {
    window.addEventListener('keydown', stopOnEscape)
    window.addEventListener('keydown', markOnNumberKey)
    return () => {
      window.removeEventListener('keydown', stopOnEscape)
      window.removeEventListener('keydown', markOnNumberKey)
    }
  }, [])

  // React's autoFocus only works on form controls, not links, so focus Blurt by hand.
  useEffect(() => {
    if (isShowingScore) blurtLinkRef.current?.focus()
  }, [isShowingScore])

  if (isShowingScore) {
    const rightCount = Object.values(markByQuestionId).filter((mark) => mark === 'right').length
    return (
      <section aria-label="Test yourself" className="test-score flex flex-col gap-4">
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span className="text-[11px] tracking-[0.08em] text-[var(--brand)] uppercase">Test yourself</span>
          <span>Done</span>
        </div>
        {/* The progress bar again, now one segment per mark, so you can see which ones you missed. */}
        <div className="flex gap-1" aria-hidden="true">
          {questions.map((question) => (
            <span key={question.id} className="test-score-segment h-[3px] flex-1 rounded-full" data-mark={markByQuestionId[question.id]} />
          ))}
        </div>
        <p className="m-0 flex items-baseline gap-2 [font-family:var(--serif)]">
          <span className="text-[40px] leading-none tabular-nums">{rightCount} / {questions.length}</span>
          <span className="text-[16px] text-muted">right</span>
        </p>
        <div className="flex flex-col gap-2">
          <Link ref={blurtLinkRef} to={`/notes/${noteId}/blurt`} className="test-primary-button">Blurt</Link>
          <button type="button" onClick={onStop} className="test-quiet-button">Review notes</button>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Test yourself" className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="text-[11px] tracking-[0.08em] text-[var(--brand)] uppercase">Test yourself</span>
        <span>{shownQuestionIndex + 1} of {questions.length}</span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {questions.map((question, questionIndex) => (
          <span
            key={question.id}
            className={`h-[3px] flex-1 rounded-full ${questionIndex <= shownQuestionIndex ? 'bg-[var(--brand)]' : 'bg-[var(--line)]'}`}
          />
        ))}
      </div>
      <div className="flex min-h-[220px] flex-col gap-4 rounded-xl border border-[var(--line)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        <p className="m-0 text-[20px] leading-[1.3] whitespace-pre-wrap [font-family:var(--serif)]">{shownQuestion.question}</p>
        {isAnswerShowing && (
          <p className="m-0 border-t border-[var(--line)] pt-3 text-[14px] leading-[1.5] whitespace-pre-wrap">{shownQuestion.answer}</p>
        )}
        <div className="flex-1" />
        {/* A new key on every question mounts "Show answer" fresh, so autoFocus moves focus to it,
            even after "Previous". The mark buttons get no focus, so Space can't mark by accident. */}
        {isAnswerShowing ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => markShownQuestion('wrong')} className="test-mark-button" data-mark="wrong" aria-keyshortcuts="1">
                <span className="test-mark-icon" aria-hidden="true">✕</span> Wrong
              </button>
              <button type="button" onClick={() => markShownQuestion('right')} className="test-mark-button" data-mark="right" aria-keyshortcuts="2">
                <span className="test-mark-icon" aria-hidden="true">✓</span> Right
              </button>
            </div>
            <p className="keyboard-only m-0 text-center text-[11px] text-muted">Press 1 for Wrong, 2 for Right</p>
          </div>
        ) : (
          <button key={`show-${shownQuestionIndex}`} type="button" autoFocus onClick={() => setIsAnswerShowing(true)} className="test-card-button">
            Show answer <kbd className="crumbs-key-hint">Space</kbd>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={() => showQuestionAt(shownQuestionIndex - 1)}
          disabled={shownQuestionIndex === 0}
          className="cursor-pointer border-0 bg-transparent p-0 text-muted [font-family:inherit] hover:text-text disabled:cursor-default disabled:opacity-35"
        >
          ← Previous
        </button>
        <button type="button" onClick={onStop} className="cursor-pointer border-0 bg-transparent p-0 text-muted [font-family:inherit] hover:text-text">
          Stop <kbd className="crumbs-key-hint">Esc</kbd>
        </button>
      </div>
    </section>
  )
}

export default QuestionTestCard
