import { GeneratedOutfit, OutfitClothingItem, ColorSwatch, WhyReasonDetail, FeedbackReview } from '../types';

export const OCCASION_OPTIONS = [
  'Any occasion',
  'Academic',
  'Office',
  'Formal',
  'Casual',
  'Workout',
] as const;

export const SURPRISE_BADGES = ['Trending', "Editor's Pick", 'Staff Favorite', 'Smart Match', 'Weekend Choice'];

const whyReasonPool: WhyReasonDetail[] = [
  { id: 'weather', icon: 'sunny-outline', title: "Matches today's weather", description: 'Fabrics and layers suit current conditions.' },
  { id: 'style', icon: 'sparkles-outline', title: 'Fits your preferred style', description: 'Aligns with your saved style preferences.' },
  { id: 'unworn', icon: 'refresh-outline', title: 'Uses unworn pieces', description: "Includes items you haven't worn in the last 14 days." },
  { id: 'palette', icon: 'color-palette-outline', title: 'Coordinates color palette', description: 'Neutral tones complement your favorite colors.' },
  { id: 'sustainability', icon: 'leaf-outline', title: 'Boosts sustainability', description: 'Reuses existing clothing — no new purchases needed.' },
  { id: 'occasion', icon: 'pricetag-outline', title: 'Appropriate for the occasion', description: 'Selected pieces match your chosen occasion.' },
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
      { name: 'Denim Blue', hex: '#4A6B82' },
      { name: 'Canvas Tan', hex: '#C4A482' },
    ],
  },
  {
    occasion: 'Office',
    name: 'Office Smart Casual',
    image: 'https://picsum.photos/seed/smart-casual-look/800/900',
    weatherCondition: 'Clear Sky',
    weatherTempF: 75,
    location: 'Makati, PH',
    clothingItems: [
      swapPool.Top[1],
      swapPool.Bottom[1],
      swapPool.Shoes[2],
      swapPool.Accessory[0],
    ],
    colorPalette: [
      { name: 'Sky Blue', hex: '#87CEEB' },
      { name: 'Khaki', hex: '#C3B091' },
      { name: 'Brown Leather', hex: '#8B4513' },
    ],
  },
  {
    occasion: 'Academic',
    name: 'Academic Lecture Ensemble',
    image: 'https://picsum.photos/seed/academic-lecture-ensemble/800/900',
    weatherCondition: 'Clear Sky',
    weatherTempF: 70,
    location: 'Quezon City, PH',
    clothingItems: [
      swapPool.Top[1],
      swapPool.Outerwear[0],
      swapPool.Bottom[3],
      swapPool.Shoes[2],
      swapPool.Accessory[0],
    ],
    colorPalette: [
      { name: 'Navy', hex: '#1B2A4A' },
      { name: 'Black', hex: '#1C1C1C' },
      { name: 'White', hex: '#FFFFFF' },
    ],
  },
  {
    occasion: 'Formal',
    name: 'Formal Evening',
    image: 'https://picsum.photos/seed/formal-suit-wear/800/900',
    weatherCondition: 'Clear Sky',
    weatherTempF: 70,
    location: 'BGC Taguig, PH',
    clothingItems: [
      swapPool.Outerwear[0],
      swapPool.Bottom[3],
      swapPool.Shoes[2],
      swapPool.Accessory[0],
    ],
    colorPalette: [
      { name: 'Navy', hex: '#1B2A4A' },
      { name: 'Charcoal', hex: '#333333' },
      { name: 'Silver', hex: '#C0C0C0' },
    ],
  },
  {
    occasion: 'Workout',
    name: 'Workout Activewear',
    image: 'https://picsum.photos/seed/athleisure-comfort-style/800/900',
    weatherCondition: 'Sunny',
    weatherTempF: 84,
    location: 'Pasig, PH',
    clothingItems: [
      swapPool.Top[2],
      swapPool.Bottom[0],
      swapPool.Shoes[1],
      swapPool.Accessory[1],
    ],
    colorPalette: [
      { name: 'Heather Gray', hex: '#9E9E9E' },
      { name: 'Black', hex: '#212121' },
      { name: 'Red Accent', hex: '#E53935' },
    ],
  },
];

export function getMockOutfitForOccasion(occasion: string, noNewClothesMode?: boolean): GeneratedOutfit {
  const match = templates.find((t) => t.occasion.toLowerCase() === occasion.toLowerCase()) ?? templates[0];
  const template = match;

  const hybridScore = 92;
  const contentScore = 90;
  const collaborativeScore = 94;

  return {
    id: `mock-${Date.now()}`,
    name: template.name,
    badge: 'Top Pick · Best Hybrid Match',
    occasionLabel: template.occasion,
    image: template.image,
    matchPercent: hybridScore,
    hybridScore,
    contentScore,
    collaborativeScore,
    sustainPercent: noNewClothesMode ? 100 : 88,
    comfortRating: 5,
    weatherCondition: template.weatherCondition,
    weatherTempF: template.weatherTempF,
    location: template.location,
    clothingItems: [...template.clothingItems],
    colorPalette: [...template.colorPalette],
    whyReasons: pickWhyReasons(),
    feedback: pickFeedback(),
    favorited: false,
    saved: false,
    worn: false,
  };
}
