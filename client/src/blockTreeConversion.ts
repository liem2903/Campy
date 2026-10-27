import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Selection } from '@tiptap/pm/state'
import type { JSONContent } from '@tiptap/react'
import type { ListItemStyle, NoteBlock } from './notes.ts'

// Turns a note's blocks into TipTap's document and back. A `text` block is a paragraph node. A
// `list_item` block is a listItem node: its text in a paragraph, then its children in nested
// lists. TipTap wraps items in bulletList/orderedList containers that the blocks don't store, so
// loading groups consecutive items of the same style into one container, and saving unwraps them.

const listNodeTypeByStyle: Record<ListItemStyle, string> = { bullet: 'bulletList', numbered: 'orderedList' }

// The editor's starting content. An empty note gets one empty paragraph with an id of our own:
// left without one, UniqueID would add it after opening, which counts as an edit and saves.
export function blocksToEditorDoc(blocks: NoteBlock[]): JSONContent {
  if (blocks.length === 0) return { type: 'doc', content: [paragraphNode(crypto.randomUUID(), '')] }
  return { type: 'doc', content: blocksToNodes(blocks) }
}

// The blocks to save, read from the editor's current document.
export function editorDocToBlocks(editorDoc: ProseMirrorNode): NoteBlock[] {
  return editorDoc.children.flatMap((topLevelNode) =>
    topLevelNode.type.name === 'paragraph'
      ? [{ id: String(topLevelNode.attrs.id), type: 'text', properties: { text: topLevelNode.textContent } }]
      : listNodeToBlocks(topLevelNode))
}

// The saved block the selection starts in: the list item around it, else its top-level paragraph.
// The paragraph inside an item isn't saved (its id is thrown away), so the item comes first.
// null when it starts in neither (a whole-document selection).
export function blockIdAtSelectionStart(selection: Selection): string | null {
  const { $from } = selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'listItem') return String(node.attrs.id)
  }
  const topLevelNode = $from.depth > 0 ? $from.node(1) : null
  return topLevelNode?.type.name === 'paragraph' ? String(topLevelNode.attrs.id) : null
}

// Every saved block's text by id, in reading order (a list item comes before its nested items).
export function blockTextsInReadingOrder(editorDoc: ProseMirrorNode): Map<string, string> {
  const blockTexts = new Map<string, string>()
  editorDoc.descendants((node, _position, parentNode) => {
    if (node.type.name === 'listItem') blockTexts.set(String(node.attrs.id), node.firstChild?.textContent ?? '')
    else if (node.type.name === 'paragraph' && parentNode === editorDoc) blockTexts.set(String(node.attrs.id), node.textContent)
    // A paragraph holds only text, so there's nothing saved further down.
    return node.type.name !== 'paragraph'
  })
  return blockTexts
}

function blocksToNodes(blocks: NoteBlock[]): JSONContent[] {
  const nodes: JSONContent[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      nodes.push(paragraphNode(block.id, block.properties.text))
      continue
    }
    // The paragraph inside an item isn't saved, so a fresh id each load is fine. Giving it one
    // stops UniqueID from adding it after opening, which would count as an edit.
    const listItemNode: JSONContent = {
      type: 'listItem',
      attrs: { id: block.id },
      content: [paragraphNode(crypto.randomUUID(), block.properties.text), ...blocksToNodes(block.children)],
    }
    const listNodeType = listNodeTypeByStyle[block.properties.style]
    const previousNode = nodes.at(-1)
    if (previousNode?.type === listNodeType) previousNode.content!.push(listItemNode)
    else nodes.push({ type: listNodeType, content: [listItemNode] })
  }
  return nodes
}

// One bulletList/orderedList node → its items as blocks, each with its nested lists as children.
function listNodeToBlocks(listNode: ProseMirrorNode): NoteBlock[] {
  const style: ListItemStyle = listNode.type.name === 'orderedList' ? 'numbered' : 'bullet'
  return listNode.children.map((listItemNode) => ({
    id: String(listItemNode.attrs.id),
    type: 'list_item',
    // The schema makes the first child the item's paragraph; the rest are nested lists.
    properties: { text: listItemNode.firstChild?.textContent ?? '', style },
    children: listItemNode.children.slice(1).flatMap(listNodeToBlocks),
  }))
}

function paragraphNode(id: string, text: string): JSONContent {
  // ProseMirror doesn't allow empty text nodes, so an empty paragraph has no content.
  return { type: 'paragraph', attrs: { id }, content: text ? [{ type: 'text', text }] : [] }
}
