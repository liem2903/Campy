import { Link } from 'react-router'

// Placeholder until Sprint 2 brings the AI quiz.
function QuizPage() {
  return (
    <div className="page-content empty-state">
      <h1 className="auth-title">
        Quizzes are <em>coming.</em>
      </h1>
      <p className="auth-lede">Soon Campi will turn your notes into active-recall questions.</p>
      <Link to="/notes" className="auth-submit">
        Back to my notes
        <span className="auth-submit-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  )
}

export default QuizPage
