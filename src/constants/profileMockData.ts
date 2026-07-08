import { UserProfile, SavedOutfit, FaqItem } from '../types';

export const initialProfile: UserProfile = {
  firstName: 'Marco',
  lastName: 'Lasaga',
  displayName: 'Marco Lasaga',
  email: 'mamamobenten@gmail.com',
  memberSince: 'July 2026',
  avatarUri: null,
  clothingSize: 'M',
  preferredSize: 'M',
  location: 'Quezon City, PH',
};

export const savedOutfitsMock: SavedOutfit[] = [];

export const analyticsMock = {
  totalItems: 8,
  favorites: 4,
  wardrobeValue: 633,
  totalWears: 234,
  avgCostPerWear: 2.71,
  needsWashing: 7,
  sustainability: { score: 100, co2Reduced: 117.0, moneySaved: 585 },
  categories: [
    { label: 'Tops', value: 3, color: '#756E9E' },
    { label: 'Bottoms', value: 2, color: '#6FB1E8' },
    { label: 'Outerwear', value: 1, color: '#E88564' },
    { label: 'Accessories', value: 1, color: '#4FB894' },
    { label: 'Shoes', value: 1, color: '#FFD586' },
  ],
  topColors: [
    { label: 'gray', value: 100 },
    { label: 'navy', value: 100 },
    { label: 'blue', value: 58 },
    { label: 'black', value: 58 },
    { label: 'beige', value: 58 },
    { label: 'white', value: 58 },
  ],
  mostWorn: [
    { name: 'Silver Watch', wears: 60, image: 'https://picsum.photos/seed/silver-wrist-watch/100/100' },
    { name: 'Black Sneakers', wears: 48, image: 'https://picsum.photos/seed/black-red-sneakers/100/100' },
    { name: 'Dark Denim Jeans', wears: 35, image: 'https://picsum.photos/seed/dark-denim-jeans/100/100' },
    { name: 'White Cotton T-Shirt', wears: 24, image: 'https://picsum.photos/seed/white-cotton-tshirt/100/100' },
    { name: 'Gray Hoodie', wears: 22, image: 'https://picsum.photos/seed/gray-hoodie-back/100/100' },
  ],
  outfitsGenerated: 0,
};

export const cookbookMock = {
  wardrobeGaps: ['Add more tops for variety', 'You could use more bottoms', 'Add more shoe options'],
  suggestions: ['7 items need washing'],
  sustainabilityTips: [
    { icon: 'sync' as const, title: '30 Wears Rule', body: 'Before buying, ask: will I wear this at least 30 times?' },
    { icon: 'star' as const, title: 'Quality Over Quantity', body: 'Invest in well-made basics that last years' },
    { icon: 'basket' as const, title: 'Care for Your Clothes', body: 'Wash less, air dry, and follow care labels to extend life' },
    { icon: 'gift' as const, title: 'Swap & Donate', body: 'Exchange clothes with friends or donate unworn items' },
    { icon: 'locate' as const, title: 'Versatile Pieces', body: 'Choose items that work with multiple outfits' },
    { icon: 'cut' as const, title: 'Repair First', body: 'Fix buttons and small tears before replacing' },
  ],
};

export const faqData: FaqItem[] = [
  {
    id: 'add-clothes',
    question: 'How do I add clothes to my wardrobe?',
    answer:
      'Go to the Wardrobe tab and tap the "+" button. You can take a photo or upload from your gallery, then fill in the details.',
  },
  {
    id: 'outfit-generator',
    question: 'How does the outfit generator work?',
    answer:
      'The generator picks items from your clean wardrobe based on the season, weather, and occasion you choose. It avoids items that need washing.',
  },
  {
    id: 'sustainability-score',
    question: 'How is the sustainability score calculated?',
    answer:
      "It's based on how often you wear your clothes. More wears per item = higher score. We encourage wearing each item at least 30 times.",
  },
  {
    id: 'plan-outfits',
    question: 'Can I plan outfits for specific dates?',
    answer:
      'Yes. Use the Planner tab to assign outfits to dates. You can also view the weekly planner together with weather forecasts.',
  },
  {
    id: 'mark-worn',
    question: 'What happens when I mark an outfit as worn?',
    answer:
      "Each clothing item's wear count increases, the last worn date updates, and the clothing item gradually progresses toward its laundry threshold.",
  },
  {
    id: 'packing-assistant',
    question: 'How does the packing assistant work?',
    answer:
      'Enter your destination and travel dates. StyleSense suggests clothing from your wardrobe and automatically generates a packing checklist based on your trip.',
  },
];