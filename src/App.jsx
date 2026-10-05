import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ScrollManager from './components/ScrollManager.jsx'
import Home from './pages/Home.jsx'
import Features from './pages/Features.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import About from './pages/About.jsx'
import Download from './pages/Download.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Terms from './pages/Terms.jsx'
import Privacy from './pages/Privacy.jsx'
import NotFound from './pages/NotFound.jsx'
import useTheme from './hooks/useTheme.js'
import usePageTransition, { cleanPath } from './hooks/usePageTransition.js'
import useReveal from './hooks/useReveal.js'

// every real path, including redirect aliases. Anything else is the 404.
const knownPaths = [
  '/', '/features', '/how-it-works', '/about', '/download',
  '/login', '/signup', '/privacy-policy', '/terms',
  '/privacy', '/terms-and-conditions',
]

export default function App() {
  const { theme, toggle } = useTheme()
  const { shown, phase } = usePageTransition()
  const clean = cleanPath(shown.pathname)
  const isNotFound = !knownPaths.includes(clean)

  useReveal(clean)

  return (
    <>
      <ScrollManager location={shown} />
      <a className="skip-link" href="#main">Skip to content</a>
      {!isNotFound && <Navbar theme={theme} onToggleTheme={toggle} />}
      <main id="main">
        <div key={clean} className="page-stage" data-phase={phase}>
          <Routes location={shown}>
            <Route path="/" element={<Home />} />
            <Route path="/features" element={<Features />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/about" element={<About />} />
            <Route path="/download" element={<Download />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/privacy-policy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
            <Route path="/terms-and-conditions" element={<Navigate to="/terms" replace />} />
            {/* catch-all stays last */}
            <Route path="*" element={<NotFound theme={theme} onToggleTheme={toggle} />} />
          </Routes>
        </div>
      </main>
      <Footer dark={isNotFound} />
    </>
  )
}