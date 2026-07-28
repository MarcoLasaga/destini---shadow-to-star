import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/layout/layout'
import Home from '../pages/Home/Home'
import Wardrobe from '../pages/Wardrobe/Wardrobe'
import AddClothes from '../pages/AddClothes'
import ClothingDetails from '../pages/Wardrobe/ClothingDetails'
import Discover from '../pages/Discover'
import Planner from '../pages/Planner'
import Analytics from '../pages/Analytics'
import Cookbook from '../pages/Cookbook'
import PackingAssistant from '../pages/PackingAssistant'
import OutfitGenerator from '../pages/OutfitGenerator'
import SavedOutfits from '../pages/SavedOutfits'
import Settings from '../pages/Settings'
import Help from '../pages/Help'
import Account from '../pages/Account'
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
      {/* ── Main app ── */}
      <Route path="/"                     element={<Layout><Home /></Layout>} />
      <Route path="/wardrobe"             element={<ProtectedRoute><Layout><Wardrobe /></Layout></ProtectedRoute>} />
      <Route path="/wardrobe/add"         element={<ProtectedRoute><Layout><AddClothes /></Layout></ProtectedRoute>} />
      <Route path="/wardrobe/:clothingId" element={<ProtectedRoute><Layout><ClothingDetails /></Layout></ProtectedRoute>} />
      <Route path="/discover"             element={<ProtectedRoute><Layout><Discover /></Layout></ProtectedRoute>} />
      <Route path="/planner"              element={<ProtectedRoute><Layout><Planner /></Layout></ProtectedRoute>} />
      <Route path="/analytics"            element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
      <Route path="/cookbook"             element={<ProtectedRoute><Layout><Cookbook /></Layout></ProtectedRoute>} />
      <Route path="/packing-assistant"    element={<ProtectedRoute><Layout><PackingAssistant /></Layout></ProtectedRoute>} />
      <Route path="/outfit-generator"     element={<ProtectedRoute><Layout><OutfitGenerator /></Layout></ProtectedRoute>} />
      <Route path="/saved-outfits"        element={<ProtectedRoute><Layout><SavedOutfits /></Layout></ProtectedRoute>} />
      <Route path="/settings"             element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/help"                 element={<ProtectedRoute><Layout><Help /></Layout></ProtectedRoute>} />
      <Route path="/account"              element={<ProtectedRoute><Layout><Account /></Layout></ProtectedRoute>} />
      <Route path="/login"                element={<Layout><Login /></Layout>} />
      <Route path="/signup"               element={<Layout><Signup /></Layout>} />
      <Route path="/privacy-policy"       element={<Layout><PrivacyPolicy /></Layout>} />
      <Route path="/terms-of-service"     element={<Layout><TermsOfService /></Layout>} />

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