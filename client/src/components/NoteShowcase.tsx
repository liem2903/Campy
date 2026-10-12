import { useEffect, useState } from 'react'

// A sample note that types itself out beside the login form, showing what Campi is for.
const TITLE = 'Cellular respiration'
const LINES = [
  'Glycolysis splits glucose into two pyruvate, net 2 ATP.',
  'The Krebs cycle runs in the [[mitochondria]], twice per glucose.',
  'Most ATP comes from the [[electron transport chain]].',
]
const TOTAL = LINES.reduce((sum, line) => sum + line.length, 0)

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

function NoteShowcase() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [typed, setTyped] = useState(reduceMotion ? TOTAL : 0)

  useEffect(() => {
    if (typed >= TOTAL) return
    // Uneven delays read as a person typing; the first one waits for the card to settle in.
    const delay = typed === 0 ? 1100 : 28 + Math.random() * 45
    const timer = setTimeout(() => setTyped(typed + 1), delay)
    return () => clearTimeout(timer)
  }, [typed])

  let remaining = typed
  const lines = LINES.map((line) => {
    const shown = line.slice(0, Math.max(0, remaining))
    remaining -= line.length
    return shown
  })
  // The caret sits on the line being typed, then rests at the end of the last one.
  const unfinished = lines.findIndex((line, i) => line.length < LINES[i].length)
  const activeLine = unfinished === -1 ? LINES.length - 1 : unfinished

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
        <div className="note-card-crumbs">Biology / Unit 3</div>
        <h2>{TITLE}</h2>
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
        <div className={`study-chip${typed >= TOTAL ? ' shown' : ''}`}>
          <span className="study-chip-dot" />3 flashcards ready · Quiz me
        </div>
      </div>
    </aside>
  )
}

export default NoteShowcase
