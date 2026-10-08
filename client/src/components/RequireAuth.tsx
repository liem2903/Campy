import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth.ts'

// Renders nothing while the session check is pending, so there's no login flash.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user === undefined) return null
  if (user === null) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

export default RequireAuth
