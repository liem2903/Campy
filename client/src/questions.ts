import type { RefObject } from 'react'
import type { Tag } from './tags.ts'

// One question as the question endpoints return it. Tags are in name order; dates are ISO strings.
export type Question = {
  id: string
  noteId: string
  // The block of the note it's about; null = General.
  blockId: string | null
  // True once its block was deleted (blockId is then null), until it's attached again.
  blockWasDeleted: boolean
  question: string
  answer: string
  tags: Tag[]
  createdAt: string
  updatedAt: string
}
// What a card's Save sends. Tags go by name, so a new one is created on the way.
export type QuestionFields = { question: string; answer: string; tags: string[]; blockId: string | null }

// What the cue column reads from the note body. Functions are called when needed, so the column
// doesn't re-render on every cursor move.
export type NoteBodyForQuestions = {
  // The block the body's cursor was last in; null when it was last in the title, or never in the body.
  readCursorBlockId: () => string | null
  // Every block's text by id, in reading order.
  readBlockTexts: () => Map<string, string>
  // The body's element, whose blocks carry their id as data-id.
  bodyElementRef: RefObject<HTMLDivElement | null>
  // Sends any pending autosave, so a block typed moments ago exists on the server.
  saveNow: () => Promise<void>
}

export const MAX_QUESTION_LENGTH = 500
export const MAX_ANSWER_LENGTH = 5000
export const MAX_TAGS_PER_QUESTION = 20

// "1 question", "3 questions".
export function questionCountText(questionCount: number): string {
  return `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`
}

const SNIPPET_LENGTH = 30

// True when the block was deleted: on the server (blockWasDeleted), or in the editor before
// autosave has caught up (blockTexts no longer has it).
export function isAboutDeletedBlock(blockId: string | null, blockWasDeleted: boolean, blockTexts: Map<string, string>): boolean {
  return blockId === null ? blockWasDeleted : !blockTexts.has(blockId)
}

// What a card says it's about: "General", "(deleted paragraph)", or the block's opening words.
export function aboutText(blockId: string | null, blockWasDeleted: boolean, blockTexts: Map<string, string>): string {
  if (isAboutDeletedBlock(blockId, blockWasDeleted, blockTexts)) return '(deleted paragraph)'
  if (blockId === null) return 'General'
  const blockText = blockTexts.get(blockId)!.trim()
  if (blockText === '') return '(empty paragraph)'
  return `"${blockText.length > SNIPPET_LENGTH ? `${blockText.slice(0, SNIPPET_LENGTH).trimEnd()}…` : blockText}"`
}
