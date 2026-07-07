export interface WeatherData {
  tempF: number;
  feelsLikeF: number;
  condition: string;
  humidity: number;
  windMph: number;
  location: string;
  tip: string;
  icon: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
}

export interface WardrobeStats {
  items: number;
  favorites: number;
  toWash: number;
}

export interface AnalyticsPreview {
  mostWorn: string;
  leastWorn: string;
  weeklyWears: number;
  monthlyWears: number;
}

export type LaundryStatus = 'clean' | 'needs-washing';

export interface WearLogEntry {
  date: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  category: string;
  color: string;
  brand: string;
  material: string;
  style: string;
  seasons: string[];
  occasions: string[];
  image: string;
  status: LaundryStatus;
  favorite: boolean;
  timesWorn: number;
  lastWorn: string;
  costPerWear: number;
  wearCountSinceWash: number;
  washThreshold: number;
  avgWearsPerMonth: number;
  sinceLast: string;
  wearHistory: WearLogEntry[];
  addedDate: string;
}

export type RootStackParamList = {
  MainTabs: undefined;
  Notifications: undefined;
  AddClothes: undefined;
  GenerateOutfit: undefined;
  PlanDay: undefined;
  PackTrip: undefined;
  Analytics: undefined;
  ClothingDetails: { id: string };
  EditClothing: { id: string };
};

export type MainTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Outfit: undefined;
  Discover: undefined;
  Planner: undefined;
  Profile: undefined;
};