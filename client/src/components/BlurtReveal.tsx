import { useEffect } from 'react'
import type { JSONContent } from '@tiptap/react'
import { Link } from 'react-router'
import { blocksToEditorDoc } from '../blockTreeConversion.ts'
import type { NoteBlock } from '../notes.ts'
import IconPillButton from './IconPillButton.tsx'
import NoteBodyViewer from './NoteBodyViewer.tsx'

// The note's body, fetched only at Done, so it can still be on its way or have failed.
export type RevealedNote = { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; blocks: NoteBlock[] }

// Each half fades and rises in; reduced motion keeps only the fade.
const halfEnter =
  'overflow-y-auto px-10 py-8 transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:translate-y-2 motion-reduce:starting:translate-y-0'
const halfLabel = 'm-0 mb-6 text-[12px] tracking-[0.08em] text-muted uppercase'

type BlurtRevealProps = {
  noteId: string
  title: string
  blurtDoc: JSONContent
  revealedNote: RevealedNote
  onRetry: () => void
  onBlurtAgain: () => void
}

// Your blurt (read-only, with its formatting) and the note side by side, each half scrolling on its own.
function BlurtReveal({ noteId, title, blurtDoc, revealedNote, onRetry, onBlurtAgain }: BlurtRevealProps) {
  // Disabled while loading, so a late reply can't reveal the note over a new attempt.
  const canBlurtAgain = revealedNote.status !== 'loading'

  // Plain R = "Blurt again". With Ctrl/⌘/Alt it's left alone, so Ctrl+R still reloads.
  useEffect(() => {
    const blurtAgainOnR = (event: KeyboardEvent) => {
      const typingInField = event.target instanceof HTMLElement && event.target.matches('input, textarea, [contenteditable="true"]')
      if (event.key.toLowerCase() !== 'r' || event.ctrlKey || event.metaKey || event.altKey || typingInField || !canBlurtAgain) return
      // Otherwise the "r" lands in the new attempt's editor, which is focused straight away.
      event.preventDefault()
      onBlurtAgain()
    }
    window.addEventListener('keydown', blurtAgainOnR)
    return () => window.removeEventListener('keydown', blurtAgainOnR)
  }, [canBlurtAgain, onBlurtAgain])

  return (
    <>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <section className={`bg-[color-mix(in_srgb,var(--brand)_7%,var(--bg))] ${halfEnter}`}>
          <p className={halfLabel}>From memory</p>
          <h1 className="note-title">{title}</h1>
          <NoteBodyViewer bodyDoc={blurtDoc} />
        </section>
        <section className={`delay-[60ms] ${halfEnter}`}>
          <p className={halfLabel}>The note</p>
          <h1 className="note-title">{title}</h1>
          {revealedNote.status === 'loading' &&
            [0, 1, 2].map((i) => <span key={i} className="skeleton note-line-skeleton" aria-hidden="true" />)}
          {revealedNote.status === 'failed' && (
            <p className="text-danger">
              Couldn't load the note.{' '}
              <button
                type="button"
                onClick={onRetry}
                className="cursor-pointer border-0 bg-transparent p-0 text-text underline [font:inherit]"
              >
                Retry
              </button>
            </p>
          )}
          {revealedNote.status === 'loaded' && <NoteBodyViewer bodyDoc={blocksToEditorDoc(revealedNote.blocks)} />}
        </section>
      </div>
      <footer className="flex items-center justify-center gap-6 border-t border-[var(--line)] py-4">
        <span className="flex items-center gap-3">
          <IconPillButton onClick={onBlurtAgain} disabled={!canBlurtAgain} icon="↺">
            Blurt again
          </IconPillButton>
          <kbd className="keyboard-only rounded border border-[var(--line)] px-1.5 py-0.5 text-[12px] text-muted [font-family:inherit]">R</kbd>
        </span>
        <Link to={`/notes/${noteId}`} className="text-[15px] text-muted no-underline transition-colors duration-150 hover:text-text">
          Back to note
        </Link>
      </footer>
    </>
  )
}

export default BlurtReveal
