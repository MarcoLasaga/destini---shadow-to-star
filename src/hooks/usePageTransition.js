import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export const cleanPath = (p) => p.replace(/\/+$/, '') || '/'

export default function usePageTransition() {
  const location = useLocation()
  const [shown, setShown] = useState(location)
  const [phase, setPhase] = useState('in')

  useEffect(() => {
    if (location === shown) return
    const samePage = cleanPath(location.pathname) === cleanPath(shown.pathname)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (samePage || reduce) {
      const t = setTimeout(() => {
        setShown(location)
        setPhase('in')
      }, 0)
      return () => clearTimeout(t)
    }
    let transitionTimer
    const startTimer = setTimeout(() => {
      setPhase('out')
      transitionTimer = setTimeout(() => {
        setShown(location)
        setPhase('in')
      }, 170)
    }, 0)
    return () => {
      clearTimeout(startTimer)
      clearTimeout(transitionTimer)
    }
  }, [location, shown])

  return { shown, phase }
}