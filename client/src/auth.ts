import { createContext, useContext } from 'react'

export type User = {
  id: string
  email: string
}

export type AuthContextValue = {
  // undefined while the initial /api/auth/me check is in flight.
  user: User | null | undefined
  // Called after signup/login with the user the server returned.
  setUser: (user: User | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
