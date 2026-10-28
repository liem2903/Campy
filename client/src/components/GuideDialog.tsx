import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { addQuestionKeys } from '../keyboardLabels.ts'

type GuideSlide = { title: string; body: ReactNode }

const Key = ({ children }: { children: ReactNode }) => <kbd className="crumbs-key-hint !ml-0">{children}</kbd>

const guideSlides: GuideSlide[] = [
  {
    title: 'Welcome to Campi',
    body: <>Write notes, then test yourself on them. This guide takes a minute; reopen it any time from <b>Guide</b> in the sidebar.</>,
  },
  {
    title: 'Write notes',
    body: <><b>New page</b> in the sidebar starts a note. It saves as you type. Start a line with <Key>-</Key> or <Key>1.</Key> for a list.</>,
  },
  {
    title: 'Tag them',
    body: <><b>+ Tag</b> under a note's title groups notes by subject. Filter by tag on <b>All notes</b> and <b>Flashcards</b>, and rename or delete tags on <b>Tags</b>.</>,
  },
  {
    title: 'Ask yourself questions',
    body: <>The column beside a note holds its questions. Press <b>+</b> (or <Key>{addQuestionKeys}</Key>) and write a question and its answer, linked to the paragraph you're on.</>,
  },
  {
    title: 'Test and blurt',
    body: <><b>Test</b> hides the answers so you can check yourself on that note. <b>Blurt</b> hides the whole note: write everything you remember, then compare.</>,
  },
  {
    title: 'Flashcards',
    body: <>Every question becomes a flashcard. <b>Flashcards</b> shows the ones due today. Grade each one Again, Hard, Good or Easy, and Campi schedules the next review.</>,
  },
  {
    title: 'Getting around',
    body: <>The sidebar has Home, Flashcards, All notes, Tags and your notes. Press <Key>?</Key> on a note for keyboard shortcuts. Not sure what to do? Open <b>Guide</b>.</>,
  },
]

const navButtonClass =
  'cursor-pointer rounded-md border border-[var(--line)] bg-transparent px-3 py-1 text-[13px] text-muted [font-family:inherit] hover:border-muted hover:text-text disabled:invisible'

// The "How Campi works" slideshow. Opens as a modal when mounted; Back/Next or ← / → move between
// slides, and Esc, a click outside or the last slide's button closes it (onClose).
function GuideDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const [shownSlideIndex, setShownSlideIndex] = useState(0)
  const shownSlide = guideSlides[shownSlideIndex]
  const isLastSlide = shownSlideIndex === guideSlides.length - 1

  // showModal focuses the first button it finds (a slide dot), so Next is focused after it: Enter
  // then steps through the guide.
  useEffect(() => {
    dialogRef.current?.showModal()
    nextButtonRef.current?.focus()
  }, [])

  function showSlide(slideIndex: number) {
    setShownSlideIndex(Math.min(Math.max(slideIndex, 0), guideSlides.length - 1))
  }

  function moveOnArrowKey(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') showSlide(shownSlideIndex + 1)
    if (event.key === 'ArrowLeft') showSlide(shownSlideIndex - 1)
  }

  return (
    // The native close event covers Esc as well as dialog.close().
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialogRef.current?.close()}
      onKeyDown={moveOnArrowKey}
      aria-labelledby="guide-title"
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-xl border border-[var(--line)] bg-bg p-0 text-text shadow-[0_16px_48px_rgba(0,0,0,0.18)] outline-none backdrop:bg-black/30"
    >
      <div className="flex min-h-[260px] flex-col gap-4 p-7">
        <p className="m-0 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
          How Campi works · {shownSlideIndex + 1} of {guideSlides.length}
        </p>
        <h2 id="guide-title" className="m-0 text-[28px] leading-tight font-normal [font-family:var(--serif)]">
          {shownSlide.title}
        </h2>
        <p className="m-0 flex-1 text-[15px] leading-[1.6]">{shownSlide.body}</p>
        <div className="flex items-center justify-between gap-3">
          <button type="button" className={navButtonClass} onClick={() => showSlide(shownSlideIndex - 1)} disabled={shownSlideIndex === 0}>
            Back
          </button>
          <div className="flex gap-1.5">
            {guideSlides.map((slide, slideIndex) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`Go to slide ${slideIndex + 1}: ${slide.title}`}
                aria-current={slideIndex === shownSlideIndex ? 'step' : undefined}
                onClick={() => showSlide(slideIndex)}
                className={`h-2 w-2 cursor-pointer rounded-full border-0 p-0 ${slideIndex === shownSlideIndex ? 'bg-brand' : 'bg-[var(--line)] hover:bg-muted'}`}
              />
            ))}
          </div>
          <button
            ref={nextButtonRef}
            type="button"
            onClick={() => (isLastSlide ? dialogRef.current?.close() : showSlide(shownSlideIndex + 1))}
            className="cursor-pointer rounded-md border-0 bg-text px-3 py-1 text-[13px] font-medium text-bg [font-family:inherit]"
          >
            {isLastSlide ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export default GuideDialog
