import { Routes, Route } from 'react-router-dom'
import Layout from '../components/layout/layout'
import Home from '../pages/Home/Home'
import Wardrobe from '../pages/Wardrobe/Wardrobe'
import AddClothes from '../pages/Wardrobe/AddClothes'
import Discover from '../pages/Discover'
import Planner from '../pages/Planner'
import Analytics from '../pages/Analytics'
import Cookbook from '../pages/Cookbook'
import OutfitGenerator from '../pages/OutfitGenerator'
import SavedOutfits from '../pages/SavedOutfits'
import Settings from '../pages/Settings'
import Help from '../pages/Help'
import Account from '../pages/Account'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/"                 element={<Layout><Home /></Layout>} />
      <Route path="/wardrobe"         element={<Layout><Wardrobe /></Layout>} />
      <Route path="/wardrobe/add"     element={<Layout><AddClothes /></Layout>} />
      <Route path="/discover"         element={<Layout><Discover /></Layout>} />
      <Route path="/planner"          element={<Layout><Planner /></Layout>} />
      <Route path="/analytics"        element={<Layout><Analytics /></Layout>} />
      <Route path="/cookbook"         element={<Layout><Cookbook /></Layout>} />
      <Route path="/outfit-generator" element={<Layout><OutfitGenerator /></Layout>} />
      <Route path="/saved-outfits"    element={<Layout><SavedOutfits /></Layout>} />
      <Route path="/settings"         element={<Layout><Settings /></Layout>} />
      <Route path="/help"             element={<Layout><Help /></Layout>} />
      <Route path="/account"          element={<Layout><Account /></Layout>} />
    </Routes>
  )
}