export type Category = 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessories'
export type Style    = 'Casual' | 'Formal' | 'Sporty' | 'Streetwear' | 'Minimalist' | 'Bohemian' | 'Vintage' | 'Classic'
export type Fabric   = 'Cotton' | 'Denim' | 'Polyester' | 'Wool' | 'Silk' | 'Linen' | 'Leather' | 'Knit' | 'Nylon' | 'Other'
export type Occasion = 'School' | 'Work' | 'Gym' | 'Party' | 'Date' | 'Outdoor' | 'Everyday'
export type Size     = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
export type LaundryStatus = 'Clean' | 'Needs Washing' | 'In Laundry'
export type Season   = 'Spring' | 'Summer' | 'Rainy' | 'Winter' | 'All Season'

export interface ClothingItem {
  id:           string
  name:         string
  category:     Category
  color:        string
  colorHex:     string
  fabric:       Fabric
  style:        Style
  occasion:     Occasion
  size:         Size
  imageUrl?:    string
  createdAt:    string

  // ── New fields for the details page ──
  brand?:        string
  timesWorn:     number
  lastWorn:      string | null      // ISO date or null = "Never"
  dateAdded:     string             // ISO date
  cost:          number | null      // user-entered, null = "—"
  laundryStatus: LaundryStatus
  seasons:       Season[]
  favorited:     boolean
}