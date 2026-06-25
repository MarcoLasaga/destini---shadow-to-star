import { Routes, Route } from 'react-router-dom'
import Layout from '../components/layout/layout'
import Home from '../pages/Home/Home'
import Wardrobe from '../pages/Wardrobe/Wardrobe'
import AddClothes from '../pages/Wardrobe/AddClothes'
import Discover from '../pages/Discover'
import Planner from '../pages/Planner'
import Analytics from '../pages/Analytics'
import Calendar from '../pages/Calendar'
import OutfitHistory from '../pages/OutfitHistory'
import Community from '../pages/Community'
import SavedOutfits from '../pages/SavedOutfits'
import WardrobeGaps from '../pages/WardrobeGaps'
import Settings from '../pages/Settings'
import Help from '../pages/Help'
import Account from '../pages/Account'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/"               element={<Layout><Home /></Layout>} />
      <Route path="/wardrobe"       element={<Layout><Wardrobe /></Layout>} />
      <Route path="/wardrobe/add"   element={<Layout><AddClothes /></Layout>} />
      <Route path="/discover"       element={<Layout><Discover /></Layout>} />
      <Route path="/planner"        element={<Layout><Planner /></Layout>} />
      <Route path="/analytics"      element={<Layout><Analytics /></Layout>} />
      <Route path="/calendar"       element={<Layout><Calendar /></Layout>} />
      <Route path="/outfit-history" element={<Layout><OutfitHistory /></Layout>} />
      <Route path="/community"      element={<Layout><Community /></Layout>} />
      <Route path="/saved-outfits"  element={<Layout><SavedOutfits /></Layout>} />
      <Route path="/wardrobe-gaps"  element={<Layout><WardrobeGaps /></Layout>} />
      <Route path="/settings"       element={<Layout><Settings /></Layout>} />
      <Route path="/help"           element={<Layout><Help /></Layout>} />
      <Route path="/account"        element={<Layout><Account /></Layout>} />
    </Routes>
  )
}