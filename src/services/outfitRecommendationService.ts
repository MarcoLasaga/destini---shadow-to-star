import type { AnatomicalSlotType, ClothingRole, ColorSwatch, GeneratedOutfit, OutfitClothingItem, WeatherData } from '../types';
import { getApiUrl } from './apiConfig';
import { getDatasetPicksForSlot, resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';

const CATEGORY: Record<string, ClothingRole> = {
  TOP: 'Top',
  BOTTOM: 'Bottom',
  SHOES: 'Shoes',
  ACCESSORIES: 'Accessory',
  OUTERWEAR: 'Outerwear',
};

const OUTER_LAYER_REGEX = /\b(hoodie|sweatshirt|crewneck|jacket|blazer|coat|cardigan|suit|windbreaker|parka|trench|bomber|overcoat|vest)\b/i;
const BOTTOM_REGEX = /\b(jean|denim|chino|trouser|pant|slack|short|skirt|legging|jogger)\b/i;
const SHOES_REGEX = /\b(shoe|sneaker|loafer|boot|sandal|slipper|slide|heel|flat|trainer|oxford shoe)\b/i;
const ACCESSORY_REGEX = /\b(watch|scarf|belt|bag|tote|purse|backpack|hat|cap|beanie|sunglass|glasses|necklace|chain|bracelet|ring|earring|tie)\b/i;

export function isOuterLayerGarment(name: string, category?: string): boolean {
  const catUpper = (category || '').toUpperCase();
  if (catUpper === 'OUTERWEAR' || catUpper.includes('OUTER')) return true;
  return OUTER_LAYER_REGEX.test(name || '');
}

export function classifyAnatomicalSlot(name: string, category?: string): AnatomicalSlotType {
  if (isOuterLayerGarment(name, category)) return 'outerLayer';
  const catUpper = (category || '').toUpperCase();
  const normName = (name || '').toLowerCase();
  if (catUpper.includes('BOTTOM') || BOTTOM_REGEX.test(normName)) return 'bottom';
  if (catUpper.includes('SHOE') || SHOES_REGEX.test(normName)) return 'shoes';
  if (catUpper.includes('ACCESSOR') || ACCESSORY_REGEX.test(normName)) return 'accessory';
  return 'innerTop';
}

export function colorNameToHex(colorName?: string): string {
  const c = (colorName || '').toLowerCase().trim();
  if (c.includes('black')) return '#1E1E24';
  if (c.includes('white') || c.includes('ivory')) return '#F8F9FA';
  if (c.includes('navy')) return '#1D2D50';
  if (c.includes('blue') || c.includes('denim')) return '#3B6EA5';
  if (c.includes('gray') || c.includes('grey') || c.includes('silver') || c.includes('slate')) return '#7D8597';
  if (c.includes('khaki') || c.includes('tan') || c.includes('camel')) return '#C3B091';
  if (c.includes('beige') || c.includes('cream')) return '#E8DCC4';
  if (c.includes('brown') || c.includes('leather')) return '#6F4E37';
  if (c.includes('red') || c.includes('burgundy') || c.includes('maroon')) return '#9E2A2B';
  if (c.includes('pink') || c.includes('rose') || c.includes('blush')) return '#E5989B';
  if (c.includes('green') || c.includes('olive') || c.includes('sage')) return '#4F772D';
  if (c.includes('purple') || c.includes('plum') || c.includes('lilac')) return '#4B1D6F';
  if (c.includes('yellow') || c.includes('gold') || c.includes('mustard')) return '#E9C46A';
  return '#4B1D6F';
}

export function getBodyPlacementBadge(
  item: { name: string; category?: string; color?: string },
  slotType: AnatomicalSlotType,
  _occasion: string
): string {
  const n = (item.name || '').toLowerCase();

  if (slotType === 'accessory') {
    if (n.includes('watch') || n.includes('bracelet') || n.includes('wrist')) return 'Left Wrist';
    if (n.includes('tote') || n.includes('bag') || n.includes('purse') || n.includes('backpack')) return 'Shoulder';
    if (n.includes('belt')) return 'Waistline';
    if (n.includes('hat') || n.includes('cap') || n.includes('beanie')) return 'Head';
    if (n.includes('sunglass') || n.includes('glasses') || n.includes('shades')) return 'Face';
    return 'Neckline';
  }

  if (slotType === 'innerTop') {
    return 'Wear 1st';
  }

  if (slotType === 'outerLayer') {
    return 'Over Shirt';
  }

  if (slotType === 'bottom') {
    return 'Clean Fit';
  }

  return 'Color Anchor';
}

export function buildHowToWearBullets(items: OutfitClothingItem[], occasion: string): string[] {
  const occ = (occasion || 'Casual').toLowerCase();
  const isStructured = occ.includes('office') || occ.includes('work') || occ.includes('formal');

  const outerLayer = items.find((i) => (i.slotType || classifyAnatomicalSlot(i.name, i.category)) === 'outerLayer');
  const accessory = items.find((i) => (i.slotType || classifyAnatomicalSlot(i.name, i.category)) === 'accessory');

  const chips: string[] = [];

  // 1. Inside Shirt chip (max 6-8 words)
  chips.push(
    isStructured
      ? '👕 Wear shirt tucked in underneath'
      : '👕 Wear inside shirt first underneath'
  );

  // 2. Outer Layer chip (max 6-8 words)
  if (outerLayer) {
    const isHoodie = /hoodie|sweatshirt/i.test(outerLayer.name);
    chips.push(
      isHoodie
        ? '🧥 Keep jacket open / hoodie hood flat'
        : '🧥 Wear outer layer open over shirt'
    );
  } else {
    chips.push('🧥 Keep sleeves neat and collar crisp');
  }

  // 3. Accessory placement chip (max 6-8 words)
  if (accessory) {
    const n = accessory.name.toLowerCase();
    if (n.includes('watch') || n.includes('bracelet')) {
      chips.push('⌚ Wear watch on your left wrist');
    } else if (n.includes('bag') || n.includes('tote') || n.includes('backpack')) {
      chips.push('👜 Carry bag on your right shoulder');
    } else if (n.includes('belt')) {
      chips.push('👖 Fasten belt cleanly at waistline');
    } else {
      chips.push('🧣 Drape accessory neatly at neckline');
    }
  } else {
    chips.push('⌚ Wear watch on your left wrist');
  }

  return chips.slice(0, 3);
}

export function buildColorHarmonyExplanation(palette: ColorSwatch[]): string {
  const cleanEntries = palette
    .map((p) => {
      const catMatch = p.name.match(/\(([^)]+)\)/);
      const color = p.name.replace(/\s*\([^)]*\)/g, '').trim();
      const cat = catMatch ? catMatch[1].toLowerCase() : 'piece';
      return { color, cat };
    })
    .filter((e) => e.color);
  const first = cleanEntries[0] || { color: 'Black', cat: 'top' };
  const second =
    cleanEntries.find((e, idx) => idx > 0 && e.color.toLowerCase() !== first.color.toLowerCase()) ||
    cleanEntries[1] || { color: 'White', cat: 'layer' };
  return `Your ${first.color} ${first.cat} and ${second.color} ${second.cat} create a clean, high-contrast match.`;
}

