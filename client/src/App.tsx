import { useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import './App.css'
import { useAuth } from './auth.ts'
import { hasSeenGuide, rememberGuideSeen } from './guide.ts'
import BrainMark from './components/BrainMark.tsx'
import GuideDialog from './components/GuideDialog.tsx'
import Sidebar from './components/Sidebar.tsx'
import AllNotesPage from './pages/AllNotesPage.tsx'
import BlurtPage from './pages/BlurtPage.tsx'
import FlashcardsPage from './pages/FlashcardsPage.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotePage from './pages/NotePage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import SignupPage from './pages/SignupPage.tsx'
import TagsPage from './pages/TagsPage.tsx'

// On a phone the sidebar is a drawer behind ☰. It remembers the path it was opened on, so
// following any link in it (a different path) closes it without an effect. Esc or a tap on the
// backdrop closes it too. The guide opens by itself the first time, and from the sidebar after.
function Workspace() {
  const { pathname } = useLocation()
  const [drawerOpenedAtPath, setDrawerOpenedAtPath] = useState<string | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(() => !hasSeenGuide())
  const isDrawerOpen = drawerOpenedAtPath === pathname
  const closeDrawer = () => setDrawerOpenedAtPath(null)

  function closeGuide() {
    rememberGuideSeen()
    setIsGuideOpen(false)
  }

  return (
    <div
      className="workspace"
      data-drawer-open={isDrawerOpen || undefined}
      onKeyDown={(e) => isDrawerOpen && e.key === 'Escape' && closeDrawer()}
    >
      <header className="phone-bar">
        <button
          type="button"
          className="phone-bar-menu"
          aria-label="Open menu"
          aria-expanded={isDrawerOpen}
          onClick={() => setDrawerOpenedAtPath(pathname)}
        >
          {/* Drawn, not the ☰ character, which sits low in most fonts. */}
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <Link to="/" className="auth-brand phone-bar-brand">
          <BrainMark />
          Campi
        </Link>
      </header>
      <Sidebar onOpenGuide={() => setIsGuideOpen(true)} />
      <button type="button" className="drawer-backdrop" aria-label="Close menu" tabIndex={-1} onClick={closeDrawer} />
      <main className="page">
        <Outlet />
      </main>
      {isGuideOpen && <GuideDialog onClose={closeGuide} />}
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
        <Route path="tags" element={<TagsPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        {/* The old placeholder's address, kept so saved links still land somewhere (T4.15). */}
        <Route path="quiz" element={<Navigate to="/flashcards" replace />} />
        <Route path="notes/:noteId" element={<NotePage />} />
        <Route path="notes/:noteId/blurt" element={<BlurtPage />} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
