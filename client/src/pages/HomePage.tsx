import { useState } from 'react'
import { Link } from 'react-router'
import { useNotes } from '../notes.ts'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function HomePage() {
  const { notes, loading } = useNotes()
  // Worked out once per visit, so it doesn't flip mid-render.
  const [hello] = useState(() => greeting(new Date().getHours()))
  // Already newest first.
  const recent = notes.slice(0, 3)

  return (
    <div className="page-content home">
      <p className="home-eyebrow">{hello}</p>
      <h1 className="auth-title">
        What are we doing <em>today?</em>
      </h1>
      <p className="auth-lede">Test what you remember, or go back to your notes.</p>

      <div className="home-choices">
        <Link to="/flashcards" className="home-card home-card-quiz">
          <span className="home-card-kicker">Practice</span>
          <span className="home-card-title">Flashcards</span>
          <span className="home-card-text">Review your questions, spaced out so they stick.</span>
          <span className="home-card-go">
            Start <span aria-hidden="true">→</span>
          </span>
        </Link>

        <Link to="/notes" className="home-card">
          <span className="home-card-kicker">Library</span>
          <span className="home-card-title">All notes</span>
          {loading ? (
            <span aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className="skeleton home-card-skeleton" />
              ))}
            </span>
          ) : recent.length > 0 ? (
            <ul className="home-card-recent">
              {recent.map((note) => (
                <li key={note.id}>{note.title || 'Untitled'}</li>
              ))}
            </ul>
          ) : (
            <span className="home-card-text">Nothing here yet. Write your first page.</span>
          )}
          <span className="home-card-go">
            {loading ? 'Open ' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} `}
            <span aria-hidden="true">→</span>
          </span>
        </Link>
      </div>
    </div>
  )
}

export default HomePage
