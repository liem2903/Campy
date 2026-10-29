import { ListKeymap } from '@tiptap/extension-list'
import { Selection, TextSelection } from '@tiptap/pm/state'
import { UndoRedo } from '@tiptap/extensions'
import { Extension } from '@tiptap/react'

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

// What typing into a note body needs on top of noteBodyContentExtensions, shared by the note
// editor and the blurt editor: list keys, Tab, the Backspace fix and undo/redo.
export const noteBodyTypingExtensions = [BackspaceJoinsParagraphIntoListAbove, ListKeymap, TabInsertsSpaces, UndoRedo]
