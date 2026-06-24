export type Category = 'Top' | 'Bottom' | 'Shoes' | 'Outerwear' | 'Accessories'
export type Style    = 'Casual' | 'Formal' | 'Sporty' | 'Streetwear' | 'Minimalist' | 'Bohemian' | 'Vintage' | 'Classic'
export type Fabric   = 'Cotton' | 'Denim' | 'Polyester' | 'Wool' | 'Silk' | 'Linen' | 'Leather' | 'Knit' | 'Nylon' | 'Other'
export type Occasion = 'School' | 'Work' | 'Gym' | 'Party' | 'Date' | 'Outdoor' | 'Everyday'
export type Size     = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'

export interface ClothingItem {
  id: string
  name: string
  category: Category
  color: string
  colorHex: string
  fabric: Fabric
  style: Style
  occasion: Occasion
  size: Size
  imageUrl?: string
  createdAt: string
}