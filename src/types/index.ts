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

export interface UserProfile {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  memberSince: string;
  avatarUri: string | null;
  clothingSize: string;
  preferredSize: string;
  location: string;
}

export interface SavedOutfit {
  id: string;
  name: string;
  occasion: string;
  image: string;
  itemCount: number;
  createdDate: string;
}

export interface PackingItem {
  id: string;
  label: string;
  category: 'Clothing' | 'Footwear' | 'Accessories' | 'Toiletries' | 'Essentials';
  checked: boolean;
}

export interface PackingTrip {
  id: string;
  destination: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  checklist: PackingItem[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface NotificationPrefs {
  all: boolean;
  laundryReminders: boolean;
  outfitReminders: boolean;
  weatherAlerts: boolean;
  sustainabilityTips: boolean;
}

export type RootStackParamList = {
  MainTabs: undefined;
  Notifications: undefined;
  AddClothes: undefined;
  GenerateOutfit: undefined;
  PlanDay: undefined;
  ClothingDetails: { id: string };
  EditClothing: { id: string };
  EditProfile: undefined;
  SavedOutfits: undefined;
  Analytics: undefined;
  Cookbook: undefined;
  Packing: undefined;
  PackingTripDetail: { tripId: string };
  Settings: undefined;
  Help: undefined;
  OutfitDetails: { outfitId: string };
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Outfit: undefined;
  Discover: undefined;
  Planner: undefined;
  Profile: undefined;
};

export type ClothingRole = 'Top' | 'Bottom' | 'Shoes' | 'Accessory' | 'Outerwear';

export interface OutfitClothingItem {
  id: string;
  name: string;
  category: ClothingRole;
  image: string;
}

export interface ColorSwatch {
  name: string;
  hex: string;
}

export interface WhyReasonDetail {
  icon: string;
  title: string;
  description: string;
}

export interface FeedbackReview {
  id: string;
  stars: number;
  quote: string;
}

export interface GeneratedOutfit {
  id: string;
  name: string;
  occasionLabel: string;
  badge?: string;
  image: string;
  matchPercent: number;
  sustainPercent: number;
  comfortRating: number;
  weatherCondition: string;
  weatherTempF: number;
  location: string;
  clothingItems: OutfitClothingItem[];
  colorPalette: ColorSwatch[];
  whyReasons: WhyReasonDetail[];
  feedback: FeedbackReview[];
  favorited: boolean;
  saved: boolean;
  worn: boolean;
  wearNotes?: string;
  wearRating?: number;
}

export interface RecommendationStats {
  matchLabel: string;
  weatherLabel: string;
  styleLabel: string;
  sustainLabel: string;
  reuseLabel: string;
}