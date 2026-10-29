import { useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { blocksToEditorDoc } from '../blockTreeConversion.ts'
import type { NoteBlock } from '../notes.ts'
import { noteBodyContentExtensions } from '../noteBodyContentExtensions.ts'

// A note's body shown like the editor shows it, but read-only. TipTap reads its content only
// when it's created, so to show other blocks, the caller remounts this with a new key.
function NoteBodyViewer({ blocks }: { blocks: NoteBlock[] }) {
  const [bodyDoc] = useState(() => blocksToEditorDoc(blocks))
  const bodyViewer = useEditor({ extensions: noteBodyContentExtensions, content: bodyDoc, editable: false })
  return <EditorContent editor={bodyViewer} className="note-body" />
}

export default NoteBodyViewer
