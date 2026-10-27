import { useEffect, useRef } from 'react'

// On a Mac, ⌘ stands in for Ctrl and Option for Alt.
const shortcuts = [
  { keys: 'Ctrl + Alt + M', action: 'Add a question' },
  { keys: 'Ctrl + Enter', action: 'Save the question being edited' },
  { keys: 'Esc', action: 'Cancel the question being edited, or stop testing' },
  { keys: 'Space', action: 'Show the answer while testing' },
  { keys: '1 / 2', action: 'Mark the answer Wrong or Right while testing' },
  { keys: 'Ctrl + Shift + Enter', action: 'Blurt this note' },
  { keys: 'Tab', action: 'Insert 4 spaces (outside a list)' },
  { keys: '- or 1. then Space', action: 'Start a dot or numbered list' },
  { keys: 'Tab / Shift + Tab', action: 'Indent or outdent a list item' },
  { keys: '?', action: 'Show these shortcuts' },
]

// While typing, "?" is just a character.
function isTypingIn(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
}

// The "Keyboard shortcuts" panel, opened with "?" anywhere on the note page except while typing.
function KeyboardShortcutsPanel() {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const openOnQuestionMark = (event: KeyboardEvent) => {
      if (event.key !== '?' || isTypingIn(event.target)) return
      event.preventDefault()
      dialogRef.current?.showModal()
    }
    window.addEventListener('keydown', openOnQuestionMark)
    return () => window.removeEventListener('keydown', openOnQuestionMark)
  }, [])

  return (
    // Esc closes a modal dialog by itself; a click on the backdrop (the dialog element itself,
    // outside its content) closes it too.
    <dialog
      ref={dialogRef}
      onClick={(event) => event.target === event.currentTarget && dialogRef.current?.close()}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-[var(--line)] bg-bg p-0 text-text backdrop:bg-black/30"
    >
      <div className="p-6">
        <h2 className="mt-0 mb-4 text-[16px] font-semibold">Keyboard shortcuts</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.action} className="contents">
              <dt>
                <kbd className="crumbs-key-hint !ml-0">{shortcut.keys}</kbd>
              </dt>
              <dd className="m-0 text-muted">{shortcut.action}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 mb-0 text-[12px] text-muted">On a Mac, use ⌘ for Ctrl and Option for Alt.</p>
      </div>
    </dialog>
  )
}

export default KeyboardShortcutsPanel