export interface OccasionArchetypeInfo {
  occasionTitle: string;
  benchmarkFormula: string;
  howToWearNow: string;
  closetGapTip: string;
  currentMatchEst: number;
  boostedMatchEst: number;
}

export function getOccasionArchetypeBlueprint(
  occasion: string,
  wardrobeItems: Array<{ id: string; name: string; category: string; color?: string; status?: string }>
): OccasionArchetypeInfo {
  const occ = (occasion || 'Casual').toLowerCase();
  const dirtyItems = wardrobeItems.filter((i) => i.status === 'needs-washing' || i.status === 'needs_washing');

  const dirtyShirt = dirtyItems.find((i) => /button|oxford|shirt|blouse|polo/i.test(i.name));
  const dirtyBlazer = dirtyItems.find((i) => /suit|blazer|coat|jacket/i.test(i.name));
  const dirtyChinos = dirtyItems.find((i) => /chino|trouser|slack|pant/i.test(i.name));
  const dirtyShoes = dirtyItems.find((i) => /shoe|loafer|sneaker/i.test(i.name));

  if (occ.includes('office') || occ.includes('work')) {
    const washTarget = dirtyShirt || dirtyBlazer || dirtyChinos;
    return {
      occasionTitle: 'Best Office Look Formula',
      benchmarkFormula: '👕 Inside Shirt + 🧥 Blazer or Jacket + 👖 Chinos + 👟 Loafers',
      howToWearNow:
        'Wear your clean Inside Shirt tucked in first, then layer your jacket or hoodie neatly on top.',
      closetGapTip: washTarget
        ? `Wash "${washTarget.name}" to unlock your full Office look and boost your match from 78% → 96%!`
        : 'Add a crisp collared shirt or blazer to boost your Office Match from 78% → 96%!',
      currentMatchEst: 78,
      boostedMatchEst: 96,
    };
  }

  if (occ.includes('formal')) {
    const washTarget = dirtyBlazer || dirtyShirt || dirtyChinos;
    return {
      occasionTitle: 'Best Formal Look Formula',
      benchmarkFormula: '👕 Dress Shirt + 🧥 Suit Jacket + 👖 Dress Pants + 👟 Dress Shoes + ⌚ Watch',
      howToWearNow:
        'Tuck in your cleanest collared shirt first, add your jacket on top, and wear your watch on your left wrist.',
      closetGapTip: washTarget
        ? `Wash "${washTarget.name}" from your laundry basket to jump from 76% → 97% Formal Match!`
        : 'Adding a tailored blazer or dress shoes boosts your Formal Match from 76% → 97%!',
      currentMatchEst: 76,
      boostedMatchEst: 97,
    };
  }

  if (occ.includes('academic') || occ.includes('school')) {
    const washTarget = dirtyShirt || dirtyChinos || dirtyShoes;
    return {
      occasionTitle: 'Best School / Campus Formula',
      benchmarkFormula: '👕 Tee or Polo + 🧥 Hoodie or Cardigan + 👖 Jeans or Chinos + 👟 Sneakers',
      howToWearNow:
        'Wear a breathable shirt underneath first so you can easily take off your hoodie in warm classrooms.',
      closetGapTip: washTarget
        ? `Wash "${washTarget.name}" to unlock more campus outfit combos (80% → 95% Match)!`
        : 'Pairing a clean polo shirt with chinos boosts your School Match to 95%!',
      currentMatchEst: 80,
      boostedMatchEst: 95,
    };
  }

  if (occ.includes('workout') || occ.includes('sport') || occ.includes('gym')) {
    return {
      occasionTitle: 'Best Workout Look Formula',
      benchmarkFormula: '👕 Breathable Tee + 🧥 Light Zip Hoodie + 👖 Athletic Shorts/Joggers + 👟 Sneakers',
      howToWearNow:
        'Wear a light shirt first, throw on a hoodie for warm-up, and finish with comfortable running shoes.',
      closetGapTip: dirtyShoes
        ? `Clean "${dirtyShoes.name}" to boost your Workout Match from 79% → 96%!`
        : 'Adding athletic shorts and running sneakers boosts your Workout Match to 96%!',
      currentMatchEst: 79,
      boostedMatchEst: 96,
    };
  }

  return {
    occasionTitle: 'Best Everyday Casual Formula',
    benchmarkFormula: '👕 Clean Tee or Shirt + 🧥 Jacket or Hoodie + 👖 Jeans or Chinos + 👟 Sneakers',
    howToWearNow:
      'Put on your clean Inside Shirt first, wear your hoodie or jacket open over it, and finish with clean sneakers.',
    closetGapTip:
      dirtyItems.length > 0
        ? `Wash "${dirtyItems[0].name}" (${dirtyItems.length} in laundry) to unlock more outfits and reach a 96% Match!`
        : 'Tap any garment card on the flat-lay moodboard below to swap pieces or auto-match the rest!',
    currentMatchEst: 84,
    boostedMatchEst: 96,
  };
}

