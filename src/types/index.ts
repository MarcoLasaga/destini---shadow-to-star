export interface WeatherData {
  tempF: number;
  feelsLikeF: number;
  tempC?: number;
  feelsLikeC?: number;
  condition: string;
  humidity: number;
  windMph: number;
  windKmh?: number;
  location: string;
  tip: string;
  icon: 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  provider?: string;
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
  wardrobeItemId?: string;
  colorTag?: string;
}

export interface PackingTrip {
  id: string;
  destination: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  tripDays?: number;
  occasion?: string;
  packingMode?: 'light' | 'heavy';
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
  BatchAddClothes:
    | {
        initialAssets?: Array<{
          uri: string;
          width?: number;
          height?: number;
          fileName?: string | null;
        }>;
      }
    | undefined;
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
  Onboarding: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Wardrobe: undefined;
  Outfit: undefined;
  Community: undefined;
  Profile: undefined;
};

export type CommunityFeedMode = 'recent' | 'trending';

export type ClothingRole = 'Top' | 'Bottom' | 'Shoes' | 'Accessory' | 'Outerwear';

export type AnatomicalSlotType = 'innerTop' | 'outerLayer' | 'bottom' | 'shoes' | 'accessory';

export interface OutfitClothingItem {
  id: string;
  name: string;
  category: ClothingRole;
  image: string;
  color?: string;
  hexColor?: string;
  slotType?: AnatomicalSlotType;
  placementBadge?: string;
  layerNote?: string;
  status?: LaundryStatus;
  isSuggested?: boolean;
  suggestedLabel?: string;
}

export interface ColorSwatch {
  name: string;
  hex: string;
}

export interface WhyReasonDetail {
  id: string;
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
  matchPercent: number; // Hybrid Score (0-100)
  hybridScore?: number;
  contentScore?: number;
  collaborativeScore?: number;
  sustainPercent: number;
  comfortRating: number;
  weatherCondition: string | null;
  weatherTempF: number | null;
  location: string | null;
  clothingItems: OutfitClothingItem[];
  colorPalette: ColorSwatch[];
  colorHarmonyExplanation?: string;
  howToWearBullets?: string[];
  whyReasons: WhyReasonDetail[];
  feedback: FeedbackReview[];
  favorited: boolean;
  saved: boolean;
  worn: boolean;
  disliked?: boolean;
  wearNotes?: string;
  wearRating?: number;
}

export interface PlannedDayOutfit {
  date: string; // YYYY-MM-DD
  outfit: GeneratedOutfit;
  occasion: string;
  notes?: string;
  plannedAt: string;
}

export interface RecommendationStats {
  matchLabel: string;
  weatherLabel: string;
  styleLabel: string;
  sustainLabel: string;
  reuseLabel: string;
}
