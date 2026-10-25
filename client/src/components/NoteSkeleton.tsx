// Stands in for NoteEditor while the note loads, laid out like it so nothing jumps on arrival.
function NoteSkeleton() {
  return (
    <article className="paper" aria-busy="true">
      <span className="skeleton note-crumbs-skeleton" aria-hidden="true" />
      <span className="skeleton note-title-skeleton" aria-hidden="true" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="skeleton note-line-skeleton" aria-hidden="true" />
      ))}
    </article>
  )
}

export default NoteSkeleton
