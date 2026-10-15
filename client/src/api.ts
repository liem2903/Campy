import axios from 'axios'
import type { NoteSummary } from './notes.ts'

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
