import { ClothingItem, PackingItem } from '../types';

export interface BuildPackingChecklistParams {
  destination: string;
  startDate: string;
  endDate: string;
  occasion: string;
  packingMode: 'light' | 'heavy';
  cleanWardrobeItems: ClothingItem[];
  avgTempF?: number;
  weatherCondition?: string;
}

export function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

function normalizeCategory(cat: string): 'TOP' | 'BOTTOM' | 'SHOES' | 'OUTERWEAR' | 'ACCESSORIES' {
  const c = (cat || '').toUpperCase().trim();
  if (c.startsWith('TOP')) return 'TOP';
  if (c.startsWith('BOTTOM')) return 'BOTTOM';
  if (c.startsWith('SHOE')) return 'SHOES';
  if (c.startsWith('OUTER')) return 'OUTERWEAR';
  return 'ACCESSORIES';
}

function matchesOccasion(item: ClothingItem, targetOccasion: string): boolean {
  if (!targetOccasion || targetOccasion === 'Casual') return true;
  const target = targetOccasion.toLowerCase();
  return (item.occasions || []).some((occ) => {
    const o = occ.toLowerCase();
    if (o === target) return true;
    if (target === 'office' && (o === 'work' || o === 'business')) return true;
    if (target === 'workout' && (o === 'sport' || o === 'athletic' || o === 'gym')) return true;
    return false;
  });
}

