import axios from 'axios'
import type { Flashcard, FlashcardGrade, FlashcardSession } from './flashcards.ts'
import type { NoteContent, NoteDetail, NoteSummary } from './notes.ts'
import type { Question, QuestionFields } from './questions.ts'
import type { Tag, TagWithNoteCount } from './tags.ts'

export type User = { id: string; email: string }

// Same origin through the Vite proxy, so the session cookie is sent automatically.
export const api = axios.create({ baseURL: '/api' })

// Set by AuthProvider: runs when a protected call gets a 401 (session expired or revoked).
let unauthorizedHandler = () => {}
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

// Surface the server's { error } message instead of axios's generic "Request failed..." text.
api.interceptors.response.use(undefined, (err: unknown) => {
  if (axios.isAxiosError(err)) {
    // /auth/* 401s are expected (wrong password, nobody logged in yet) and handled by the caller.
    if (err.response?.status === 401 && !err.config?.url?.startsWith('/auth/')) unauthorizedHandler()
    const message: unknown = err.response?.data?.error
    if (typeof message === 'string') return Promise.reject(new Error(message))
  }
  return Promise.reject(err)
})

// Creates the account and logs you in: the server sets the session cookie.
export async function signUp(email: string, password: string): Promise<User> {
  const { data } = await api.post<User>('/auth/signup', { email, password })
  return data
}

// Checks the email and password and logs you in: the server sets the session cookie.
export async function logIn(email: string, password: string): Promise<User> {
  const { data } = await api.post<User>('/auth/login', { email, password })
  return data
}

// Who's logged in, from the session cookie. Rejects with a 401 when nobody is.
export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}

// Ends the session on the server, which also clears the cookie.
export async function logOut(): Promise<void> {
  await api.post('/auth/logout', {})
}

// Creates the note on the server under the client's id. 'taken' = 409 Conflict (another user has it).
export async function createNoteOnServer(id: string): Promise<'created' | 'taken'> {
  // 409 counts as a normal response, so it skips the interceptor and keeps its status.
  const { status } = await api.post('/notes', { id }, {
    validateStatus: (s) => (s >= 200 && s < 300) || s === 409,
  })
  return status === 409 ? 'taken' : 'created'
}

// This user's notes, most recently edited first.
export async function listNotes(): Promise<NoteSummary[]> {
  const { data } = await api.get<NoteSummary[]>('/notes')
  return data
}

// One of this user's notes with its body. null = 404 Not Found (missing, or another user's).
export async function getNoteFromServer(id: string): Promise<NoteDetail | null> {
  // 404 counts as a normal response, so it skips the interceptor and keeps its status.
  const { data, status } = await api.get<NoteDetail>(`/notes/${id}`, {
    validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
  })
  return status === 404 ? null : data
}

// Deletes the note on the server. Rejects only on a network error or 5xx, the failures worth
// retrying. Any 4xx resolves: 404 means it's already gone, and after a 401 (logged out) trying
// again can't help.
export async function deleteNoteOnServer(id: string): Promise<void> {
  // {} because the server only accepts JSON on requests that change data (415 otherwise).
  await api.delete(`/notes/${id}`, { data: {}, validateStatus: (s) => s < 500 })
}

// A save the server refused. Retrying the same content won't help, so autosave stops and shows this.
export type SaveRejection = { saved: false; message: string }
export type SaveResult = { saved: true; updatedAt: string } | SaveRejection

const saveRejectionMessages: Record<number, string> = {
  404: 'This note was deleted',
  413: 'This note is too large to save',
}

