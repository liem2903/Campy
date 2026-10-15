import { useState } from 'react'
import { Link } from 'react-router'
import { useNotes } from '../notes.ts'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function HomePage() {
  const { notes } = useNotes()
  // Worked out once per visit, so it doesn't flip mid-render.
  const [hello] = useState(() => greeting(new Date().getHours()))
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)

  return (
    <div className="page-content home">
      <p className="home-eyebrow">{hello}</p>
      <h1 className="auth-title">
        What are we doing <em>today?</em>
      </h1>
      <p className="auth-lede">Test what you remember, or go back to your notes.</p>

      <div className="home-choices">
        <Link to="/quiz" className="home-card home-card-quiz">
          <span className="home-card-kicker">Practice</span>
          <span className="home-card-title">Quiz me</span>
          <span className="home-card-text">Active-recall questions drawn from your notes.</span>
          <span className="home-card-go">
            Start <span aria-hidden="true">→</span>
          </span>
        </Link>

        <Link to="/notes" className="home-card">
          <span className="home-card-kicker">Library</span>
          <span className="home-card-title">All notes</span>
          {recent.length > 0 ? (
            <ul className="home-card-recent">
              {recent.map((note) => (
                <li key={note.id}>{note.title || 'Untitled'}</li>
              ))}
            </ul>
          ) : (
            <span className="home-card-text">Nothing here yet. Write your first page.</span>
          )}
          <span className="home-card-go">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'} <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
    </div>
  )
}

export default HomePage
