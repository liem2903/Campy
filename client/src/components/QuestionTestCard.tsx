import { useEffect, useEffectEvent, useState } from 'react'
import type { Question } from '../questions.ts'

// Test mode: the note's questions one at a time, each answer hidden until "Show answer". Focus
// always sits on the next button to press, so Space or Enter steps through; Esc anywhere on the
// page stops. Nothing is saved.
function QuestionTestCard({ questions, onStop }: { questions: Question[]; onStop: () => void }) {
  const [shownQuestionIndex, setShownQuestionIndex] = useState(0)
  const [isAnswerShowing, setIsAnswerShowing] = useState(false)
  const shownQuestion = questions[shownQuestionIndex]
  const isLastQuestion = shownQuestionIndex === questions.length - 1

  function showQuestionAt(questionIndex: number) {
    setShownQuestionIndex(questionIndex)
    setIsAnswerShowing(false)
  }

  // Not when Esc is closing a dialog (the shortcuts panel) instead.
  const stopOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape' || (event.target instanceof Element && event.target.closest('dialog'))) return
    onStop()
  })
  useEffect(() => {
    window.addEventListener('keydown', stopOnEscape)
    return () => window.removeEventListener('keydown', stopOnEscape)
  }, [])

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
        {/* A new key on every step (answer shown, or another question) mounts the button fresh, so
            autoFocus moves focus to it, even after "Previous". */}
        {isAnswerShowing ? (
          <button key={`next-${shownQuestionIndex}`} type="button" autoFocus onClick={isLastQuestion ? onStop : () => showQuestionAt(shownQuestionIndex + 1)} className="test-card-button">
            {isLastQuestion ? 'Finish' : 'Next'} <kbd className="crumbs-key-hint">Space</kbd>
          </button>
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
