import { Navigate, matchRoutes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Features from './pages/Features.jsx'
import HowItWorks from './pages/HowItWorks.jsx'
import About from './pages/About.jsx'
import Download from './pages/Download.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Terms from './pages/Terms.jsx'
import Privacy from './pages/Privacy.jsx'

export const routes = [
  { path: '/', element: <Home />, title: 'StyleSense', description: 'StyleSense is an image-based wardrobe and outfit recommendation app that helps you make more of the clothes you already own.' },
  { path: '/features', element: <Features />, title: 'StyleSense — Features', description: 'A digital wardrobe, outfit generation, weather-aware suggestions, a planner and wear tracking, all built from the clothes you already own.' },
  { path: '/how-it-works', element: <HowItWorks />, title: 'StyleSense — How It Works', description: 'From closet to outfit in five steps: build your wardrobe, set your preferences, discover outfits, give feedback and let StyleSense learn.' },
  { path: '/about', element: <About />, title: 'StyleSense — About', description: 'StyleSense is an academic research project about wearing more of what you own and buying less.' },
  { path: '/download', element: <Download />, title: 'StyleSense — Download', description: 'Get the StyleSense mobile app and see outfit recommendations built from your own wardrobe.' },
  { path: '/login', element: <Login />, title: 'StyleSense — Login', description: 'Sign in to your StyleSense account.' },
  { path: '/signup', element: <Signup />, title: 'StyleSense — Sign Up', description: 'Create your StyleSense account.' },
  { path: '/privacy-policy', element: <Privacy />, title: 'StyleSense — Privacy Policy', description: 'How StyleSense collects, uses and protects your information.' },
  { path: '/terms', element: <Terms />, title: 'StyleSense — Terms & Conditions', description: 'The terms that apply when you use StyleSense.' },
  { path: '/privacy', element: <Navigate to="/privacy-policy" replace /> },
  { path: '/terms-and-conditions', element: <Navigate to="/terms" replace /> },
]

const NOT_FOUND = { title: 'StyleSense — Page Not Found', description: 'This page could not be found.' }
const match = (p) => matchRoutes(routes, p)?.[0]?.route

export const isKnownPath = (pathname) => Boolean(match(pathname))
export const titleFor = (pathname) => (match(pathname) ?? NOT_FOUND).title ?? NOT_FOUND.title
export const descriptionFor = (pathname) => (match(pathname) ?? NOT_FOUND).description ?? NOT_FOUND.description
