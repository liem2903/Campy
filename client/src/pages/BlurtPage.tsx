import { useState } from 'react'
import { Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Link, useParams } from 'react-router'
import { getNoteFromServer } from '../api.ts'
import BlurtReveal, { type RevealedNote } from '../components/BlurtReveal.tsx'
import FormatBubbleMenu from '../components/FormatBubbleMenu.tsx'
import IconPillButton from '../components/IconPillButton.tsx'
import NoteNotFound from '../components/NoteNotFound.tsx'
import { commandKey } from '../keyboardLabels.ts'
import { noteBodyContentExtensions } from '../noteBodyContentExtensions.ts'
import { noteBodyTypingExtensions } from '../noteBodyTypingExtensions.ts'
import { useNotes } from '../notes.ts'
import { useAskBeforeClosingTab } from '../useAskBeforeClosingTab.ts'
import { useElapsedSeconds } from '../useElapsedSeconds.ts'

// Strong ease-out, so the sheet answers the click straight away. Entry via @starting-style
// (Tailwind's starting: variant); reduced motion keeps only the fade.
const sheetEnter =
  'transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:scale-[0.985] motion-reduce:starting:scale-100'
const keyHint = 'rounded border border-[var(--line)] px-1.5 py-0.5 [font-family:inherit]'

const countWords = (text: string) => (text.trim() === '' ? 0 : text.trim().split(/\s+/).length)

// Typed like a note body (lists, headings, bold and the rest), but with no UniqueID: a blurt is
// never saved, so its blocks need no ids.
const blurtExtensions = [
  ...noteBodyContentExtensions,
  ...noteBodyTypingExtensions,
  Placeholder.configure({ placeholder: "Go. Don't stop to check." }),
]

function formatMinutesSeconds(totalSeconds: number) {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

// A full-screen sheet over the whole app, so nothing else can cue you. Only the title shows:
// the body isn't fetched until Done. The blurt is never stored, so leaving asks first.
function BlurtPage() {
  const { noteId: noteIdFromUrl } = useParams()
  const { notes: noteList, loading } = useNotes()
  const listEntry = noteList.find((n) => n.id === noteIdFromUrl)
  // "Blurt again" bumps this, so the attempt remounts: a new empty editor, timer and reveal.
  const [attemptNumber, setAttemptNumber] = useState(1)

  if (loading) return null
  if (!listEntry) return <NoteNotFound />

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-bg ${sheetEnter}`}>
      <BlurtAttempt
        key={attemptNumber}
        noteId={listEntry.id}
        title={listEntry.title || 'Untitled'}
        onBlurtAgain={() => setAttemptNumber((previousAttemptNumber) => previousAttemptNumber + 1)}
      />
    </div>
  )
}

type BlurtAttemptProps = { noteId: string; title: string; onBlurtAgain: () => void }

// One blurt, from the empty editor to the reveal.
function BlurtAttempt({ noteId, title, onBlurtAgain }: BlurtAttemptProps) {
  // null while writing. Once revealed, nothing is lost by leaving, so there's no warning.
  const [revealedNote, setRevealedNote] = useState<RevealedNote | null>(null)
  const isWriting = revealedNote === null
  const [attemptStartedAt] = useState(() => Date.now())
  const elapsedSeconds = useElapsedSeconds(attemptStartedAt, isWriting)
  // Outlives the writing view, so the reveal can read the blurt from it.
  const blurtEditor = useEditor({ extensions: blurtExtensions, autofocus: true })
  const blurtWordCount = useEditorState({ editor: blurtEditor, selector: ({ editor }) => countWords(editor.getText()) })
  const blurtIsEmpty = blurtWordCount === 0
  useAskBeforeClosingTab(isWriting && !blurtIsEmpty)

  // Fetched only now, so the body never reaches the browser while you blurt.
  const revealNote = async () => {
    setRevealedNote({ status: 'loading' })
    try {
      // null = 404 Not Found: deleted while you blurted, so it shows as an empty note.
      const noteDetailOrNull = await getNoteFromServer(noteId)
      setRevealedNote({ status: 'loaded', blocks: noteDetailOrNull?.blocks ?? [] })
    } catch {
      setRevealedNote({ status: 'failed' })
    }
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-3 text-[13px] text-muted">
        <span className="truncate">
          Blurting · <span className="text-text">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-4 tabular-nums">
          <span>{formatMinutesSeconds(elapsedSeconds)}</span>
          <span>{blurtWordCount} words</span>
          <Link
            to={`/notes/${noteId}`}
            onClick={(event) => {
              if (isWriting && !blurtIsEmpty && !window.confirm("Leave? Your blurt won't be kept.")) event.preventDefault()
            }}
            className="-my-[3px] rounded-md border border-[var(--line)] px-2 py-0.5 text-muted no-underline transition-colors duration-150 hover:border-muted hover:text-text"
          >
            Close ✕
          </Link>
        </span>
      </header>
      {revealedNote ? (
        <BlurtReveal
          noteId={noteId}
          title={title}
          blurtDoc={blurtEditor.getJSON()}
          revealedNote={revealedNote}
          onRetry={revealNote}
          onBlurtAgain={onBlurtAgain}
        />
      ) : (
        <div className="mx-auto box-border flex min-h-0 w-full max-w-[680px] flex-1 flex-col px-6 pt-[10vh]">
          <h1 className="note-title !m-0 !mb-10 text-center !text-[52px]">{title}</h1>
          <EditorContent
            editor={blurtEditor}
            className="note-body blurt-body min-h-0 flex-1 overflow-y-auto"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !blurtIsEmpty) void revealNote()
            }}
          />
          <FormatBubbleMenu editor={blurtEditor} />
          <div className="flex flex-col items-center gap-3 py-8">
            <IconPillButton onClick={revealNote} disabled={blurtIsEmpty} icon="→">
              I'm done
            </IconPillButton>
            <span className="text-[12px] text-muted">
              <span className="keyboard-only">
                or <kbd className={keyHint}>{commandKey}</kbd> + <kbd className={keyHint}>Enter</kbd> ·{' '}
              </span>
              not saved, leaving deletes it
            </span>
          </div>
        </div>
      )}
    </>
  )
}

export default BlurtPage
