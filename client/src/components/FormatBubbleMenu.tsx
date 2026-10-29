import { useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { commandKey } from '../keyboardLabels.ts'

// B and I buttons that float above selected text, for when there's no keyboard (phones).
// BubbleMenu shows it only while the selection is non-empty.
function FormatBubbleMenu({ editor }: { editor: Editor }) {
  // The editor doesn't re-render React on every change, so read the active marks through
  // useEditorState: it re-renders only when one of these two values flips.
  const activeMarks = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isBold: currentEditor.isActive('bold'),
      isItalic: currentEditor.isActive('italic'),
    }),
  })

  return (
    <BubbleMenu editor={editor} className="format-menu">
      <button
        type="button"
        className="format-menu-button font-bold"
        aria-pressed={activeMarks.isBold}
        title={`Bold (${commandKey} + B)`}
        // Keeps focus (and so the selection) in the editor while the button is pressed.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </button>
      <button
        type="button"
        className="format-menu-button italic [font-family:var(--serif)]"
        aria-pressed={activeMarks.isItalic}
        title={`Italic (${commandKey} + I)`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        I
      </button>
    </BubbleMenu>
  )
}

export default FormatBubbleMenu
