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
    question: 'How do I add clothes to my Smart Wardrobe?',
    answer:
      'Tap the + button in the Wardrobe tab to snap a photo or batch-upload up to 15 garment photos at once. StyleSense automatically removes the background via remove.bg, classifies each piece into 5 categories and 33 subtypes using our fine-tuned ResNet-50 CNN, and extracts its dominant CIELAB (K = 2) color palette.',
  },
  {
    id: 'outfit-generator',
    question: 'How does the Outfit Generator work?',
    answer:
      'Select your Target Occasion, choose between My Wardrobe (your own clothes) or Mix & Match (blending your wardrobe with suggested catalog pieces), and tap Generate Outfits. Our Weighted Hybrid Recommender combines 55% Content-Based Filtering (CIELAB color harmony, style coherence, occasion dress code, and real-time OpenWeatherMap weather) with 45% Collaborative Filtering to rank your Top 3 outfits.',
  },
  {
    id: 'virtual-try-on',
    question: "How does 'See It On Me' Virtual Try-On work?",
    answer:
      "Tap 'See It On Me' on any recommended outfit and upload or capture a standing photo. StyleSense uses a 2-pass full-body diffusion pipeline (IDM-VTON) to visualize the recommended Top, Outerwear, Bottom, and Shoes directly on your photo. Your photo stays 100% private and is never shared publicly.",
  },
  {
    id: 'customize-outfit',
    question: 'How do I customize a recommended outfit?',
    answer:
      'Tap the Customize button on any recommended outfit to swap a garment slot with another item from your wardrobe or deselect optional layers like Outerwear or Accessories. Our mascot Mel recalculates your hybrid compatibility score in real time and explains how your swap affects the overall look before you tap Save Customized Outfit.',
  },
  {
    id: 'community-moderation',
    question: 'How does the Community Feed and AI Moderation work?',
    answer:
      'You can publish saved outfits to the Community Feed and like, save, repost, or follow other users. Your interactions help train the collaborative filtering engine, while automated 5-class NSFW image detection and bilingual (English and Tagalog) profanity filtering keep the community safe.',
  },
];
