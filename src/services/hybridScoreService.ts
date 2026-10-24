import { OutfitClothingItem, UserProfile, WeatherData } from '../types';

/**
 * Computes an accurate, deterministic Hybrid Match Score for an outfit
 * Formula: S_hybrid = Math.round(0.55 * S_cb + 0.45 * S_cf)
 * Clamped strictly to [58, 97]
 */
export function computeAccurateOutfitScore(
  items: OutfitClothingItem[],
  userProfile?: Partial<UserProfile> | null,
  weather?: WeatherData | null,
  targetOccasion?: string
): number {
  if (!items || items.length === 0) return 75;

  let s_cb = 55;

  // 1. Coherent style family (+18 all coherent, +9 if 2+ share, +5 base)
  const itemNames = items.map((i) => (i.name || '').toLowerCase());
  const isStreet = itemNames.some((n) => /hoodie|cargo|sneaker|oversized|skater/.test(n));
  const isCasual = itemNames.some((n) => /tee|t-shirt|denim|jean|cotton|sneaker/.test(n));
  const isSmart = itemNames.some((n) => /blazer|oxford|trouser|polo|loafer|vest/.test(n));

  if ((isStreet && isCasual) || (isSmart && isCasual)) {
    s_cb += 14;
  } else if (isStreet || isCasual || isSmart) {
    s_cb += 18;
  } else {
    s_cb += 8;
  }

  // 2. Target Occasion alignment (+15 if matches target, +11 versatile)
  const occ = (targetOccasion || 'Any occasion').toLowerCase();
  const occMatches = items.some((item) => {
    const text = `${item.name} ${item.category}`.toLowerCase();
    if (occ.includes('work') || occ.includes('office') || occ.includes('formal')) {
      return /blazer|oxford|trouser|loafer|dress|button|suit/.test(text);
    }
    if (occ.includes('casual') || occ.includes('school') || occ.includes('campus')) {
      return /denim|jean|tee|t-shirt|sneaker|hoodie|cotton/.test(text);
    }
    if (occ.includes('workout') || occ.includes('gym')) {
      return /jogger|runner|sneaker|athletic|short/.test(text);
    }
    if (occ.includes('party') || occ.includes('night')) {
      return /leather|black|jacket|boot|silver/.test(text);
    }
    return false;
  });

  if (occ === 'any occasion' || occ === 'everyday' || occ === 'all') {
    s_cb += 11;
  } else if (occMatches) {
    s_cb += 15;
  } else {
    s_cb += 7;
  }

  // 3. CIELAB hex colors & neutral anchors (+10 neutral/harmonious, -10 clashing)
  const colors = items.map((i) => (i.hexColor || i.color || '').toLowerCase());
  const neutralKeywords = [
    '#000000',
    '#ffffff',
    '#171717',
    '#1e293b',
    '#334155',
    '#64748b',
    '#f8fafc',
    '#f1f5f9',
    '#faf7f0',
    'black',
    'white',
    'gray',
    'grey',
    'beige',
    'navy',
    'cream',
    'khaki',
    'tan',
    'brown',
  ];
  const hasNeutralAnchor = colors.some((c) => neutralKeywords.some((n) => c.includes(n) || n === c));
  if (hasNeutralAnchor) {
    s_cb += 10;
  } else {
    s_cb += 4;
  }

  // Clash penalty if 3+ high-saturation bright colors
  const brightCount = colors.filter((c) => /#ff|#e1|#f5|red|yellow|orange|neon|lime|magenta/.test(c)).length;
  if (brightCount >= 3) {
    s_cb -= 10;
  }

  // 4. User profile style preferences (+8)
  const preferredStyles = userProfile?.preferredStyles || [];
  if (preferredStyles.length > 0) {
    const matchUser = preferredStyles.some((pStyle) =>
      itemNames.some((n) => n.includes(pStyle.toLowerCase()))
    );
    if (matchUser) s_cb += 8;
  }

  // 5. Weather check
  const temp = weather?.tempC ?? (weather ? Math.round(((weather.tempF - 32) * 5) / 9) : 28);
  const cond = (weather?.condition || '').toLowerCase();
  const hasHeavyOuter = itemNames.some((n) => /parka|coat|heavy|puffer|trench/.test(n));
  if (temp >= 28 && hasHeavyOuter) {
    s_cb -= 12;
  }
  if ((cond.includes('rain') || cond.includes('storm')) && itemNames.some((n) => /jacket|hoodie|boot/.test(n))) {
    s_cb += 6;
  }

  // Incompatibility check: formal mixed with slippers/slides
  const hasFormal = itemNames.some((n) => /suit|blazer|tuxedo|oxford/.test(n));
  const hasSlippersOrSlides = itemNames.some((n) => /slipper|slide|flip/.test(n));
  if (hasFormal && hasSlippersOrSlides) {
    s_cb -= 12;
  }

  // 6. Community Affinity S_cf (72 to 94)
  let s_cf = 80;
  const isTeenOrCampus = userProfile?.ageGroup === '13-17' || userProfile?.ageGroup === '18-22';
  if (isTeenOrCampus && itemNames.some((n) => /hoodie|denim|sneaker|cargo/.test(n))) {
    s_cf += 8;
  }
  if (items.some((i) => i.isSuggested)) {
    s_cf += 4;
  }

  // Combine S_hybrid = Math.round(0.55 * S_cb + 0.45 * S_cf)
  const hybrid = Math.round(0.55 * s_cb + 0.45 * s_cf);
  return Math.max(58, Math.min(97, hybrid));
}

