import { useLayoutEffect } from 'react'

const TARGETS = [
  '.section-head', '.story-row', '.steps li', '.feat-row', '.hiw-step', '.hiw-context-grid',
  '.home-project-grid', '.about-project-grid', '.plan', '.cta', '.cta-band', '.image-tile',
  '.dl-grid', '.dl-step', '.pull-text', '.showcase-phones', '.spot-grid', '.ledger-grid', '.quote',
  '.duo-item', '.consider-grid', '.statement-text', '.cf-grid',
].join(',')

export default function useReveal(routeKey) {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    const timers = []
    const els = [...document.querySelectorAll(TARGETS)]
    const vh = window.innerHeight

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target
          el.classList.add('is-in')
          io.unobserve(el)
          timers.push(setTimeout(() => el.classList.remove('reveal', 'is-in'), 1600))
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )

    els.forEach((el) => {
      if (el.getBoundingClientRect().top < vh * 0.92) return
      if (el.tagName === 'LI' || el.classList.contains('image-tile')) {
        const i = Array.prototype.indexOf.call(el.parentElement.children, el)
        el.style.setProperty('--rd', `${(i % 4) * 70}ms`)
      }
      el.classList.add('reveal')
      io.observe(el)
    })

    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
      els.forEach((el) => el.classList.remove('reveal', 'is-in'))
    }
  }, [routeKey])
}