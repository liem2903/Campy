import { createContext, useContext } from 'react'
import type { User } from './api.ts'

export type AuthContextValue = {
  // undefined while the first /me check is in flight, null when logged out.
  user: User | null | undefined
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
