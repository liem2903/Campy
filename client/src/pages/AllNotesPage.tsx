import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { listTagsFromServer } from '../api.ts'
import TagFilterChips from '../components/TagFilterChips.tsx'
import { useNotes } from '../notes.ts'
import { selectedTagNamesText, type Tag } from '../tags.ts'
import { useTagFilterInUrl } from '../useTagFilterInUrl.ts'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function AllNotesPage() {
  const { notes, loading, createNote } = useNotes()
  const navigate = useNavigate()
  // Empty until loaded; if loading fails the filter just doesn't show.
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useTagFilterInUrl()

  useEffect(() => {
    listTagsFromServer().then(setTags, () => {})
  }, [])

  // Blank until the list arrives, so the empty state doesn't flash.
  if (loading) return null
  if (notes.length === 0) {
    return (
      <div className="page-content empty-state">
        <h1 className="auth-title">
          A blank <em>page.</em>
        </h1>
        <p className="auth-lede">Write a note, then turn it into flashcards and quizzes.</p>
        <button
          type="button"
          className="auth-submit"
          onClick={() => navigate(`/notes/${createNote()}`)}
        >
          Create your first page
          <span className="auth-submit-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    )
  }

  // Filtered in the browser: the list already carries each note's tag ids (T1b).
  const shownNotes = selectedTagIds.length === 0
    ? notes
    : notes.filter((note) => note.tagIds.some((tagId) => selectedTagIds.includes(tagId)))
  const pageCountText = `${shownNotes.length} ${shownNotes.length === 1 ? 'page' : 'pages'}`
  const tagNamesText = selectedTagNamesText(tags, selectedTagIds)
  return (
    <div className="page-content library">
      <h1 className="auth-title">
        All <em>notes.</em>
      </h1>
      <p className="auth-lede">
        {selectedTagIds.length === 0
          ? `${pageCountText}, most recently edited first.`
          : `${pageCountText} tagged ${tagNamesText || 'with a deleted tag'}.`}
      </p>
      <TagFilterChips tags={tags} selectedTagIds={selectedTagIds} onSelectedTagIdsChange={setSelectedTagIds} />
      <div className="library-grid">
        {shownNotes.map((note) => (
          <Link key={note.id} to={`/notes/${note.id}`} className="library-card">
            <span className="library-card-title">{note.title || 'Untitled'}</span>
            <span className="library-card-date">{dateFormat.format(new Date(note.updatedAt))}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default AllNotesPage
