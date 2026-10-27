import type { Question } from '../questions.ts'
import type { Tag } from '../tags.ts'

// A saved question (a "cue") in the cue column. The answer stays hidden until you click the
// question, so you can test yourself first. Edit and × fade in on hover (always shown on touch
// screens), and only tags the note itself doesn't have are shown, so most cues are just the question.
function QuestionCard({ question, noteTags, isAboutDeletedBlock, isAnswerShowing, onToggleAnswer, onEdit, onDelete }: {
  question: Question
  noteTags: Tag[]
  // Its block is gone, so it no longer sits beside anything: say so, and Edit can re-attach it.
  isAboutDeletedBlock: boolean
  isAnswerShowing: boolean
  onToggleAnswer: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const tagsNotOnNote = question.tags.filter((tag) => !noteTags.some((noteTag) => noteTag.id === tag.id))
  return (
    <article className="cue-card border-b border-[var(--line)] pb-3">
      {isAboutDeletedBlock && <p className="mt-0 mb-1 text-[12px] text-muted">About: (deleted paragraph)</p>}
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onToggleAnswer}
          aria-expanded={isAnswerShowing}
          className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[17px] leading-[1.4] whitespace-pre-wrap text-text italic [font-family:var(--serif)]"
        >
          {question.question}
        </button>
        <div className="cue-card-actions flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-none text-muted transition-colors duration-150 hover:text-text"
          >
            Edit
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
      </div>
      {isAnswerShowing && (
        <p className="cue-answer mt-2 mb-0 rounded bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-2.5 py-2 text-[13px] leading-[1.5] whitespace-pre-wrap text-text">
          {question.answer}
        </p>
      )}
      {tagsNotOnNote.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tagsNotOnNote.map((tag) => (
            <span key={tag.id} className="tag-stamp">
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

export default QuestionCard
