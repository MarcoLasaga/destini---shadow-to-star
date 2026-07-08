import { GeneratedOutfit, OutfitClothingItem, ColorSwatch, WhyReasonDetail, FeedbackReview } from '../types';

export const OCCASION_OPTIONS = [
  'Any occasion',
  'Casual',
  'Work',
  'Formal',
  'Sport',
  'Date',
  'Party',
  'Travel',
  'Lounge',
] as const;

export const SURPRISE_BADGES = ['Trending', "Editor's Pick", 'Staff Favorite', 'Smart Match', 'Weekend Choice'];

const whyReasonPool: WhyReasonDetail[] = [
  { icon: 'sunny-outline', title: "Matches today's weather", description: 'Fabrics and layers suit current conditions.' },
  { icon: 'sparkles-outline', title: 'Fits your preferred style', description: 'Aligns with your saved style preferences.' },
  { icon: 'refresh-outline', title: 'Uses unworn pieces', description: "Includes items you haven't worn in the last 14 days." },
  { icon: 'color-palette-outline', title: 'Coordinates color palette', description: 'Neutral tones complement your favorite colors.' },
  { icon: 'leaf-outline', title: 'Boosts sustainability', description: 'Reuses existing clothing — no new purchases needed.' },
  { icon: 'pricetag-outline', title: 'Appropriate for the occasion', description: 'Selected pieces match your chosen occasion.' },
];

const feedbackPool: FeedbackReview[] = [
  { id: 'f1', stars: 5, quote: "Perfect for today's weather." },
  { id: 'f2', stars: 4, quote: 'Very comfortable for walking.' },
  { id: 'f3', stars: 5, quote: 'Loved the color combination.' },
  { id: 'f4', stars: 4, quote: 'Great for a full day out.' },
  { id: 'f5', stars: 5, quote: 'Very comfortable.' },
];

