import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ScrollManager from './components/ScrollManager.jsx'
import ScrollIndicator from './components/ScrollIndicator.jsx'
import NotFound from './pages/NotFound.jsx'
import useTheme from './hooks/useTheme.js'
import usePageTransition, { cleanPath } from './hooks/usePageTransition.js'
import useReveal from './hooks/useReveal.js'
import { routes, isKnownPath, titleFor } from './routes.jsx'

export default function App() {
  const { theme, toggle } = useTheme()
  const { shown, phase } = usePageTransition()
  const path = cleanPath(shown.pathname)
  const isNotFound = !isKnownPath(path)

  useEffect(() => {
    document.title = titleFor(path)
  }, [path])

  useReveal(path)

  return (
    <>
      <ScrollManager location={shown} />
      <a className="skip-link" href="#main">Skip to content</a>
      {!isNotFound && <Navbar theme={theme} onToggleTheme={toggle} />}
      <main id="main">
        <div key={path} className="page-stage" data-phase={phase}>
          <Routes location={shown}>
            {routes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            {/* catch-all stays last */}
            <Route path="*" element={<NotFound theme={theme} onToggleTheme={toggle} />} />
          </Routes>
        </div>
      </main>
      <Footer dark={isNotFound} />
      <ScrollIndicator routeKey={path} />
    </>
  )
}