// Saves the note's whole title and body. Rejects on a network error, 5xx or 401 Unauthorized:
// those are worth retrying (a 401 also logs the user out through the interceptor).
export async function saveNoteToServer(id: string, content: NoteContent): Promise<SaveResult> {
  // These statuses count as normal responses, so they skip the interceptor and keep their status.
  const { data, status } = await api.put<{ updatedAt: string } | { error: string }>(`/notes/${id}`, content, {
    validateStatus: (s) => (s >= 200 && s < 300) || s === 400 || s in saveRejectionMessages,
  })
  const rejectionMessage = saveRejectionMessages[status]
  if (rejectionMessage) return { saved: false, message: rejectionMessage }
  // 400 Bad Request: the server says what's wrong (a long title, or blocks our editor got wrong).
  if ('error' in data) return { saved: false, message: data.error }
  return { saved: true, updatedAt: data.updatedAt }
}

// Tag calls reject with the server's message (e.g. "A tag called queue already exists" on a
// 409 Conflict), so the caller can show it as is.

// This user's tags in name order, each with how many notes it's on.
export async function listTagsFromServer(): Promise<TagWithNoteCount[]> {
  const { data } = await api.get<TagWithNoteCount[]>('/tags')
  return data
}

// Creates a tag on no notes. The server trims and lowercases the name.
export async function createTagOnServer(name: string): Promise<Tag> {
  const { data } = await api.post<Tag>('/tags', { name })
  return data
}

export async function renameTagOnServer(tagId: string, name: string): Promise<Tag> {
  const { data } = await api.patch<Tag>(`/tags/${tagId}`, { name })
  return data
}

// Deletes the tag and takes it off every note.
export async function deleteTagOnServer(tagId: string): Promise<void> {
  await api.delete(`/tags/${tagId}`, { data: {} })
}

// Puts the tag called `name` on the note, creating the tag if it's new, and returns that tag.
export async function tagNoteOnServer(noteId: string, name: string): Promise<Tag> {
  const { data } = await api.post<Tag>(`/notes/${noteId}/tags`, { name })
  return data
}

// Takes the tag off this note only.
export async function untagNoteOnServer(noteId: string, tagId: string): Promise<void> {
  await api.delete(`/notes/${noteId}/tags/${tagId}`, { data: {} })
}

// Question calls reject with the server's message (e.g. "A question must be 1 to 500 characters"
// on a 400 Bad Request), so the caller can show it as is.

// The note's questions, oldest first.
export async function listQuestionsFromServer(noteId: string): Promise<Question[]> {
  const { data } = await api.get<Question[]>(`/notes/${noteId}/questions`)
  return data
}

export async function createQuestionOnServer(noteId: string, fields: QuestionFields): Promise<Question> {
  const { data } = await api.post<Question>(`/notes/${noteId}/questions`, fields)
  return data
}

// Replaces the question's text and its whole tag list.
export async function updateQuestionOnServer(questionId: string, fields: QuestionFields): Promise<Question> {
  const { data } = await api.put<Question>(`/questions/${questionId}`, fields)
  return data
}

// Deletes the question. 404 Not Found resolves too: it's already gone.
export async function deleteQuestionOnServer(questionId: string): Promise<void> {
  await api.delete(`/questions/${questionId}`, {
    data: {},
    validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
  })
}

// Today's flashcards: new cards (up to the daily cap) first, then due ones. The time zone decides
// when "today" starts (4 am there).
// tagIds empty = every card. Several tags go as ?tag=a&tag=b (indexes: null drops axios's tag[]=).
export async function getFlashcardSessionFromServer(timeZone: string, tagIds: string[]): Promise<FlashcardSession> {
  const { data } = await api.get<FlashcardSession>('/flashcards', {
    params: { timeZone, tag: tagIds },
    paramsSerializer: { indexes: null },
  })
  return data
}

// Grades a card. The server works out its new schedule (T4.3, T4.10–T4.11) and replies 200 OK with
// the card as it now is, so a card sent back by Again shows its new intervals.
export async function gradeFlashcardOnServer(questionId: string, grade: FlashcardGrade, timeZone: string): Promise<Flashcard> {
  const { data } = await api.post<Flashcard>(`/flashcards/${questionId}/grade`, { grade, timeZone })
  return data
}