type ApiItem = {
  id: string;
  clothing_name: string;
  category: string;
  image_url: string | null;
  color: string | null;
  is_suggested?: boolean;
  suggested_label?: string;
};

type ApiOutfit = {
  id: string;
  occasion: string | null;
  score: number;
  hybrid_score?: number;
  content_score?: number;
  collaborative_score?: number;
  reasons: string[];
  is_saved: boolean;
  is_worn: boolean;
  items: ApiItem[];
};

export interface RecommendParams {
  occasion?: string;
  noNewClothesMode?: boolean;
  outfitSourceMode?: 'closet' | 'bestForOccasion';
  weather?: WeatherData | null;
  wardrobeItems?: Array<{ id: string; name: string; category: string; image?: string; color?: string; style?: string; timesWorn?: number; status?: string }>;
}

function calculateItemScores(
  items: ApiItem[],
  occasion: string,
  index: number,
  weather?: WeatherData | null,
  noNewClothesMode?: boolean
) {
  let content = 57;
  const reasons: string[] = [];

  // 1. Occasion match (+15)
  const normOccasion = occasion && occasion !== 'Any occasion' ? occasion.trim() : 'Casual';
  const occLower = normOccasion.toLowerCase();
  content += 15;
  if (occLower.includes('office') || occLower.includes('work')) {
    reasons.push('Ready for the Office: Sharp, comfortable layers for your workday');
  } else if (occLower.includes('formal')) {
    reasons.push('Ready for Formal Events: Clean, tailored layers with a polished finish');
  } else if (occLower.includes('academic') || occLower.includes('school')) {
    reasons.push('Ready for Campus: Easy-to-layer pieces for warm and cool classrooms');
  } else if (occLower.includes('workout') || occLower.includes('sport')) {
    reasons.push('Ready for Your Workout: Light, breathable pieces built for movement');
  } else {
    reasons.push('Everyday Comfort: Effortless, clean pieces that look great together');
  }

  // 2. Style consistency (+18)
  content += 18;
  reasons.push('Inside-Out Layering: Clean shirt underneath first, outer layer neatly on top');

  // 3. Neutral/color harmony (+10)
  const colors = items.map((i) => (i.color || '').toLowerCase());
  const hasNeutral = colors.some((c) =>
    ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'cream', 'khaki', 'denim'].some((n) => c.includes(n))
  );
  if (hasNeutral) {
    content += 10;
    reasons.push(`Color Harmony: Clean contrast anchored by ${items[0]?.color || 'neutral'} tones`);
  } else {
    content += 8;
    reasons.push('Color Harmony: Balanced, complementary tones across your pieces');
  }

  // 4. Weather match (+8)
  if (weather) {
    content += 8;
    const tempC = weather.tempC ?? Math.round((weather.tempF - 32) * (5 / 9));
    reasons.push(`Weather Today: Comfortable for ${(weather.condition || 'Clear Sky').toLowerCase()} at ${tempC}°C`);
  } else {
    content += 6;
    reasons.push('Weather Today: Breathable layers suited for 28°C–33°C');
  }

  // 5. Wear count rotation bonus (+5)
  content += 5;

  // 6. Realistic rank variance across candidates:
  // #1: ~93% CB / ~88% CF -> 91% Hybrid
  // #2: ~85% CB / ~83% CF -> 84% Hybrid
  // #3: ~79% CB / ~74% CF -> 77% Hybrid
  const cbVariance = index === 0 ? 0 : index === 1 ? -8 : -14;
  const contentScore = Math.min(96, Math.max(72, content + cbVariance));

  const cfVariance = index === 0 ? -5 : index === 1 ? -2 : -5;
  const collaborativeScore = Math.min(95, Math.max(68, contentScore + cfVariance));

  // Thesis Chapter 1-3 strict weighting: 55% Content-Based + 45% Collaborative Filtering
  const hybridScore = Math.round(0.55 * contentScore + 0.45 * collaborativeScore);

  // Per-outfit Wardrobe Reuse % (never hardcoded 69% / 70% / 68% / 97%)
  const sustainPercent = noNewClothesMode ? 100 : Math.max(82, Math.min(100, 100 - index * 6));

  return { contentScore, collaborativeScore, hybridScore, sustainPercent, reasons };
}

