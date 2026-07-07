import { WardrobeStats, AnalyticsPreview } from '../types';

export const mockUser = { name: 'Marco' };

export const mockWardrobeStats: WardrobeStats = { items: 8, favorites: 4, toWash: 8 };

export const mockAnalytics: AnalyticsPreview = {
  mostWorn: 'Blue Denim Jacket',
  leastWorn: 'Red Silk Scarf',
  weeklyWears: 12,
  monthlyWears: 46,
};

export const sustainabilityTips: string[] = [
  'Wearing an item 30 times reduces its carbon footprint by 50%. 🌱',
  'Wash clothes only when necessary to save water and energy. 💧',
  'Air dry garments instead of using a dryer to cut energy use. ☀️',
  'Donate clothes you no longer wear instead of throwing them away. 👕',
  'Repair small tears before replacing the whole item. 🧵',
  'Choose versatile pieces that mix and match with your wardrobe. ♻️',
  'Buying secondhand reduces textile waste in landfills. 🛍️',
  'Cold water washes use up to 90% less energy than hot washes. 🧺',
];

export function getRandomTip(): string {
  const index = Math.floor(Math.random() * sustainabilityTips.length);
  return sustainabilityTips[index];
}