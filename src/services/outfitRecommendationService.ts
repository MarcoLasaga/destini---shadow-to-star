import type { GeneratedOutfit, OutfitClothingItem } from '../types';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const CATEGORY: Record<string, OutfitClothingItem['category']> = { TOP: 'Top', BOTTOM: 'Bottom', SHOES: 'Shoes', ACCESSORIES: 'Accessory', OUTERWEAR: 'Outerwear' };

type ApiOutfit = { id: string; occasion: string | null; score: number; reasons: string[]; is_saved: boolean; is_worn: boolean; items: { id: string; clothing_name: string; category: string; image_url: string | null; color: string | null }[] };

function mapOutfit(outfit: ApiOutfit): GeneratedOutfit {
  return {
    id: outfit.id, name: 'Recommended outfit', image: outfit.items[0]?.image_url || '', occasionLabel: outfit.occasion || 'Any occasion', matchPercent: Math.round(outfit.score), sustainPercent: 0, comfortRating: 0, weatherCondition: '', weatherTempF: 0, location: '',
    clothingItems: outfit.items.map((item) => ({ id: item.id, name: item.clothing_name, category: CATEGORY[item.category] || 'Accessory', image: item.image_url || '' })),
    colorPalette: [], whyReasons: outfit.reasons.map((description, index) => ({ icon: 'sparkles', title: index === 0 ? 'Wardrobe match' : 'Recommendation reason', description })), feedback: [], favorited: outfit.is_saved, saved: outfit.is_saved, worn: outfit.is_worn,
  };
}

export async function generateRecommendations(occasion: string, accessToken: string): Promise<GeneratedOutfit[]> {
  const suffix = occasion && occasion !== 'Any occasion' ? `?occasion=${encodeURIComponent(occasion.toUpperCase())}` : '';
  const response = await fetch(`${API_URL}/outfits/generate${suffix}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || 'Could not generate outfits.');
  return (body.data as ApiOutfit[]).map(mapOutfit);
}

export async function updateRecommendation(id: string, patch: Record<string, unknown>, accessToken: string) {
  const response = await fetch(`${API_URL}/outfits/${id}/feedback`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!response.ok) throw new Error('Could not save outfit feedback.');
}
