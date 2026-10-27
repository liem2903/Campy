import { useEffect, useRef, useState } from 'react'
import { ListKeymap } from '@tiptap/extension-list'
import { Selection, TextSelection } from '@tiptap/pm/state'
import UniqueID from '@tiptap/extension-unique-id'
import { Placeholder, UndoRedo } from '@tiptap/extensions'
import { EditorContent, Extension, useEditor } from '@tiptap/react'
import { Link, useNavigate } from 'react-router'
import { blockIdAtSelectionStart, blocksToEditorDoc, blockTextsInReadingOrder, editorDocToBlocks } from '../blockTreeConversion.ts'
import { readDraft } from '../drafts.ts'
import { noteBodyNodeExtensions } from '../noteBodyNodeExtensions.ts'
import { useNotes, type NoteContent } from '../notes.ts'
import type { NoteBodyForQuestions } from '../questions.ts'
import type { Tag } from '../tags.ts'
import { useAutosave, type SaveStatus } from '../useAutosave.ts'
import KeyboardShortcutsPanel from './KeyboardShortcutsPanel.tsx'
import NoteTagChips from './NoteTagChips.tsx'
import QuestionColumn from './QuestionColumn.tsx'

const saveStatusLabels: Record<Exclude<SaveStatus['kind'], 'rejected'>, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  retrying: "Couldn't save. Retrying…",
}

// Tab outside a list inserts 4 spaces instead of moving focus out of the editor (decision 8).
// Inside a list it returns false, so the list's own Tab (nest the item) runs instead.
const TabInsertsSpaces = Extension.create({
  name: 'tabInsertsSpaces',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => !editor.isActive('listItem') && editor.commands.insertContent('    '),
    }
  },
})

// Backspace at the start of a paragraph right after a list moves its text onto the end of the
// list's last item. ListKeymap's own version moves the whole paragraph into that item, which an
// item's one-paragraph schema can't hold, so ProseMirror wrapped it in a new item: the dot came back.
const BackspaceJoinsParagraphIntoListAbove = Extension.create({
  name: 'backspaceJoinsParagraphIntoListAbove',
  priority: 101, // runs before ListKeymap's Backspace
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.depth !== 1 || $from.parentOffset !== 0) return false
        const paragraphStart = $from.before()
        const $paragraphStart = editor.state.doc.resolve(paragraphStart)
        const listAbove = $paragraphStart.nodeBefore
        if (listAbove?.type.name !== 'bulletList' && listAbove?.type.name !== 'orderedList') return false
        const lastItemTextEnd = Selection.findFrom($paragraphStart, -1, true)?.from
        if (lastItemTextEnd === undefined) return false
        return editor.commands.command(({ tr }) => {
          tr.delete(paragraphStart, $from.after()).insert(lastItemTextEnd, $from.parent.content)
          tr.setSelection(TextSelection.create(tr.doc, lastItemTextEnd))
          return true
        })
      },
    }
  },
})

// What a note body can hold, plus what typing needs. UniqueID gives each paragraph and item the
// id its block is saved under.
const bodyExtensions = [
  ...noteBodyNodeExtensions,
  BackspaceJoinsParagraphIntoListAbove,
  ListKeymap,
  TabInsertsSpaces,
  UndoRedo,
  UniqueID.configure({ types: ['paragraph', 'listItem'] }),
  Placeholder.configure({ placeholder: 'Start writing...' }),
]

