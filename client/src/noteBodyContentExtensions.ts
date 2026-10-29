import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import Italic from '@tiptap/extension-italic'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

// What a note body can hold, shared by the editor and the read-only viewer: paragraphs and
// dot/numbered list items, with bold and italic text. An item holds one paragraph, then nested
// lists, matching a list_item block's text and children. Bold and Italic also bring their
// shortcuts (Ctrl/⌘ + B, Ctrl/⌘ + I) and markdown typing (**bold**, *italic*).
export const noteBodyContentExtensions = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  BulletList,
  OrderedList,
  ListItem.extend({ content: 'paragraph (bulletList | orderedList)*' }),
]
