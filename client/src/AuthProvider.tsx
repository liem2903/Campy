import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getMe, type User } from './api.ts'
import { AuthContext } from './auth.ts'

// Asks the server who's logged in once, on load.
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    // Only fill in a still-unknown user: if signup finished first, keep its answer.
    getMe().then(
      (me) => setUser((prev) => (prev === undefined ? me : prev)),
      () => setUser((prev) => (prev === undefined ? null : prev)),
    )
  }, [])

  const value = useMemo(() => ({ user, setUser }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
