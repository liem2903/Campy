import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Italic from '@tiptap/extension-italic'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import { InputRule } from '@tiptap/react'
import Paragraph from '@tiptap/extension-paragraph'
import Strike from '@tiptap/extension-strike'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'

// What a note body can hold, shared by the editor and the read-only viewer: paragraphs, H1–H3
// headings and dot/numbered list items, with bold, italic, underlined and struck-through text. An
// item holds one paragraph, then nested lists, matching a list_item block's text and children.
// The extensions also bring their shortcuts (Ctrl/⌘ + B, I, U, Shift + S, Alt + 1–3) and markdown
// typing (**bold**, *italic*, ~~strike~~, # heading).
const headingLevels = [1, 2, 3] as const

// Heading's own `# ` rule builds the heading with only a level, dropping the paragraph's id, so
// the block would be saved as a new one and a question pointing at it would lose its block.
// This version keeps the paragraph's attributes (its id) and sets the level on top.
const HeadingKeepingBlockId = Heading.extend({
  addInputRules() {
    return headingLevels.map((level) => new InputRule({
      find: new RegExp(`^#{${level}}\\s$`),
      handler: ({ state, range }) => {
        const paragraphAttrs = state.doc.resolve(range.from).parent.attrs
        state.tr.delete(range.from, range.to).setBlockType(range.from, range.from, this.type, { ...paragraphAttrs, level })
      },
    }))
  },
}).configure({ levels: [...headingLevels] })

export const noteBodyContentExtensions = [
  Document,
  Paragraph,
  HeadingKeepingBlockId,
  Text,
  Bold,
  Italic,
  Underline,
  Strike,
  BulletList,
  OrderedList,
  ListItem.extend({ content: 'paragraph (bulletList | orderedList)*' }),
]
