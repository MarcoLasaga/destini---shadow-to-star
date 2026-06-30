import type { ClothingItem, Season } from '../types/wardrobe'

export function estimateSeasons(item: Pick<ClothingItem, 'category' | 'fabric' | 'color'>): Season[] {
  const { category, fabric, color } = item
  const seasons = new Set<Season>()

  // Fabric-based rules
  if (fabric === 'Wool' || fabric === 'Leather') {
    seasons.add('Winter')
  }
  if (fabric === 'Linen' || fabric === 'Cotton') {
    seasons.add('Summer')
    seasons.add('Spring')
  }
  if (fabric === 'Nylon' || fabric === 'Polyester') {
    seasons.add('Rainy')
  }
  if (fabric === 'Knit') {
    seasons.add('Winter')
    seasons.add('Spring')
  }
  if (fabric === 'Denim') {
    seasons.add('Spring')
    seasons.add('Rainy')
  }

  // Category-based rules
  if (category === 'Outerwear') {
    seasons.add('Winter')
    seasons.add('Rainy')
  }
  if (category === 'Accessories') {
    seasons.add('All Season')
  }
  if (category === 'Shoes') {
    seasons.add('Spring')
    seasons.add('Summer')
  }

  // Color-based rule (dark colors trend toward cooler seasons, light toward warm)
  const darkColors = ['Black', 'Navy', 'Brown', 'Burgundy']
  const lightColors = ['White', 'Cream', 'Beige', 'Pink']
  if (darkColors.includes(color)) seasons.add('Winter')
  if (lightColors.includes(color)) seasons.add('Summer')

  // If nothing matched, default to All Season
  if (seasons.size === 0) seasons.add('All Season')

  // If it covers 3+ seasons already, just call it All Season
  if (seasons.size >= 3) return ['All Season']

  return Array.from(seasons)
}