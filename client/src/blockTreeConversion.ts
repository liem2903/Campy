import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { JSONContent } from '@tiptap/react'
import type { NoteBlock } from './notes.ts'

// Turns a note's blocks into TipTap's document and back. Paragraphs only for now: each `text`
// block is one paragraph node with the same id. Ticket 2 adds nested list items.

// The editor's starting content. An empty note gets one empty paragraph with an id of our own:
// left without one, UniqueID would add it after opening, which counts as an edit and saves.
export function blocksToEditorDoc(blocks: NoteBlock[]): JSONContent {
  if (blocks.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph', attrs: { id: crypto.randomUUID() } }] }
  }
  return {
    type: 'doc',
    content: blocks.map((block) => ({
      type: 'paragraph',
      attrs: { id: block.id },
      // ProseMirror doesn't allow empty text nodes, so an empty paragraph has no content.
      content: block.properties.text ? [{ type: 'text', text: block.properties.text }] : [],
    })),
  }
}

// The blocks to save, read from the editor's current document.
export function editorDocToBlocks(editorDoc: ProseMirrorNode): NoteBlock[] {
  return editorDoc.children.map((paragraph) => ({
    id: String(paragraph.attrs.id),
    type: 'text',
    properties: { text: paragraph.textContent },
  }))
}