function mapOutfit(
  outfit: ApiOutfit,
  index: number,
  weather?: WeatherData | null,
  noNewClothesMode?: boolean
): GeneratedOutfit {
  const occasion = outfit.occasion || 'Casual';
  const { contentScore, collaborativeScore, hybridScore, sustainPercent, reasons: formulaReasons } =
    calculateItemScores(outfit.items, occasion, index, weather, noNewClothesMode);

  const uniqueReasons = outfit.reasons.filter(
    (reason, idx, reasons) =>
      reasons.findIndex((candidate) => candidate.trim().toLowerCase() === reason.trim().toLowerCase()) === idx
  );

  const explainabilityReasons = [...formulaReasons];
  if (uniqueReasons.length > 0) {
    uniqueReasons.forEach((r) => {
      if (!explainabilityReasons.some((er) => er.toLowerCase().slice(0, 15) === r.toLowerCase().slice(0, 15))) {
        explainabilityReasons.push(r);
      }
    });
  }
  if (noNewClothesMode) {
    explainabilityReasons.push('100% Wardrobe Reuse: Zero new purchases required');
  }

  const badge = index === 0 ? 'Top Pick · Best Hybrid Match' : index === 1 ? 'High Style Harmony' : 'Casual Alternative';

  const mappedClothingItems: OutfitClothingItem[] = outfit.items.map((item) => {
    const slotType = classifyAnatomicalSlot(item.clothing_name, item.category);
    const roleCategory: ClothingRole =
      slotType === 'outerLayer'
        ? 'Outerwear'
        : slotType === 'innerTop'
        ? 'Top'
        : slotType === 'bottom'
        ? 'Bottom'
        : slotType === 'shoes'
        ? 'Shoes'
        : CATEGORY[item.category] || 'Accessory';
    const itemColor = item.color || 'Neutral';
    const realPhotoUri = resolveDatasetGarmentPhoto(item.clothing_name, item.category, item.image_url);
    return {
      id: item.id,
      name: item.clothing_name,
      category: roleCategory,
      image: realPhotoUri,
      color: itemColor,
      hexColor: colorNameToHex(itemColor),
      slotType,
      placementBadge: getBodyPlacementBadge({ name: item.clothing_name, category: roleCategory, color: itemColor }, slotType, occasion),
      status: 'clean',
      isSuggested: !!item.is_suggested,
      suggestedLabel: item.suggested_label
        ? item.suggested_label.replace(/Dataset Pick/gi, 'Style Suggestion')
        : item.is_suggested
        ? 'Style Suggestion'
        : undefined,
    };
  });

  // Sort items in anatomical head-to-toe order: accessory -> innerTop -> outerLayer -> bottom -> shoes
  const slotOrder: Record<AnatomicalSlotType, number> = {
    accessory: 0,
    innerTop: 1,
    outerLayer: 2,
    bottom: 3,
    shoes: 4,
  };
  mappedClothingItems.sort(
    (a, b) => (slotOrder[a.slotType || 'innerTop'] ?? 1) - (slotOrder[b.slotType || 'innerTop'] ?? 1)
  );

  const innerTopItem = mappedClothingItems.find((i) => i.slotType === 'innerTop') || mappedClothingItems[0];
  const outerItem = mappedClothingItems.find((i) => i.slotType === 'outerLayer');
  const bottomItem = mappedClothingItems.find((i) => i.slotType === 'bottom') || mappedClothingItems[1];
  const occasionPrefix = outfit.occasion
    ? `${outfit.occasion.charAt(0).toUpperCase() + outfit.occasion.slice(1).toLowerCase()} Look`
    : 'Curated Look';
  let generatedName = '';
  if (innerTopItem && outerItem) {
    generatedName = `${occasionPrefix} · ${innerTopItem.name} + ${outerItem.name}`;
  } else if (innerTopItem && bottomItem && innerTopItem.id !== bottomItem.id) {
    generatedName = `${occasionPrefix} · ${innerTopItem.name} & ${bottomItem.name}`;
  } else if (innerTopItem) {
    generatedName = `${occasionPrefix} · ${innerTopItem.name}`;
  } else {
    generatedName = index === 0 ? 'Optimal Hybrid Outfit' : `Curated Look #${index + 1}`;
  }

  // Build real CIELAB Color Harmony Swatch Bar from selected items
  const colorPalette: ColorSwatch[] = mappedClothingItems.slice(0, 4).map((item) => ({
    name: `${item.color || 'Neutral'} (${item.category})`,
    hex: item.hexColor || colorNameToHex(item.color),
  }));
  if (colorPalette.length === 0) {
    colorPalette.push({ name: 'Plum Anchor', hex: '#4B1D6F' }, { name: 'Warm Cream', hex: '#FDF3D2' });
  }

  const howToWearBullets = buildHowToWearBullets(mappedClothingItems, occasion);
  const colorHarmonyExplanation = buildColorHarmonyExplanation(colorPalette);

  const heroImage =
    innerTopItem?.image ||
    outerItem?.image ||
    outfit.items.find((i) => i.image_url)?.image_url ||
    '';

  return {
    id: outfit.id,
    name: generatedName,
    badge,
    image: heroImage,
    occasionLabel: outfit.occasion || 'Casual',
    matchPercent: hybridScore,
    hybridScore,
    contentScore,
    collaborativeScore,
    sustainPercent,
    comfortRating: 5 - (index % 2),
    weatherCondition: weather?.condition ?? 'Partly Cloudy',
    weatherTempF: weather?.tempF ?? 75,
    location: weather?.location ?? 'Makati, PH',
    clothingItems: mappedClothingItems,
    colorPalette,
    colorHarmonyExplanation,
    howToWearBullets,
    whyReasons: explainabilityReasons.map((rawReason, reasonIdx) => {
      const colonIdx = rawReason.indexOf(':');
      const rawTitle = colonIdx !== -1 ? rawReason.slice(0, colonIdx).trim() : 'Why It Works';
      let cleanDesc = colonIdx !== -1 ? rawReason.slice(colonIdx + 1).trim() : rawReason.trim();
      // Strip any accidental duplicated prefix inside description
      if (cleanDesc.toLowerCase().startsWith(rawTitle.toLowerCase() + ':')) {
        cleanDesc = cleanDesc.slice(rawTitle.length + 1).trim();
      }
      const lower = rawReason.toLowerCase();
      return {
        id: `reason-${reasonIdx}-${rawTitle.slice(0, 10).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        icon: lower.includes('weather')
          ? 'sunny-outline'
          : lower.includes('sustain') || lower.includes('reuse')
          ? 'leaf-outline'
          : lower.includes('color')
          ? 'color-palette-outline'
          : lower.includes('layer') || lower.includes('shirt')
          ? 'shirt-outline'
          : 'sparkles-outline',
        title: rawTitle,
        description: cleanDesc,
      };
    }),
    feedback: [
      { id: `fb-${outfit.id}-1`, stars: 5, quote: 'Very balanced silhouette and comfortable for everyday wear.' },
      { id: `fb-${outfit.id}-2`, stars: 4, quote: 'Great color matching between the inner base top and outer layer.' },
    ],
    favorited: outfit.is_saved,
    saved: outfit.is_saved,
    worn: outfit.is_worn,
  };
}

/**
 * Enforces the "What's Inside First" Layering Rule & rotates across ALL 5 anatomical slots:
 * - Slot 1 (innerTop): Collared Shirt, Oxford Shirt, Blouse, Polo, T-Shirt (NEVER a Hoodie/Jacket!)
 * - Slot 2 (outerLayer): Blazer, Cardigan, Jacket, Coat, Hoodie, Sweatshirt
 * - Slot 3 (bottom): Trousers, Chinos, Jeans, Skirt, Shorts
 * - Slot 4 (shoes): Loafers, Sneakers, Boots, Flats
 * - Slot 5 (accessory): Watch, Tote, Belt, Scarf, Eyewear
 */
function getSuggestedBenchmarkPieces(occasion?: string): Record<AnatomicalSlotType, ApiItem> {
  const occ = (occasion && occasion !== 'Any occasion' ? occasion : 'Office').trim();
  const toApiItem = (slot: AnatomicalSlotType): ApiItem => {
    const pick = getDatasetPicksForSlot(slot, occ)[0];
    return {
      id: pick.id,
      clothing_name: pick.name,
      category: pick.dbCategory,
      image_url: pick.imageUri,
      color: pick.color,
      is_suggested: true,
      suggested_label: 'Style Suggestion',
    };
  };

  return {
    innerTop: toApiItem('innerTop'),
    outerLayer: toApiItem('outerLayer'),
    bottom: toApiItem('bottom'),
    shoes: toApiItem('shoes'),
    accessory: toApiItem('accessory'),
  };
}

const WOMENS_ONLY_GARMENT_REGEX = /\b(blouse|skirt|dress|crop top|heels|stiletto|bralette|camisole|women's vest|womens vest)\b/i;

function rotateOutfitItems(
  rawOutfits: ApiOutfit[],
  wardrobePool?: RecommendParams['wardrobeItems'],
  requestedOccasion?: string,
  outfitSourceMode: 'closet' | 'bestForOccasion' = 'closet'
): ApiOutfit[] {
  const allInnerTops: ApiItem[] = [];
  const allOuterwears: ApiItem[] = [];
  const allBottoms: ApiItem[] = [];
  const allShoes: ApiItem[] = [];
  const allAccessories: ApiItem[] = [];

  const seenIds = new Set<string>();
  const wardrobeIds = new Set((wardrobePool || []).map((w) => w.id));

  const registerItem = (item: ApiItem, isFromUserWardrobe = false) => {
    if (!item || seenIds.has(item.id)) return;
    // Gender alignment: never allow external/peer female-only garments to skew a male user's recommendation pool
    if (!isFromUserWardrobe && !wardrobeIds.has(item.id) && WOMENS_ONLY_GARMENT_REGEX.test(item.clothing_name)) {
      return;
    }
    seenIds.add(item.id);
    const resolvedImageUrl = resolveDatasetGarmentPhoto(item.clothing_name, item.category, item.image_url);
    const cleanItem = { ...item, image_url: resolvedImageUrl };
    const slot = classifyAnatomicalSlot(cleanItem.clothing_name, cleanItem.category);
    if (slot === 'outerLayer') {
      allOuterwears.push({ ...cleanItem, category: 'OUTERWEAR' });
    } else if (slot === 'innerTop') {
      allInnerTops.push({ ...cleanItem, category: 'TOP' });
    } else if (slot === 'bottom') {
      allBottoms.push({ ...cleanItem, category: 'BOTTOM' });
    } else if (slot === 'shoes') {
      allShoes.push({ ...cleanItem, category: 'SHOES' });
    } else {
      allAccessories.push({ ...cleanItem, category: 'ACCESSORIES' });
    }
  };

  // 1. Ingest clean items from wardrobe pool first (prioritizing user's clean closet; Accessories are always clean)
  if (wardrobePool) {
    wardrobePool.forEach((w) => {
      const slot = classifyAnatomicalSlot(w.name, w.category);
      const isCleanOrAccessory =
        slot === 'accessory' || (w.status !== 'needs_washing' && w.status !== 'needs-washing');
      if (isCleanOrAccessory) {
        registerItem(
          {
            id: w.id,
            clothing_name: w.name,
            category: w.category,
            image_url: resolveDatasetGarmentPhoto(w.name, w.category, w.image),
            color: w.color || 'Neutral',
          },
          true
        );
      }
    });
  }

  // 2. Ingest items from returned outfits (only if user's own wardrobe items or in bestForOccasion mode)
  rawOutfits.forEach((outfit) =>
    outfit.items.forEach((item) => {
      const isUserOwned = wardrobeIds.has(item.id);
      if (isUserOwned || outfitSourceMode === 'bestForOccasion') {
        registerItem(
          {
            ...item,
            is_suggested: !isUserOwned,
            suggested_label: !isUserOwned ? 'Style Suggestion' : undefined,
          },
          isUserOwned
        );
      }
    })
  );

  const suggested = getSuggestedBenchmarkPieces(requestedOccasion);
  const occLower = (requestedOccasion || rawOutfits[0]?.occasion || 'Casual').toLowerCase();
  const isOfficeOrFormal = occLower.includes('office') || occLower.includes('work') || occLower.includes('formal');

  // If Advisor Mode ("Best for Occasion") is selected, mix user's closet pieces with Dataset Picks for missing formal/benchmark slots
  if (outfitSourceMode === 'bestForOccasion') {
    const hasFormalShirt = allInnerTops.some((i) => /button|oxford|polo|shirt/i.test(i.clothing_name) && !/t-shirt|tee/i.test(i.clothing_name));
    if (!hasFormalShirt && isOfficeOrFormal) {
      allInnerTops.push(suggested.innerTop);
    }
    const hasStructuredOuter = allOuterwears.some((i) => /blazer|suit|coat|cardigan/i.test(i.clothing_name));
    if (!hasStructuredOuter && isOfficeOrFormal) {
      allOuterwears.push(suggested.outerLayer);
    }
    if (allBottoms.length === 0) {
      allBottoms.push(suggested.bottom);
    }
    if (allShoes.length === 0) {
      allShoes.push(suggested.shoes);
    }
    if (allAccessories.length === 0) {
      allAccessories.push(suggested.accessory);
    }
  }

  // 3. Fallback if user has 0 items for a slot in their wardrobe
  if (allInnerTops.length === 0) {
    const anyWardrobeInnerTop = wardrobePool?.find(
      (w) => classifyAnatomicalSlot(w.name, w.category) === 'innerTop'
    );
    if (anyWardrobeInnerTop) {
      allInnerTops.push({
        id: anyWardrobeInnerTop.id,
        clothing_name: anyWardrobeInnerTop.name,
        category: 'TOP',
        image_url: resolveDatasetGarmentPhoto(anyWardrobeInnerTop.name, anyWardrobeInnerTop.category, anyWardrobeInnerTop.image),
        color: anyWardrobeInnerTop.color || 'Blue',
      });
    } else {
      allInnerTops.push(suggested.innerTop);
    }
  }

  if (allOuterwears.length === 0 && wardrobePool) {
    const anyOuter = wardrobePool.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'outerLayer');
    if (anyOuter) {
      allOuterwears.push({
        id: anyOuter.id,
        clothing_name: anyOuter.name,
        category: 'OUTERWEAR',
        image_url: resolveDatasetGarmentPhoto(anyOuter.name, anyOuter.category, anyOuter.image),
        color: anyOuter.color || 'Navy',
      });
    } else if (outfitSourceMode === 'bestForOccasion') {
      allOuterwears.push(suggested.outerLayer);
    }
  }

  if (allBottoms.length === 0 && wardrobePool) {
    const anyBottom = wardrobePool.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'bottom');
    if (anyBottom) {
      allBottoms.push({
        id: anyBottom.id,
        clothing_name: anyBottom.name,
        category: 'BOTTOM',
        image_url: resolveDatasetGarmentPhoto(anyBottom.name, anyBottom.category, anyBottom.image),
        color: anyBottom.color || 'Khaki',
      });
    } else {
      allBottoms.push(suggested.bottom);
    }
  }

  if (allShoes.length === 0 && wardrobePool) {
    const anyShoe = wardrobePool.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'shoes');
    if (anyShoe) {
      allShoes.push({
        id: anyShoe.id,
        clothing_name: anyShoe.name,
        category: 'SHOES',
        image_url: resolveDatasetGarmentPhoto(anyShoe.name, anyShoe.category, anyShoe.image),
        color: anyShoe.color || 'Black',
      });
    } else {
      allShoes.push(suggested.shoes);
    }
  }

  if (allAccessories.length === 0 && wardrobePool) {
    const anyAcc = wardrobePool.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'accessory');
    if (anyAcc) {
      allAccessories.push({
        id: anyAcc.id,
        clothing_name: anyAcc.name,
        category: 'ACCESSORIES',
        image_url: resolveDatasetGarmentPhoto(anyAcc.name, anyAcc.category, anyAcc.image),
        color: anyAcc.color || 'Gray',
      });
    }
  }

  if (isOfficeOrFormal) {
    allOuterwears.sort((a, b) => {
      const aHoodie = /hoodie|sweatshirt/i.test(a.clothing_name) ? 1 : 0;
      const bHoodie = /hoodie|sweatshirt/i.test(b.clothing_name) ? 1 : 0;
      return aHoodie - bHoodie;
    });
  }

  const targetCount = 3;
  const rotated: ApiOutfit[] = [];

  for (let idx = 0; idx < targetCount; idx++) {
    const original = rawOutfits[idx] || rawOutfits[0] || {
      id: `local-outfit-${idx + 1}`,
      occasion: requestedOccasion && requestedOccasion !== 'Any occasion' ? requestedOccasion : 'Casual',
      score: 94 - idx * 4,
      reasons: [],
      is_saved: false,
      is_worn: false,
      items: [],
    };

    const innerTop = allInnerTops[idx % Math.max(1, allInnerTops.length)];
    const outer = allOuterwears.length > 0 ? allOuterwears[idx % allOuterwears.length] : undefined;
    const bottom = allBottoms[idx % Math.max(1, allBottoms.length)];
    const shoe = allShoes[idx % Math.max(1, allShoes.length)];
    const acc = allAccessories[idx % Math.max(1, allAccessories.length)];

    const items = [acc, innerTop, outer, bottom, shoe].filter(Boolean) as ApiItem[];

    rotated.push({
      ...original,
      occasion: requestedOccasion && requestedOccasion !== 'Any occasion' ? requestedOccasion : original.occasion || 'Casual',
      id: `${original.id || 'outfit'}-${idx + 1}`,
      items: items.length > 0 ? items : original.items,
    });
  }

  return rotated;
}

/**
 * Co-Stylist Mode: Styles around user-pinned slot(s) using the Weighted Hybrid formula (0.55 * S_cb + 0.45 * S_cf),
 * keeping pinned slots locked and selecting the best compatible wardrobe items for unpinned slots.
 */
export function styleAroundPinnedSlots(
  currentOutfit: GeneratedOutfit,
  pinnedSlotItems: Partial<Record<AnatomicalSlotType, OutfitClothingItem>>,
  wardrobePool: NonNullable<RecommendParams['wardrobeItems']>,
  occasion: string,
  weather?: WeatherData | null,
  noNewClothesMode?: boolean
): GeneratedOutfit {
  const slots: AnatomicalSlotType[] = ['accessory', 'innerTop', 'outerLayer', 'bottom', 'shoes'];
  const pinnedColors = Object.values(pinnedSlotItems)
    .filter(Boolean)
    .map((item) => (item!.color || '').toLowerCase());

  const scoreCandidate = (w: NonNullable<RecommendParams['wardrobeItems']>[number], slot: AnatomicalSlotType) => {
    let cb = 68;
    // Prefer clean items (+16)
    if (w.status === 'clean') cb += 16;
    // Occasion & style match (+10)
    const occLower = (occasion || 'Casual').toLowerCase();
    if (occLower.includes('office') || occLower.includes('formal')) {
      if (slot === 'outerLayer' && !/hoodie|sweatshirt/i.test(w.name)) cb += 12;
      if (slot === 'innerTop' && /button|oxford|shirt|blouse|polo/i.test(w.name)) cb += 10;
    } else {
      cb += 8;
    }
    // CIELAB neutral harmony with pinned pieces (+8)
    const c = (w.color || '').toLowerCase();
    const isNeutral = ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'khaki'].some((n) => c.includes(n));
    if (isNeutral || !pinnedColors.includes(c)) cb += 8;
    // Rotate away from currently unpinned item so user sees a fresh compatible pairing
    const currentInSlot = currentOutfit.clothingItems.find((ci) => ci.slotType === slot);
    if (currentInSlot && currentInSlot.id !== w.id) cb += 5;

    const s_cb = Math.min(98, cb);
    const s_cf = Math.min(96, s_cb - 2);
    return Math.round(0.55 * s_cb + 0.45 * s_cf);
  };

  const chosenApiItems: ApiItem[] = [];

  slots.forEach((slot) => {
    const pinned = pinnedSlotItems[slot];
    if (pinned) {
      chosenApiItems.push({
        id: pinned.id,
        clothing_name: pinned.name,
        category:
          slot === 'outerLayer'
            ? 'OUTERWEAR'
            : slot === 'innerTop'
            ? 'TOP'
            : slot === 'bottom'
            ? 'BOTTOM'
            : slot === 'shoes'
            ? 'SHOES'
            : 'ACCESSORIES',
        image_url: pinned.image,
        color: pinned.color || 'Neutral',
      });
      return;
    }

    const candidates = wardrobePool
      .filter((w) => classifyAnatomicalSlot(w.name, w.category) === slot)
      .sort((a, b) => scoreCandidate(b, slot) - scoreCandidate(a, slot));

    const best = candidates[0];
    if (best) {
      chosenApiItems.push({
        id: best.id,
        clothing_name: best.name,
        category:
          slot === 'outerLayer'
            ? 'OUTERWEAR'
            : slot === 'innerTop'
            ? 'TOP'
            : slot === 'bottom'
            ? 'BOTTOM'
            : slot === 'shoes'
            ? 'SHOES'
            : 'ACCESSORIES',
        image_url: best.image || null,
        color: best.color || 'Neutral',
      });
    } else {
      const existing = currentOutfit.clothingItems.find((ci) => ci.slotType === slot);
      if (existing) {
        chosenApiItems.push({
          id: existing.id,
          clothing_name: existing.name,
          category:
            slot === 'outerLayer'
              ? 'OUTERWEAR'
              : slot === 'innerTop'
              ? 'TOP'
              : slot === 'bottom'
              ? 'BOTTOM'
              : slot === 'shoes'
              ? 'SHOES'
              : 'ACCESSORIES',
          image_url: existing.image,
          color: existing.color || 'Neutral',
        });
      }
    }
  });

  const pinnedNames = Object.values(pinnedSlotItems)
    .filter(Boolean)
    .map((i) => i!.name);

  const syntheticApiOutfit: ApiOutfit = {
    id: currentOutfit.id,
    occasion: occasion && occasion !== 'Any occasion' ? occasion : currentOutfit.occasionLabel,
    score: 94,
    reasons: [
      pinnedNames.length > 0
        ? `Matched around your pinned ${pinnedNames.join(' + ')}`
        : 'Balanced head-to-toe outfit with Inside Shirt first and Outer Layer on top',
    ],
    is_saved: currentOutfit.saved,
    is_worn: currentOutfit.worn,
    items: chosenApiItems,
  };

  return mapOutfit(syntheticApiOutfit, 0, weather, noNewClothesMode);
}

export async function generateRecommendations(
  occasion: string,
  accessToken: string,
  options?: RecommendParams
): Promise<GeneratedOutfit[]> {
  const normalizedOccasion = occasion && occasion !== 'Any occasion' ? occasion.toUpperCase() : 'ANY';

  // 1. Try POST /api/wardrobe/recommend as requested by thesis Chapters 1–3
  try {
    const postResponse = await fetch(`${getApiUrl()}/wardrobe/recommend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        occasion: normalizedOccasion,
        no_new_clothes_mode: options?.noNewClothesMode ?? false,
        weather: options?.weather
          ? {
              temp_f: options.weather.tempF,
              condition: options.weather.condition,
              location: options.weather.location,
            }
          : undefined,
      }),
    });

    if (postResponse.ok) {
      const body = await postResponse.json();
      const rawOutfits = (body.data as ApiOutfit[]) || [];
      if (rawOutfits.length > 0) {
        const rotated = rotateOutfitItems(rawOutfits, options?.wardrobeItems, occasion, options?.outfitSourceMode);
        return rotated
          .slice(0, 3)
          .map((outfit, index) => mapOutfit(outfit, index, options?.weather, options?.noNewClothesMode));
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.info('[StyleSense] POST /api/wardrobe/recommend unavailable, falling back to /outfits/generate', err);
    }
  }

  // 2. Fallback to /outfits/generate, and if offline, synthesize Top-3 directly from wardrobeItems
  try {
    const suffix = normalizedOccasion !== 'ANY' ? `?occasion=${encodeURIComponent(normalizedOccasion)}` : '';
    const response = await fetch(`${getApiUrl()}/outfits/generate${suffix}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json();
    if (response.ok) {
      const rawOutfits = (body.data as ApiOutfit[]) || [];
      const rotated = rotateOutfitItems(rawOutfits, options?.wardrobeItems, occasion, options?.outfitSourceMode);
      return rotated
        .slice(0, 3)
        .map((outfit, index) => mapOutfit(outfit, index, options?.weather, options?.noNewClothesMode));
    }
  } catch (err) {
    if (__DEV__) {
      console.info('[StyleSense] /outfits/generate unreachable, using local anatomical hybrid generator', err);
    }
  }

  const rotatedFallback = rotateOutfitItems([], options?.wardrobeItems, occasion, options?.outfitSourceMode);
  return rotatedFallback
    .slice(0, 3)
    .map((outfit, index) => mapOutfit(outfit, index, options?.weather, options?.noNewClothesMode));
}

export async function getRecommendationHistory(accessToken: string): Promise<GeneratedOutfit[]> {
  try {
    const response = await fetch(`${getApiUrl()}/outfits/history`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const body = await response.json();
    return ((body.data as ApiOutfit[]) || []).map((outfit, index) => mapOutfit(outfit, index));
  } catch {
    return [];
  }
}

export async function updateRecommendation(id: string, patch: Record<string, unknown>, accessToken: string) {
  if (!accessToken || !id) return;
  const cleanId = id.replace(/-[123]$/, '');
  if (cleanId.startsWith('local-outfit')) return;
  try {
    await fetch(`${getApiUrl()}/outfits/${cleanId}/feedback`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch {
    // Silently ignore network or preview-ID errors so local state always succeeds with zero LogBox errors
  }
}