// The title and body of one note, saved as the user types, with its tags between them and its
// questions in a Cornell cue column left of the body.
// NotePage renders it with key={noteId}, so each note gets a fresh editor and autosave.
function NoteEditor(
  { noteId, serverContent, serverTags }: { noteId: string; serverContent: NoteContent; serverTags: Tag[] },
) {
  const { moveEditedNoteToTop, replaceTagIdsOfNoteInList } = useNotes()
  const { saveStatus, scheduleSave, saveNow } = useAutosave(noteId)
  // Edits that never reached the server (expired session, closed tab, crash) win over its copy.
  const [restoredDraft] = useState(() => readDraft(noteId))
  const [content, setContent] = useState<NoteContent>(restoredDraft ?? serverContent)
  const [noteTags, setNoteTags] = useState(serverTags)
  // So All Notes, filtered by tag, shows a note tagged here without a reload.
  useEffect(() => {
    replaceTagIdsOfNoteInList(noteId, noteTags.map((tag) => tag.id))
  }, [noteId, noteTags, replaceTagIdsOfNoteInList])
  // While testing, the body is covered (inert: blurred, can't be focused or read) so you can't peek.
  const [isTestingQuestions, setIsTestingQuestions] = useState(false)
  // Whether the cursor was last in the body rather than the title, so a new question knows if it's
  // about a block. A ref: only read when a card asks, never rendered.
  const isCursorInBodyRef = useRef(false)
  const bodyElementRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const blurtPagePath = `/notes/${noteId}/blurt`

  // Ctrl/⌘ + Shift + Enter opens the blurt page. Capture phase, so it runs before the editor
  // sees the Enter and splits the paragraph.
  useEffect(() => {
    const openBlurtOnShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !event.shiftKey || !(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      navigate(blurtPagePath)
    }
    window.addEventListener('keydown', openBlurtOnShortcut, { capture: true })
    return () => window.removeEventListener('keydown', openBlurtOnShortcut, { capture: true })
  }, [navigate, blurtPagePath])

  function edit(editedContent: NoteContent) {
    setContent(editedContent)
    moveEditedNoteToTop(noteId, editedContent.title)
    scheduleSave(editedContent)
  }

  // A restored draft is already on screen but not on the server: save it straight away.
  // Every dependency is stable, so this runs once, on open.
  useEffect(() => {
    if (!restoredDraft) return
    moveEditedNoteToTop(noteId, restoredDraft.title)
    scheduleSave(restoredDraft)
  }, [restoredDraft, noteId, moveEditedNoteToTop, scheduleSave])

  // Built once: TipTap reads its starting content only when it's created, then keeps its own copy.
  const [startingBodyDoc] = useState(() => blocksToEditorDoc(content.blocks))
  // onUpdate always runs the latest render's callback, so `content.title` here is current.
  const bodyEditor = useEditor({
    extensions: bodyExtensions,
    content: startingBodyDoc,
    onUpdate: ({ editor }) => edit({ ...content, blocks: editorDocToBlocks(editor.state.doc) }),
    onFocus: () => {
      isCursorInBodyRef.current = true
    },
  })

  // TipTap keeps the selection after the body loses focus, so it still says where the cursor was.
  const noteBodyForQuestions: NoteBodyForQuestions = {
    readCursorBlockId: () => (isCursorInBodyRef.current ? blockIdAtSelectionStart(bodyEditor.state.selection) : null),
    readBlockTexts: () => blockTextsInReadingOrder(bodyEditor.state.doc),
    bodyElementRef,
    saveNow,
  }

  const saveFailed = saveStatus.kind === 'retrying' || saveStatus.kind === 'rejected'
  const saveStatusText = saveStatus.kind === 'rejected' ? saveStatus.message : saveStatusLabels[saveStatus.kind]

  return (
    <div className="note-layout">
      <article className="paper">
        <p className="paper-crumbs">
          Notes / {content.title || 'Untitled'}
          <Link to={blurtPagePath} className="crumbs-blurt" aria-keyshortcuts="Control+Shift+Enter" title="Blurt (Ctrl + Shift + Enter)">
            Blurt
          </Link>
          <span
            className="save-status"
            data-failed={saveFailed || undefined}
            data-saved={saveStatus.kind === 'saved' || undefined}
            role="status"
          >
            {saveStatusText}
          </span>
        </p>
        <input
          className="note-title"
          value={content.title}
          onChange={(e) => edit({ ...content, title: e.target.value })}
          onFocus={() => {
            isCursorInBodyRef.current = false
          }}
          placeholder="Untitled"
          autoFocus={content.title === ''}
        />
        <NoteTagChips noteId={noteId} noteTags={noteTags} setNoteTags={setNoteTags} />
        <div className="cornell-grid">
          <QuestionColumn
            noteId={noteId}
            noteTags={noteTags}
            noteBody={noteBodyForQuestions}
            isTesting={isTestingQuestions}
            onTestingChange={setIsTestingQuestions}
          />
          <EditorContent ref={bodyElementRef} editor={bodyEditor} className="note-body" inert={isTestingQuestions} />
        </div>
      </article>
      <KeyboardShortcutsPanel />
    </div>
  )
}

export default NoteEditor
