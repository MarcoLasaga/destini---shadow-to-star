import { useEffect, useState } from 'react'

const KEY = 'stylesense-theme'

export default function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* storage unavailable, theme still works for this visit */
    }
  }, [theme])

  const toggle = () => {
    const root = document.documentElement
    root.classList.add('theme-anim')
    setTimeout(() => root.classList.remove('theme-anim'), 450)
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggle }
}