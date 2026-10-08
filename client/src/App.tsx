import { Outlet, Route, Routes } from 'react-router'
import './App.css'
import RequireAuth from './components/RequireAuth.tsx'
import Sidebar from './components/Sidebar.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotePage from './pages/NotePage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import SignupPage from './pages/SignupPage.tsx'
import WorkspaceHome from './pages/WorkspaceHome.tsx'

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
        <Route index element={<WorkspaceHome />} />
        <Route path="notes/:noteId" element={<NotePage />} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
