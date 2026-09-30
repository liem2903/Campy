import axios, { isAxiosError } from 'axios'

// All API calls go through this instance. Bodies are always JSON: the server
// rejects mutating /api requests without Content-Type: application/json (CSRF guard).
export const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Body-less mutations (e.g. logout) still send {} so they pass the JSON check.
api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (method !== 'get' && method !== 'head' && config.data === undefined) {
    config.data = {}
  }
  return config
})

// Turns a failed request into a message to show the user: the server's
// { error } when there is one, otherwise a generic fallback.
export function errorMessage(err: unknown): string {
  if (isAxiosError<{ error?: unknown }>(err)) {
    if (!err.response) return 'Could not reach the server. Please try again.'
    const message = err.response.data?.error
    if (typeof message === 'string') return message
  }
  return 'Something went wrong. Please try again.'
}
