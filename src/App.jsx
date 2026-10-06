import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ScrollManager from './components/ScrollManager.jsx'
import NotFound from './pages/NotFound.jsx'
import useTheme from './hooks/useTheme.js'
import usePageTransition, { cleanPath } from './hooks/usePageTransition.js'
import useReveal from './hooks/useReveal.js'
import { routes, isKnownPath, titleFor, descriptionFor } from './routes.jsx'

export default function App() {
  const { theme, toggle } = useTheme()
  const { shown, phase } = usePageTransition()
  const clean = cleanPath(shown.pathname)
  const isNotFound = !isKnownPath(clean)

  useEffect(() => {
    document.title = titleFor(clean)
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', descriptionFor(clean))
  }, [clean])

  useReveal(clean)

  return (
    <>
      <ScrollManager location={shown} />
      <a className="skip-link" href="#main">Skip to content</a>
      {!isNotFound && <Navbar theme={theme} onToggleTheme={toggle} />}
      <main id="main">
        <div key={clean} className="page-stage" data-phase={phase}>
          <Routes location={shown}>
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            {/* catch-all stays last */}
            <Route path="*" element={<NotFound theme={theme} onToggleTheme={toggle} />} />
          </Routes>
        </div>
      </main>
      <Footer dark={isNotFound} />
    </>
  )
}