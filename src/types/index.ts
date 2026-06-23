export interface WardrobeItem {
  id: string
  name: string
  category: 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessories'
  color: string
  fabric: string
  style: string
  occasion: string
  size: string
  imageUrl?: string
  createdAt: string
}

export interface Outfit {
  id: string
  title: string
  items: WardrobeItem[]
  style: string
  matchScore: number
  description: string
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  stylePreferences: string[]
}

export interface CommunityPost {
  id: string
  user: User
  outfit: Outfit
  caption: string
  likes: number
  comments: number
  createdAt: string
}