import { Routes, Route } from 'react-router-dom'
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

// Admin
import AdminLayout from '../admin/AdminLayout'
import AdminDashboard from '../admin/pages/Dashboard'
import AdminUsers from '../admin/pages/Users'
import AdminWardrobeData from '../admin/pages/WardrobeData'
import AdminAnalytics from '../admin/pages/AdminAnalytics'
import Recommendations from '../admin/pages/Recommendations'
import Performance from '../admin/pages/Performance'
import AdminComingSoon from '../admin/pages/AdminComingSoon'

export default function AppRoutes() {
  return (
    <Routes>
      {/* ── Main app ── */}
      <Route path="/"                     element={<Layout><Home /></Layout>} />
      <Route path="/wardrobe"             element={<Layout><Wardrobe /></Layout>} />
      <Route path="/wardrobe/add"         element={<Layout><AddClothes /></Layout>} />
      <Route path="/wardrobe/:clothingId" element={<Layout><ClothingDetails /></Layout>} />
      <Route path="/discover"             element={<Layout><Discover /></Layout>} />
      <Route path="/planner"              element={<Layout><Planner /></Layout>} />
      <Route path="/analytics"            element={<Layout><Analytics /></Layout>} />
      <Route path="/cookbook"             element={<Layout><Cookbook /></Layout>} />
      <Route path="/packing-assistant"    element={<Layout><PackingAssistant /></Layout>} />
      <Route path="/outfit-generator"     element={<Layout><OutfitGenerator /></Layout>} />
      <Route path="/saved-outfits"        element={<Layout><SavedOutfits /></Layout>} />
      <Route path="/settings"             element={<Layout><Settings /></Layout>} />
      <Route path="/help"                 element={<Layout><Help /></Layout>} />
      <Route path="/account"              element={<Layout><Account /></Layout>} />
      <Route path="/login"                element={<Layout><Login /></Layout>} />
      <Route path="/signup"               element={<Layout><Signup /></Layout>} />
      <Route path="/privacy-policy"       element={<Layout><PrivacyPolicy /></Layout>} />
      <Route path="/terms-of-service"     element={<Layout><TermsOfService /></Layout>} />

      {/* ── Admin panel ── */}
      <Route path="/admin" element={<AdminLayout />}>
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