function pickFeedback(): FeedbackReview[] {
  const shuffled = [...feedbackPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

function pickWhyReasons(): WhyReasonDetail[] {
  const shuffled = [...whyReasonPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

export const swapPool: Record<OutfitClothingItem['category'], OutfitClothingItem[]> = {
  Top: [
    { id: 'top-1', name: 'White Oversized T-Shirt', category: 'Top', image: 'https://picsum.photos/seed/white-tshirt-outfit/200/200' },
    { id: 'top-2', name: 'Striped Button-Down', category: 'Top', image: 'https://picsum.photos/seed/striped-button-down/200/200' },
    { id: 'top-3', name: 'Gray Hoodie', category: 'Top', image: 'https://picsum.photos/seed/gray-hoodie-back/200/200' },
    { id: 'top-4', name: 'Black Turtleneck', category: 'Top', image: 'https://picsum.photos/seed/black-turtleneck/200/200' },
  ],
  Bottom: [
    { id: 'bottom-1', name: 'Light Blue Denim Jeans', category: 'Bottom', image: 'https://picsum.photos/seed/light-blue-denim/200/200' },
    { id: 'bottom-2', name: 'Khaki Chinos', category: 'Bottom', image: 'https://picsum.photos/seed/khaki-chino-pants/200/200' },
    { id: 'bottom-3', name: 'Dark Denim Jeans', category: 'Bottom', image: 'https://picsum.photos/seed/dark-denim-jeans/200/200' },
    { id: 'bottom-4', name: 'Black Tailored Trousers', category: 'Bottom', image: 'https://picsum.photos/seed/black-trousers/200/200' },
  ],
  Shoes: [
    { id: 'shoes-1', name: 'White Sneakers', category: 'Shoes', image: 'https://picsum.photos/seed/white-sneakers-outfit/200/200' },
    { id: 'shoes-2', name: 'Black Sneakers', category: 'Shoes', image: 'https://picsum.photos/seed/black-red-sneakers/200/200' },
    { id: 'shoes-3', name: 'Leather Loafers', category: 'Shoes', image: 'https://picsum.photos/seed/leather-loafers/200/200' },
  ],
  Accessory: [
    { id: 'acc-1', name: 'Silver Watch', category: 'Accessory', image: 'https://picsum.photos/seed/silver-wrist-watch/200/200' },
    { id: 'acc-2', name: 'Canvas Tote Bag', category: 'Accessory', image: 'https://picsum.photos/seed/canvas-tote-bag/200/200' },
    { id: 'acc-3', name: 'Red Wool Scarf', category: 'Accessory', image: 'https://picsum.photos/seed/red-wool-scarf/200/200' },
  ],
  Outerwear: [
    { id: 'outer-1', name: 'Navy Blue Suit Jacket', category: 'Outerwear', image: 'https://picsum.photos/seed/navy-blue-suit-jacket/200/200' },
    { id: 'outer-2', name: 'Light Blue Trench Coat', category: 'Outerwear', image: 'https://picsum.photos/seed/light-blue-trench/200/200' },
  ],
};

interface OutfitTemplate {
  occasion: string;
  name: string;
  image: string;
  weatherCondition: string;
  weatherTempF: number;
  location: string;
  clothingItems: OutfitClothingItem[];
  colorPalette: ColorSwatch[];
}

const templates: OutfitTemplate[] = [
  {
    occasion: 'Casual',
    name: 'Casual Campus Day',
    image: 'https://picsum.photos/seed/casual-campus-day/800/900',
    weatherCondition: 'Partly Cloudy',
    weatherTempF: 72,
    location: 'Quezon City, PH',
    clothingItems: [
      swapPool.Top[0],
      swapPool.Bottom[0],
      swapPool.Shoes[0],
      swapPool.Accessory[0],
      swapPool.Accessory[1],
    ],
    colorPalette: [
      { name: 'White', hex: '#F5F5F0' },
      { name: 'Blue', hex: '#4A78A8' },
      { name: 'Silver', hex: '#C7C7C7' },
    ],
  },
  {
    occasion: 'Work',
    name: 'Smart Office Day',
    image: 'https://picsum.photos/seed/smart-office-day/800/900',
    weatherCondition: 'Clear Sky',
    weatherTempF: 75,
    location: 'Quezon City, PH',
    clothingItems: [swapPool.Top[1], swapPool.Bottom[1], swapPool.Shoes[2], swapPool.Accessory[0]],
    colorPalette: [
      { name: 'Blue', hex: '#5A7FC1' },
      { name: 'Khaki', hex: '#C3A76B' },
      { name: 'Brown', hex: '#7A5C42' },
    ],
  },
  {
    occasion: 'Formal',
    name: 'Evening Formal Look',
    image: 'https://picsum.photos/seed/evening-formal-look/800/900',
    weatherCondition: 'Clear Sky',
    weatherTempF: 70,
    location: 'Quezon City, PH',
    clothingItems: [swapPool.Outerwear[0], swapPool.Bottom[3], swapPool.Shoes[2], swapPool.Accessory[0]],
    colorPalette: [
      { name: 'Navy', hex: '#2E3B5C' },
      { name: 'Black', hex: '#1B1B1F' },
      { name: 'Silver', hex: '#C7C7C7' },
    ],
  },
  {
    occasion: 'Sport',
    name: 'Active Training Fit',
    image: 'https://picsum.photos/seed/active-training-fit/800/900',
    weatherCondition: 'Sunny',
    weatherTempF: 84,
    location: 'Quezon City, PH',
    clothingItems: [swapPool.Top[2], swapPool.Bottom[0], swapPool.Shoes[1]],
    colorPalette: [
      { name: 'Gray', hex: '#8B8B93' },
      { name: 'Blue', hex: '#4A78A8' },
      { name: 'Black', hex: '#1B1B1F' },
    ],
  },
  {
    occasion: 'Date',
    name: 'Golden Hour Date Night',
    image: 'https://picsum.photos/seed/golden-hour-date/800/900',
    weatherCondition: 'Clear Sky',
    weatherTempF: 74,
    location: 'Quezon City, PH',
    clothingItems: [swapPool.Top[3], swapPool.Bottom[3], swapPool.Shoes[2], swapPool.Accessory[0]],
    colorPalette: [
      { name: 'Black', hex: '#1B1B1F' },
      { name: 'Silver', hex: '#C7C7C7' },
      { name: 'White', hex: '#F5F5F0' },
    ],
  },
  {
    occasion: 'Party',
    name: 'Weekend Party Style',
    image: 'https://picsum.photos/seed/weekend-party-style/800/900',
    weatherCondition: 'Partly Cloudy',
    weatherTempF: 76,
    location: 'Quezon City, PH',
    clothingItems: [swapPool.Top[1], swapPool.Bottom[2], swapPool.Shoes[1], swapPool.Accessory[2]],
    colorPalette: [
      { name: 'Red', hex: '#C0453F' },
      { name: 'Navy', hex: '#2E3B5C' },
      { name: 'White', hex: '#F5F5F0' },
    ],
  },
  {
    occasion: 'Travel',
    name: 'Milan Street Explorer',
    image: 'https://picsum.photos/seed/milan-street-explorer/800/900',
    weatherCondition: 'Cool Breeze',
    weatherTempF: 65,
    location: 'Milan, IT',
    clothingItems: [swapPool.Outerwear[1], swapPool.Bottom[1], swapPool.Shoes[0], swapPool.Accessory[1]],
    colorPalette: [
      { name: 'Light Blue', hex: '#A9C6DE' },
      { name: 'Pink', hex: '#E3B7C4' },
      { name: 'Khaki', hex: '#C3A76B' },
    ],
  },
  {
    occasion: 'Lounge',
    name: 'Cozy Weekend Lounge',
    image: 'https://picsum.photos/seed/cozy-weekend-lounge/800/900',
    weatherCondition: 'Overcast',
    weatherTempF: 68,
    location: 'Quezon City, PH',
    clothingItems: [swapPool.Top[2], swapPool.Bottom[0], swapPool.Shoes[0]],
    colorPalette: [
      { name: 'Gray', hex: '#8B8B93' },
      { name: 'Blue', hex: '#4A78A8' },
    ],
  },
];

export function generateOutfitId(): string {
  return `outfit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function buildOutfitFromTemplate(occasion: string): GeneratedOutfit {
  const pool = occasion === 'Any occasion' ? templates : templates.filter((t) => t.occasion === occasion);
  const template = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : templates[0];

  return {
    id: generateOutfitId(),
    name: template.name,
    occasionLabel: template.occasion,
    image: template.image,
    matchPercent: 82 + Math.floor(Math.random() * 15),
    sustainPercent: 70 + Math.floor(Math.random() * 25),
    comfortRating: parseFloat((4 + Math.random()).toFixed(1)),
    weatherCondition: template.weatherCondition,
    weatherTempF: template.weatherTempF,
    location: template.location,
    clothingItems: template.clothingItems,
    colorPalette: template.colorPalette,
    whyReasons: pickWhyReasons(),
    feedback: pickFeedback(),
    favorited: false,
    saved: false,
    worn: false,
  };
}

export function buildSurpriseOutfit(): GeneratedOutfit {
  const template = templates[Math.floor(Math.random() * templates.length)];
  const outfit = buildOutfitFromTemplate(template.occasion);
  outfit.badge = SURPRISE_BADGES[Math.floor(Math.random() * SURPRISE_BADGES.length)];
  return outfit;
}

export function remixOutfit(current: GeneratedOutfit): GeneratedOutfit {
  const categories: OutfitClothingItem['category'][] = ['Top', 'Bottom', 'Shoes', 'Accessory', 'Outerwear'];
  const remixedItems = current.clothingItems.map((item) => {
    const shouldSwap = Math.random() < 0.5;
    if (!shouldSwap) return item;
    const options = swapPool[item.category].filter((option) => option.id !== item.id);
    if (options.length === 0) return item;
    return options[Math.floor(Math.random() * options.length)];
  });

  return {
    ...current,
    id: generateOutfitId(),
    clothingItems: remixedItems,
    matchPercent: Math.max(75, Math.min(99, current.matchPercent + Math.floor(Math.random() * 11) - 5)),
    feedback: pickFeedback(),
    whyReasons: pickWhyReasons(),
    favorited: false,
    saved: false,
    worn: false,
    badge: undefined,
  };
}

const _unusedCategories: OutfitClothingItem['category'][] = ['Top', 'Bottom', 'Shoes', 'Accessory', 'Outerwear'];