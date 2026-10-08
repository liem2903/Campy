import { isAxiosError } from 'axios'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api.ts'
import { AuthContext, type User } from './auth.ts'

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    api
      .get<User>('/api/auth/me')
      .then((res) => res.data)
      .catch(() => null)
      .then((me) => {
        // Don't overwrite a user set by signup/login while this was in flight.
        if (!cancelled) setUser((prev) => (prev === undefined ? me : prev))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A 401 from a protected endpoint means the session is gone: drop the user so
  // RequireAuth sends them to /login. /api/auth/* is excluded so a failed login
  // shows its error and the initial /me check doesn't bounce anyone off /signup.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (err: unknown) => {
      if (
        isAxiosError(err) &&
        err.response?.status === 401 &&
        !err.config?.url?.startsWith('/api/auth/')
      ) {
        setUser(null)
      }
      return Promise.reject(err)
    })
    return () => api.interceptors.response.eject(id)
  }, [])

  const value = useMemo(() => ({ user, setUser }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
