import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Selection } from '@tiptap/pm/state'
import type { JSONContent } from '@tiptap/react'
import type { ListItemStyle, NoteBlock, TextMark } from './notes.ts'

// Turns a note's blocks into TipTap's document and back. A `text` block is a paragraph node. A
// `list_item` block is a listItem node: its text in a paragraph, then its children in nested
// lists. TipTap wraps items in bulletList/orderedList containers that the blocks don't store, so
// loading groups consecutive items of the same style into one container, and saving unwraps them.
// Bold and italic are runs over the plain text in the blocks, and marks on text nodes in TipTap.

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
      ? [{
          id: String(topLevelNode.attrs.id),
          type: 'text',
          properties: { text: topLevelNode.textContent, ...marksPropertyOf(topLevelNode) },
        }]
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
      nodes.push(paragraphNode(block.id, block.properties.text, block.properties.marks))
      continue
    }
    // The paragraph inside an item isn't saved, so a fresh id each load is fine. Giving it one
    // stops UniqueID from adding it after opening, which would count as an edit.
    const listItemNode: JSONContent = {
      type: 'listItem',
      attrs: { id: block.id },
      content: [
        paragraphNode(crypto.randomUUID(), block.properties.text, block.properties.marks),
        ...blocksToNodes(block.children),
      ],
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
    properties: { text: listItemNode.firstChild?.textContent ?? '', style, ...marksPropertyOf(listItemNode.firstChild) },
    children: listItemNode.children.slice(1).flatMap(listNodeToBlocks),
  }))
}

function paragraphNode(id: string, text: string, marks: TextMark[] = []): JSONContent {
  return { type: 'paragraph', attrs: { id }, content: textNodesWithMarks(text, marks) }
}

// The text cut at every mark edge, each piece a text node with the marks that cover all of it.
// "milk and eggs" with bold 0–4 → "milk" (bold), " and eggs" (plain).
function textNodesWithMarks(text: string, marks: TextMark[]): JSONContent[] {
  const markEdges = marks.flatMap((mark) => [mark.from, mark.to])
  const cutPoints = [...new Set([0, text.length, ...markEdges])].sort((a, b) => a - b)
  return cutPoints.slice(0, -1).flatMap((pieceStart, index) => {
    const pieceEnd = cutPoints[index + 1]
    const pieceText = text.slice(pieceStart, pieceEnd)
    // ProseMirror doesn't allow empty text nodes (an empty paragraph, or a mark past the end).
    if (!pieceText) return []
    const markTypesOnPiece = new Set(
      marks.filter((mark) => mark.from <= pieceStart && pieceEnd <= mark.to).map((mark) => mark.type),
    )
    const pieceNode: JSONContent = { type: 'text', text: pieceText }
    if (markTypesOnPiece.size > 0) pieceNode.marks = [...markTypesOnPiece].map((type) => ({ type }))
    return [pieceNode]
  })
}

// A paragraph's bold and italic runs, joined across its text nodes: in "milk and" with milk bold
// and "and" bold italic, bold is one run over three nodes. Left out (not []) when there are none,
// so unformatted blocks are saved the same as before formatting existed.
function marksPropertyOf(paragraph: ProseMirrorNode | null): { marks?: TextMark[] } {
  const marks: TextMark[] = []
  paragraph?.forEach((textNode, textNodeStart) => {
    const textNodeEnd = textNodeStart + textNode.nodeSize
    for (const mark of textNode.marks) {
      const markType = mark.type.name
      if (markType !== 'bold' && markType !== 'italic') continue
      const runEndingHere = marks.find((run) => run.type === markType && run.to === textNodeStart)
      if (runEndingHere) runEndingHere.to = textNodeEnd
      else marks.push({ type: markType, from: textNodeStart, to: textNodeEnd })
    }
  })
  return marks.length > 0 ? { marks } : {}
}
