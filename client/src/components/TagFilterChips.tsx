import type { Tag } from '../tags.ts'

// The user's tags as toggles above a list. Several picked = items with any of them. Clear shows
// whenever something is picked, even a tag deleted since (its chip is gone, but its id is in the URL).
function TagFilterChips({ tags, selectedTagIds, onSelectedTagIdsChange }: {
  tags: Tag[]
  selectedTagIds: string[]
  onSelectedTagIdsChange: (tagIds: string[]) => void
}) {
  if (tags.length === 0) return null

  function toggleTag(tagId: string) {
    onSelectedTagIdsChange(selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((selectedTagId) => selectedTagId !== tagId)
      : [...selectedTagIds, tagId])
  }

  return (
    <div className="tag-filter" role="group" aria-label="Filter by tag">
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className="tag-stamp tag-filter-chip"
          aria-pressed={selectedTagIds.includes(tag.id)}
          onClick={() => toggleTag(tag.id)}
        >
          {tag.name}
        </button>
      ))}
      {selectedTagIds.length > 0 && (
        <button type="button" className="tag-stamp-add" onClick={() => onSelectedTagIdsChange([])}>
          Clear
        </button>
      )}
    </div>
  )
}

export default TagFilterChips