export function buildPackingChecklist(params: BuildPackingChecklistParams): Omit<PackingItem, 'id' | 'checked'>[] {
  const { startDate, endDate, occasion, packingMode, cleanWardrobeItems, avgTempF, weatherCondition } = params;
  const tripDays = daysBetween(startDate, endDate);
  const isCold = avgTempF !== undefined && avgTempF < 62;
  const isHot = avgTempF !== undefined && avgTempF > 82;
  const isRainy = weatherCondition ? weatherCondition.toLowerCase().includes('rain') : false;

  // Filter ONLY clean items from the wardrobe
  const cleanOnly = cleanWardrobeItems.filter((item) => (item.status || '').toLowerCase() === 'clean');

  // Separate clean wardrobe items by category
  const cleanTops = cleanOnly.filter((i) => normalizeCategory(i.category) === 'TOP');
  const cleanBottoms = cleanOnly.filter((i) => normalizeCategory(i.category) === 'BOTTOM');
  const cleanShoes = cleanOnly.filter((i) => normalizeCategory(i.category) === 'SHOES');
  const cleanOuterwear = cleanOnly.filter((i) => normalizeCategory(i.category) === 'OUTERWEAR');
  const cleanAccessories = cleanOnly.filter((i) => normalizeCategory(i.category) === 'ACCESSORIES');

  // Sort by occasion match first
  const sortFn = (a: ClothingItem, b: ClothingItem) => {
    const aMatch = matchesOccasion(a, occasion) ? 1 : 0;
    const bMatch = matchesOccasion(b, occasion) ? 1 : 0;
    return bMatch - aMatch;
  };

  cleanTops.sort(sortFn);
  cleanBottoms.sort(sortFn);
  cleanShoes.sort(sortFn);
  cleanOuterwear.sort(sortFn);
  cleanAccessories.sort(sortFn);

  // Determine quotas based on Light vs. Heavy packing mode & Trip Days
  const isLight = packingMode === 'light';
  const topsNeeded = isLight ? Math.max(1, Math.ceil(tripDays * 0.6)) : Math.max(2, tripDays + 1);
  const bottomsNeeded = isLight ? Math.max(1, Math.ceil(tripDays * 0.4)) : Math.max(2, Math.ceil(tripDays * 0.75));
  const shoesNeeded = isLight ? 1 : Math.min(3, Math.max(1, Math.ceil(tripDays * 0.3)));
  const outerwearNeeded = isCold ? (isLight ? 1 : 2) : (isLight ? 0 : 1);
  const accessoriesNeeded = isLight ? 1 : 2;

  const checklist: Omit<PackingItem, 'id' | 'checked'>[] = [];

  // 1. Pack Clean Tops
  for (let i = 0; i < topsNeeded; i++) {
    if (i < cleanTops.length) {
      const top = cleanTops[i];
      const colorTag = top.color || 'Neutral';
      checklist.push({
        label: `${top.name} · ${colorTag} (Clean Top)`,
        category: 'Clothing',
        wardrobeItemId: top.id,
        colorTag,
      });
    } else {
      checklist.push({
        label: `Clean Top #${i + 1} for ${occasion} (Wash laundry or add piece)`,
        category: 'Clothing',
        colorTag: 'Pending Wash',
      });
    }
  }

  // 2. Pack Clean Bottoms
  for (let i = 0; i < bottomsNeeded; i++) {
    if (i < cleanBottoms.length) {
      const bottom = cleanBottoms[i];
      const colorTag = bottom.color || 'Neutral';
      checklist.push({
        label: `${bottom.name} · ${colorTag} (Clean Bottom)`,
        category: 'Clothing',
        wardrobeItemId: bottom.id,
        colorTag,
      });
    } else {
      checklist.push({
        label: `Clean Bottom #${i + 1} for ${occasion} (Wash laundry or add piece)`,
        category: 'Clothing',
        colorTag: 'Pending Wash',
      });
    }
  }

  // 3. Pack Clean Outerwear
  for (let i = 0; i < outerwearNeeded; i++) {
    if (i < cleanOuterwear.length) {
      const outer = cleanOuterwear[i];
      const colorTag = outer.color || 'Neutral';
      checklist.push({
        label: `${outer.name} · ${colorTag} (Clean Outerwear)`,
        category: 'Clothing',
        wardrobeItemId: outer.id,
        colorTag,
      });
    } else if (isCold || !isLight) {
      checklist.push({
        label: isCold ? 'Warm Coat / Jacket (Clean Outerwear)' : 'Light Layer / Jacket',
        category: 'Clothing',
        colorTag: 'Layer',
      });
    }
  }

  // 4. Pack Clean Shoes / Footwear
  for (let i = 0; i < shoesNeeded; i++) {
    if (i < cleanShoes.length) {
      const shoe = cleanShoes[i];
      const colorTag = shoe.color || 'Neutral';
      checklist.push({
        label: `${shoe.name} · ${colorTag} (Clean Footwear)`,
        category: 'Footwear',
        wardrobeItemId: shoe.id,
        colorTag,
      });
    } else {
      checklist.push({
        label: i === 0 ? 'Comfortable Walking Shoes' : 'Dress / Backup Shoes',
        category: 'Footwear',
      });
    }
  }

  // 5. Pack Clean Accessories
  for (let i = 0; i < accessoriesNeeded; i++) {
    if (i < cleanAccessories.length) {
      const acc = cleanAccessories[i];
      const colorTag = acc.color || 'Neutral';
      checklist.push({
        label: `${acc.name} · ${colorTag} (Clean Accessory)`,
        category: 'Accessories',
        wardrobeItemId: acc.id,
        colorTag,
      });
    }
  }

  // Weather-specific wardrobe accessories
  if (isCold) {
    checklist.push({ label: 'Thermal Base Layer (Clean Garment)', category: 'Clothing', colorTag: 'Base Layer' });
    checklist.push({ label: 'Warm Scarf & Gloves (Clean Accessory)', category: 'Accessories', colorTag: 'Warmth' });
  }
  if (isHot) {
    checklist.push({ label: 'UV Sunglasses & Sun Hat (Clean Accessory)', category: 'Accessories', colorTag: 'Sun UV' });
  }
  if (isRainy) {
    checklist.push({ label: 'Compact Windproof Umbrella', category: 'Accessories', colorTag: 'Weather' });
  }

  // Underwear & Sleepwear essentials
  const underwearCount = isLight ? tripDays : tripDays + 2;
  checklist.push({ label: `${underwearCount} Pairs of Underwear & Socks`, category: 'Clothing' });
  checklist.push({ label: `${Math.max(1, Math.ceil(tripDays / 3))} Sleepwear Set`, category: 'Clothing' });

  // Minimal Essentials (Toiletries kit consolidated, no long generic lists)
  checklist.push({ label: 'Travel Toiletry & Grooming Kit', category: 'Essentials' });
  checklist.push({ label: 'Passport, Government ID & Chargers', category: 'Essentials' });

  return checklist;
}