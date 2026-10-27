import type { Question } from '../questions.ts'

// A saved question (a "cue") in the cue column. The answer stays hidden until you click the
// question, so you can test yourself first.
function QuestionCard({ question, isAboutDeletedBlock, isAnswerShowing, onToggleAnswer, onEdit, onDelete }: {
  question: Question
  // Its block is gone, so it no longer sits beside anything: say so, and Edit can re-attach it.
  isAboutDeletedBlock: boolean
  isAnswerShowing: boolean
  onToggleAnswer: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <article className="border-b border-[var(--line)] pb-3">
      {isAboutDeletedBlock && <p className="mt-0 mb-1 text-[12px] text-muted">About: (deleted paragraph)</p>}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggleAnswer}
          aria-expanded={isAnswerShowing}
          className="flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[17px] leading-[1.4] whitespace-pre-wrap text-text italic [font-family:var(--serif)]"
        >
          {question.question}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete question"
          className="cursor-pointer border-0 bg-transparent p-0 text-[15px] leading-none text-muted transition-colors duration-150 hover:text-danger"
        >
          ×
        </button>
      </div>
      {isAnswerShowing && (
        <p className="mt-2 mb-0 rounded bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-2.5 py-2 text-[13px] leading-[1.5] whitespace-pre-wrap text-text">
          {question.answer}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {question.tags.map((tag) => (
          <span key={tag.id} className="tag-stamp">
            {tag.name}
          </span>
        ))}
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[12px] text-muted transition-colors duration-150 hover:text-text"
        >
          Edit
        </button>
      </div>
    </article>
  )
}

export default QuestionCard
