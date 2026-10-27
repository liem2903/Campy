import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getFlashcardSessionFromServer, listTagsFromServer } from '../api.ts'
import FlashcardStudySession from '../components/FlashcardStudySession.tsx'
import TagFilterChips from '../components/TagFilterChips.tsx'
import { browserTimeZone, nextDueText, type FlashcardSession } from '../flashcards.ts'
import { selectedTagNamesText, type Tag } from '../tags.ts'
import { useTagFilterInUrl } from '../useTagFilterInUrl.ts'

// Start screen: how many new and due cards there are today, or when the next ones are due, for
// every question or only those with the picked tags (T4b). Start opens the study session; its Back
// returns here with the same tags picked.
function FlashcardsPage() {
  // null until the session arrives.
  const [session, setSession] = useState<FlashcardSession | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [isStudying, setIsStudying] = useState(false)
  // Bumped by Back, so the start screen loads the session again (now fewer cards or "All done").
  const [startScreenLoadCount, setStartScreenLoadCount] = useState(0)
  // Empty until loaded; if loading fails the filter just doesn't show.
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useTagFilterInUrl()

  useEffect(() => {
    listTagsFromServer().then(setTags, () => {})
  }, [])

  // Picking a tag loads the session again. The old counts stay up meanwhile (no blank flash); stale
  // drops an answer for tags that are no longer picked, so a slow reply can't overwrite a newer one.
  // A success clears an earlier error, e.g. after Clear on a bad ?tag= link.
  useEffect(() => {
    let stale = false
    getFlashcardSessionFromServer(browserTimeZone(), selectedTagIds).then(
      (loadedSession) => {
        if (stale) return
        setSession(loadedSession)
        setErrorMessage('')
      },
      () => !stale && setErrorMessage("Couldn't load your flashcards. Try reloading the page."),
    )
    return () => {
      stale = true
    }
  }, [startScreenLoadCount, selectedTagIds])

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
  if (session === null && !errorMessage) {
    return (
      <div className="page-content empty-state" aria-busy="true">
        <h1 className="auth-title">
          Your <em>flashcards.</em>
        </h1>
        <span className="skeleton flashcards-count-skeleton" aria-hidden="true" />
      </div>
    )
  }
  const newCardCount = session?.cards.filter((card) => card.isNew).length ?? 0
  const dueCardCount = (session?.cards.length ?? 0) - newCardCount
  const isFiltered = selectedTagIds.length > 0
  return (
    <div className="page-content empty-state">
      <h1 className="auth-title">
        Your <em>flashcards.</em>
      </h1>
      {(session?.hasAnyQuestions || isFiltered) && (
        <TagFilterChips tags={tags} selectedTagIds={selectedTagIds} onSelectedTagIdsChange={setSelectedTagIds} />
      )}
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
      {session && session.cards.length === 0 && !session.hasAnyQuestions && isFiltered && (
        <p className="auth-lede">
          No questions tagged {selectedTagNamesText(tags, selectedTagIds) || 'with that tag'} yet.
        </p>
      )}
      {session && session.cards.length === 0 && !session.hasAnyQuestions && !isFiltered && (
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
