import { useEffect, useState } from 'react'

const KEY = 'stylesense-theme'

export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') {
      return 'light'
    }

    const rootTheme = document.documentElement.getAttribute('data-theme')
    if (rootTheme === 'dark' || rootTheme === 'light') {
      return rootTheme
    }

    try {
      const savedTheme = localStorage.getItem(KEY)
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme
      }
    } catch {
      /* storage unavailable, theme still works for this visit */
    }

    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* storage unavailable, theme still works for this visit */
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}