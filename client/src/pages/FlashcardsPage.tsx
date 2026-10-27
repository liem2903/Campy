import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getFlashcardSessionFromServer } from '../api.ts'
import FlashcardStudySession from '../components/FlashcardStudySession.tsx'
import { browserTimeZone, nextDueText, type FlashcardSession } from '../flashcards.ts'

// Start screen: how many new and due cards there are today, or when the next ones are due. Start
// opens the study session; its Back returns here.
function FlashcardsPage() {
  // null until the session arrives.
  const [session, setSession] = useState<FlashcardSession | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isStudying, setIsStudying] = useState(false)
  // Bumped by Back, so the start screen loads the session again (now fewer cards or "All done").
  const [startScreenLoadCount, setStartScreenLoadCount] = useState(0)

  useEffect(() => {
    getFlashcardSessionFromServer(browserTimeZone()).then(setSession, () =>
      setErrorMessage("Couldn't load your flashcards. Try reloading the page."),
    )
  }, [startScreenLoadCount])

  function backToStartScreen() {
    setIsStudying(false)
    setSession(null)
    setStartScreenLoadCount((loadCount) => loadCount + 1)
  }

  if (session && isStudying) {
    return (
      <div className="page-content">
        <FlashcardStudySession cards={session.cards} onBack={backToStartScreen} />
      </div>
    )
  }
  if (session === null && !errorMessage) return null
  const newCardCount = session?.cards.filter((card) => card.isNew).length ?? 0
  const dueCardCount = (session?.cards.length ?? 0) - newCardCount
  return (
    <div className="page-content empty-state">
      <h1 className="auth-title">
        Your <em>flashcards.</em>
      </h1>
      {errorMessage && <p className="auth-lede">{errorMessage}</p>}
      {session && session.cards.length > 0 && (
        <>
          <p className="auth-lede">{newCardCount} new · {dueCardCount} due</p>
          <button type="button" autoFocus onClick={() => setIsStudying(true)} className="auth-submit">
            Start
            <span className="auth-submit-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </>
      )}
      {session && session.cards.length === 0 && !session.hasAnyQuestions && (
        <>
          <p className="auth-lede">No questions yet. Press Ctrl+Alt+M in a note to write one.</p>
          <Link to="/notes" className="auth-submit">
            Go to your notes
            <span className="auth-submit-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </>
      )}
      {session && session.cards.length === 0 && session.hasAnyQuestions && (
        <p className="auth-lede">All done for today. {session.nextDue && nextDueText(session.nextDue)}</p>
      )}
    </div>
  )
}

export default FlashcardsPage
