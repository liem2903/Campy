import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { getNoteFromServer } from '../api.ts'
import BlurtReveal, { type RevealedNote } from '../components/BlurtReveal.tsx'
import IconPillButton from '../components/IconPillButton.tsx'
import NoteNotFound from '../components/NoteNotFound.tsx'
import { useNotes } from '../notes.ts'
import { useAskBeforeClosingTab } from '../useAskBeforeClosingTab.ts'
import { useElapsedSeconds } from '../useElapsedSeconds.ts'

// Strong ease-out, so the sheet answers the click straight away. Entry via @starting-style
// (Tailwind's starting: variant); reduced motion keeps only the fade.
const sheetEnter =
  'transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:scale-[0.985] motion-reduce:starting:scale-100'
const keyHint = 'rounded border border-[var(--line)] px-1.5 py-0.5 [font-family:inherit]'

const countWords = (text: string) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length)

function formatMinutesSeconds(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

// A full-screen sheet over the whole app, so nothing else can cue you. Only the title shows:
// the body isn't fetched until Done. The blurt is never stored, so leaving asks first.
function BlurtPage() {
  const { noteId: noteIdFromUrl } = useParams()
  const { notes: noteList, loading } = useNotes()
  const listEntry = noteList.find((n) => n.id === noteIdFromUrl)
  const [blurtText, setBlurtText] = useState('')
  const blurtIsEmpty = blurtText.trim() === ''
  // null while writing. Once revealed, nothing is lost by leaving, so there's no warning.
  const [revealedNote, setRevealedNote] = useState<RevealedNote | null>(null)
  const isWriting = revealedNote === null
  const [attemptStartedAt, setAttemptStartedAt] = useState(() => Date.now())
  const elapsedSeconds = useElapsedSeconds(attemptStartedAt, isWriting)
  useAskBeforeClosingTab(isWriting && !blurtIsEmpty)

  if (loading) return null
  if (!listEntry) return <NoteNotFound />
  const title = listEntry.title || 'Untitled'

  // Fetched only now, so the body never reaches the browser while you blurt.
  const revealNote = async () => {
    setRevealedNote({ status: 'loading' })
    try {
      // null = 404 Not Found: deleted while you blurted, so it shows as an empty note.
      const noteDetailOrNull = await getNoteFromServer(listEntry.id)
      setRevealedNote({ status: 'loaded', blocks: noteDetailOrNull?.blocks ?? [] })
    } catch {
      setRevealedNote({ status: 'failed' })
    }
  }

  const startNewAttempt = () => {
    setBlurtText('')
    setRevealedNote(null)
    setAttemptStartedAt(Date.now())
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-bg ${sheetEnter}`}>
      <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-3 text-[13px] text-muted">
        <span className="truncate">
          Blurting · <span className="text-text">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-4 tabular-nums">
          <span>{formatMinutesSeconds(elapsedSeconds)}</span>
          <span>{countWords(blurtText)} words</span>
          <Link
            to={`/notes/${listEntry.id}`}
            onClick={(event) => {
              if (isWriting && !blurtIsEmpty && !window.confirm("Leave? Your blurt won't be kept.")) event.preventDefault()
            }}
            className="text-muted no-underline transition-colors duration-150 hover:text-text"
          >
            Close ✕
          </Link>
        </span>
      </header>
      {revealedNote ? (
        <BlurtReveal
          noteId={listEntry.id}
          title={title}
          blurtText={blurtText}
          revealedNote={revealedNote}
          onRetry={revealNote}
          onBlurtAgain={startNewAttempt}
        />
      ) : (
        <div className="mx-auto box-border flex w-full max-w-[680px] flex-1 flex-col px-6 pt-[10vh]">
          <h1 className="note-title !m-0 !mb-10 text-center !text-[52px]">{title}</h1>
          <textarea
            autoFocus
            className="block w-full flex-1 resize-none border-0 bg-transparent p-0 text-[19px] leading-[1.7] text-text caret-brand outline-none placeholder:text-muted placeholder:opacity-60 [font-family:inherit]"
            value={blurtText}
            onChange={(event) => setBlurtText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !blurtIsEmpty) void revealNote()
            }}
            placeholder="Go. Don't stop to check."
          />
          <div className="flex flex-col items-center gap-3 py-8">
            <IconPillButton onClick={revealNote} disabled={blurtIsEmpty} icon="→">
              I'm done
            </IconPillButton>
            <span className="text-[12px] text-muted">
              <span className="keyboard-only">
                or <kbd className={keyHint}>Ctrl</kbd> + <kbd className={keyHint}>Enter</kbd> ·{' '}
              </span>
              not saved, leaving deletes it
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default BlurtPage
