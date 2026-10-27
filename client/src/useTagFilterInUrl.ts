import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

// The tags picked in a tag filter, kept in the URL as ?tag=<id>&tag=<id>, so a link (e.g. "Study"
// on the Tags page) can pre-select them and a reload keeps them. Empty = no filter.
export function useTagFilterInUrl(): [string[], (tagIds: string[]) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  // Memoised on searchParams, so the array only changes when the URL does (safe as an effect dep).
  const selectedTagIds = useMemo(() => searchParams.getAll('tag'), [searchParams])

  // replace: toggling chips shouldn't fill the Back button's history.
  function setSelectedTagIds(tagIds: string[]) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('tag')
    for (const tagId of tagIds) nextSearchParams.append('tag', tagId)
    setSearchParams(nextSearchParams, { replace: true })
  }
  return [selectedTagIds, setSelectedTagIds]
}
