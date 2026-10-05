import { useEffect, useRef, useState } from 'react'

const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n))
const pad = (n) => String(n).padStart(2, '0')

export default function ScrollIndicator({ routeKey }) {
  const root = useRef(null)
  const [ticks, setTicks] = useState([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    let blocks = []
    let raf = 0

    const measure = () => {
      blocks = [...document.querySelectorAll('#main .page-stage > *')]
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max < window.innerHeight * 0.6 || blocks.length < 2) {
        setTicks([])
        return
      }
      setTicks(
        blocks.map((b, i) => {
          const y = b.getBoundingClientRect().top + window.scrollY
          return i === 0 ? { y: 0, f: 0 } : { y, f: clamp(y / max) }
        })
      )
    }

    const update = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? clamp(window.scrollY / max) : 0
      root.current?.style.setProperty('--p', p.toFixed(4))

      const probe = window.scrollY + window.innerHeight * 0.4
      let idx = 0
      blocks.forEach((b, i) => {
        if (b.getBoundingClientRect().top + window.scrollY <= probe) idx = i
      })
      setActive((a) => (a === idx ? a : idx))
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    const refresh = () => {
      measure()
      update()
    }

    refresh()
    window.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(refresh)
    ro.observe(document.body)

    return () => {
      window.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [routeKey])

  const goTo = (y) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: Math.max(0, y - 90), behavior: reduce ? 'auto' : 'smooth' })
  }

  const on = ticks.length > 1

  return (
    <div className="sc" ref={root} data-on={on}>
      <div className="sbar" aria-hidden="true"><i /></div>

      {on && (
        <nav className="sind" aria-label="Page sections">
          <span className="sind-count" aria-hidden="true">
            {pad(active + 1)}<b> / {pad(ticks.length)}</b>
          </span>
          <div className="sind-track">
            <span className="sind-fill" aria-hidden="true" />
            <span className="sind-mark" aria-hidden="true" />
            {ticks.map((t, i) => (
              <button
                key={i}
                type="button"
                className={`sind-tick${i === active ? ' is-active' : ''}`}
                style={{ top: `${t.f * 100}%` }}
                aria-label={`Go to section ${i + 1} of ${ticks.length}`}
                aria-current={i === active ? 'true' : undefined}
                onClick={() => goTo(t.y)}
              />
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}