import axios from 'axios'

export type User = { id: string; email: string }

// Same origin through the Vite proxy, so the session cookie is sent automatically.
export const api = axios.create({ baseURL: '/api' })

// Surface the server's { error } message instead of axios's generic "Request failed..." text.
api.interceptors.response.use(undefined, (err: unknown) => {
  const message: unknown = axios.isAxiosError(err) ? err.response?.data?.error : undefined
  return Promise.reject(typeof message === 'string' ? new Error(message) : err)
})

// Creates the account and logs you in: the server sets the session cookie.
export async function signUp(email: string, password: string): Promise<User> {
  const { data } = await api.post<User>('/auth/signup', { email, password })
  return data
}

// Who's logged in, from the session cookie. Rejects with a 401 when nobody is.
export async function getMe(): Promise<User> {
  throw new Error('Not implemented')
}
