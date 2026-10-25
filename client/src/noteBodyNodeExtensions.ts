import Document from '@tiptap/extension-document'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

// What a note body can hold, shared by the editor and the read-only viewer: paragraphs and
// dot/numbered list items. An item holds one paragraph, then nested lists, matching a list_item
// block's text and children.
export const noteBodyNodeExtensions = [
  Document,
  Paragraph,
  Text,
  BulletList,
  OrderedList,
  ListItem.extend({ content: 'paragraph (bulletList | orderedList)*' }),
]
