import { Routes, Route, Navigate } from 'react-router-dom'
import PortalLayout from '../components/portal/PortalLayout'
import PortalHome from '../pages/PortalHome'
import Login from '../pages/Login'
import Signup from '../pages/Signup'
import PrivacyPolicy from '../pages/PrivacyPolicy'
import TermsOfService from '../pages/TermsOfService'
import { useAuth } from '../context/useAuth'

// Admin
import AdminLayout from '../admin/AdminLayout'
import AdminDashboard from '../admin/pages/Dashboard'
import AdminUsers from '../admin/pages/Users'
import AdminWardrobeData from '../admin/pages/WardrobeData'
import AdminAnalytics from '../admin/pages/AdminAnalytics'
import Recommendations from '../admin/pages/Recommendations'
import Performance from '../admin/pages/Performance'
import AdminComingSoon from '../admin/pages/AdminComingSoon'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth()

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-slate-500">Loading...</div>
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Web portal ── */}
      <Route path="/"                     element={<PortalLayout><PortalHome /></PortalLayout>} />
      <Route path="/login"                element={<PortalLayout><Login /></PortalLayout>} />
      <Route path="/signup"               element={<PortalLayout><Signup /></PortalLayout>} />
      <Route path="/privacy-policy"       element={<PortalLayout><PrivacyPolicy /></PortalLayout>} />
      <Route path="/terms-of-service"     element={<PortalLayout><TermsOfService /></PortalLayout>} />

      {/* ── Admin panel ── */}
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index                  element={<AdminDashboard />} />
        <Route path="dashboard"       element={<AdminDashboard />} />
        <Route path="users"           element={<AdminUsers />} />
        <Route path="wardrobe"        element={<AdminWardrobeData />} />
        <Route path="analytics"       element={<AdminAnalytics />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="performance"     element={<Performance />} />
        <Route path="research"        element={<AdminComingSoon title="Research Analytics" />} />
        <Route path="thesis"          element={<AdminComingSoon title="Thesis Contributions" />} />
      </Route>
    </Routes>
  )
}
