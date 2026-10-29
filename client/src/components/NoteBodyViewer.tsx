import { useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { noteBodyContentExtensions } from '../noteBodyContentExtensions.ts'

// A note body (or a blurt, which holds the same content) shown like the editor shows it, but
// read-only. TipTap reads its content only when it's created, so to show another doc, the
// caller remounts this with a new key.
function NoteBodyViewer({ bodyDoc }: { bodyDoc: JSONContent }) {
  const [startingBodyDoc] = useState(bodyDoc)
  const bodyViewer = useEditor({ extensions: noteBodyContentExtensions, content: startingBodyDoc, editable: false })
  return <EditorContent editor={bodyViewer} className="note-body" />
}

export default NoteBodyViewer
