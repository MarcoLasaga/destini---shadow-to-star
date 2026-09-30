import type { GeneratedOutfit, OutfitClothingItem } from '../types';
import { getApiUrl } from './apiConfig';
const CATEGORY: Record<string, OutfitClothingItem['category']> = { TOP: 'Top', BOTTOM: 'Bottom', SHOES: 'Shoes', ACCESSORIES: 'Accessory', OUTERWEAR: 'Outerwear' };

type ApiOutfit = { id: string; occasion: string | null; score: number; reasons: string[]; is_saved: boolean; is_worn: boolean; items: { id: string; clothing_name: string; category: string; image_url: string | null; color: string | null }[] };

function mapOutfit(outfit: ApiOutfit): GeneratedOutfit {
  const uniqueReasons = outfit.reasons.filter((reason, index, reasons) => reasons.findIndex((candidate) => candidate.trim().toLowerCase() === reason.trim().toLowerCase()) === index);
  return {
    id: outfit.id, name: 'Recommended outfit', image: outfit.items[0]?.image_url || '', occasionLabel: outfit.occasion || 'Any occasion', matchPercent: Math.round(outfit.score), sustainPercent: 0, comfortRating: 0, weatherCondition: null, weatherTempF: null, location: null,
    clothingItems: outfit.items.map((item) => ({ id: item.id, name: item.clothing_name, category: CATEGORY[item.category] || 'Accessory', image: item.image_url || '' })),
    colorPalette: [], whyReasons: uniqueReasons.map((description, index) => ({ id: description.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'), icon: 'sparkles', title: index === 0 ? 'Wardrobe match' : description, description })), feedback: [], favorited: outfit.is_saved, saved: outfit.is_saved, worn: outfit.is_worn,
  };
}

export async function generateRecommendations(occasion: string, accessToken: string): Promise<GeneratedOutfit[]> {
  const suffix = occasion && occasion !== 'Any occasion' ? `?occasion=${encodeURIComponent(occasion.toUpperCase())}` : '';
  const response = await fetch(`${getApiUrl()}/outfits/generate${suffix}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || 'Could not generate outfits.');
  return (body.data as ApiOutfit[]).map(mapOutfit);
}

export async function getRecommendationHistory(accessToken: string): Promise<GeneratedOutfit[]> {
  const response = await fetch(`${getApiUrl()}/outfits/history`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || 'Could not load outfit history.');
  return (body.data as ApiOutfit[]).map(mapOutfit);
}

export async function updateRecommendation(id: string, patch: Record<string, unknown>, accessToken: string) {
  const response = await fetch(`${getApiUrl()}/outfits/${id}/feedback`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  if (!response.ok) throw new Error('Could not save outfit feedback.');
}
