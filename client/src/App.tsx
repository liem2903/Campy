import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import './App.css'
import { useAuth } from './auth.ts'
import Sidebar from './components/Sidebar.tsx'
import AllNotesPage from './pages/AllNotesPage.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotePage from './pages/NotePage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import QuizPage from './pages/QuizPage.tsx'
import SignupPage from './pages/SignupPage.tsx'

function Workspace() {
  return (
    <div className="workspace">
      <Sidebar />
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}

// Logged-in pages only. Renders nothing until the first /me check answers, so there's no login flash.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return null
  // Remember where they were headed, so login can send them back.
  if (user === null) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function App() {
  return (
    <Routes>
      <Route
        element={
          <RequireAuth>
            <Workspace />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="notes" element={<AllNotesPage />} />
        <Route path="quiz" element={<QuizPage />} />
        <Route path="notes/:noteId" element={<NotePage />} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
