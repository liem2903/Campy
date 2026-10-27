import type { Tag } from './tags.ts'

// One question as the question endpoints return it. Tags are in name order; dates are ISO strings.
export type Question = {
  id: string
  noteId: string
  question: string
  answer: string
  tags: Tag[]
  createdAt: string
  updatedAt: string
}
// What a card's Save sends. Tags go by name, so a new one is created on the way.
export type QuestionFields = { question: string; answer: string; tags: string[] }

export const MAX_QUESTION_LENGTH = 500
export const MAX_ANSWER_LENGTH = 5000
export const MAX_TAGS_PER_QUESTION = 20

// "1 question", "3 questions".
export function questionCountText(questionCount: number): string {
  return `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`
}
