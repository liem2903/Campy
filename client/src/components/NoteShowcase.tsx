import { useEffect, useState } from 'react'
import type { SampleNote } from '../sampleNotes.ts'

// Graph-view nodes (x, y in a 100×100 box) and the edges between them.
const NODES = [
  [18, 22], [42, 12], [70, 20], [86, 44], [64, 52],
  [30, 48], [14, 74], [44, 82], [76, 80],
]
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 1], [4, 5],
  [5, 0], [5, 6], [6, 7], [7, 4], [7, 8], [8, 3],
]

// Wraps [[links]] (even half-typed ones) in a backlink style, like Obsidian.
function withLinks(text: string) {
  return text.split(/(\[\[[^\]]*(?:\]\])?)/).map((part, i) =>
    part.startsWith('[[') ? (
      <span key={i} className="backlink">
        {part.replace(/\[|\]/g, '')}
      </span>
    ) : (
      part
    ),
  )
}

function NoteShowcase({ note }: { note: SampleNote }) {
  const total = note.lines.join('').length
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [typed, setTyped] = useState(reduceMotion ? total : 0)

  useEffect(() => {
    if (typed >= total) return
    // Uneven delays read as a person typing; the first one waits for the card to settle in.
    const delay = typed === 0 ? 1100 : 28 + Math.random() * 45
    const timer = setTimeout(() => setTyped(typed + 1), delay)
    return () => clearTimeout(timer)
  }, [typed, total])

  // Each line shows whatever part of the shared `typed` count falls past its start.
  const lines = note.lines.map((line, i) =>
    line.slice(0, Math.max(0, typed - note.lines.slice(0, i).join('').length)),
  )
  // The caret sits on the line being typed, then rests at the end of the last one.
  const unfinished = lines.findIndex((line, i) => line.length < note.lines[i].length)
  const activeLine = unfinished === -1 ? note.lines.length - 1 : unfinished

  return (
    <aside className="showcase" aria-hidden="true">
      <svg className="graph" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
        ))}
        {NODES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 2 ? 1 : 0.65} style={{ animationDelay: `${i * -1.3}s` }} />
        ))}
      </svg>

      <div className="note-card">
        <div className="note-card-crumbs">{note.crumbs}</div>
        <h2>{note.title}</h2>
        <ul>
          {lines.map((line, i) =>
            line || i === activeLine ? (
              <li key={i}>
                {withLinks(line)}
                {i === activeLine && <span className="caret" />}
              </li>
            ) : null,
          )}
        </ul>
        <div className={`study-chip${typed >= total ? ' shown' : ''}`}>
          <span className="study-chip-dot" />3 flashcards ready · Quiz me
        </div>
      </div>
    </aside>
  )
}

export default NoteShowcase
