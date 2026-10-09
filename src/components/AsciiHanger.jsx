import { useMemo } from 'react'
import { HANGER_ROWS, HOOK_ROWS } from '../data/hangerArt.js'

// crop empty margins so the art fills its column, then pad rows to one width
function prepare(rows) {
  let min = Infinity
  let max = 0
  rows.forEach((r) => {
    for (let i = 0; i < r.length; i++) {
      if (r[i] !== '.') {
        min = Math.min(min, i)
        max = Math.max(max, i)
      }
    }
  })
  const from = Math.max(0, min - 3)
  const to = max + 4
  const cropped = rows.map((r) => r.padEnd(to, '.').slice(from, to))
  return { rows: cropped, cols: to - from }
}

export default function AsciiHanger() {
  const { nodes, cols } = useMemo(() => {
    const { rows, cols } = prepare(HANGER_ROWS)
    const nodes = []
    rows.forEach((row, i) => {
      const hook = i < HOOK_ROWS
      ;(row.match(/\.+|[^.]+/g) || []).forEach((t, j) => {
        const cls = t[0] === '.' ? 'h-dot' : hook ? 'h-hook' : 'h-ink'
        nodes.push(<span key={`${i}-${j}`} className={cls}>{t}</span>)
      })
      nodes.push('\n')
    })
    return { nodes, cols }
  }, [])

  return (
    <figure className="hanger" role="img" aria-label="An oversized typographic clothes hanger drawn in text characters">
      <pre className="hanger-pre" style={{ '--cols': cols }} aria-hidden="true">{nodes}</pre>
    </figure>
  )
}