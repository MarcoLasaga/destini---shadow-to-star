import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { OutfitClothingItem, UserProfile } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { adjustColor } from '../utils/garmentImageHelper';

export type MannequinSlot = 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES';

interface Mannequin2DProps {
  profile?: Partial<UserProfile> | null;
  items?: OutfitClothingItem[];
  activeSlot?: MannequinSlot | null;
  onSelectSlot?: (slot: MannequinSlot) => void;
  compact?: boolean;
  staticPreview?: boolean;
  skinTone?: string;
  hairStyle?: string;
  hairColor?: string;
  faceStyle?: string;
  zoomMode?: 'head' | 'body';
  viewBoxOverride?: string;
  occasionScene?: string;
}

const SLOT_LABELS: Record<MannequinSlot, string> = {
  TOP: 'Inner Top',
  OUTERWEAR: 'Outerwear',
  BOTTOM: 'Bottom',
  SHOES: 'Shoes',
  ACCESSORIES: 'Accessory',
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const COLOR_NAME_MAP: Record<string, string> = {
  white: '#F5F5F0',
  black: '#1E2022',
  brown: '#6E473B',
  khaki: '#C8B696',
  beige: '#C8B696',
  navy: '#1E2F4D',
  blue: '#3B6EA5',
  gray: '#7D8491',
  grey: '#7D8491',
  cream: '#F3E9D2',
  olive: '#4A5D4E',
  green: '#4A5D4E',
  red: '#7A2832',
  burgundy: '#7A2832',
  pink: '#E899B5',
  yellow: '#E6C657',
  orange: '#E07A5F',
  purple: '#6B4C82',
  tan: '#D2B48C',
  denim: '#3D5A80',
  charcoal: '#333740',
};

/**
 * Resolves garment color with comprehensive name-to-hex mapping.
 * Checks item.hexColor, item.primaryColor, item.color, and keywords in item.name.
 * Fixes white garments rendering as purple!
 */
export function resolveGarmentHex(item?: OutfitClothingItem | null, fallback = '#F5F5F0'): string {
  if (!item) return fallback;

  // 1. Check direct hex values if valid hex
  const rawHex = (item.hexColor || '').trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawHex)) {
    return rawHex;
  }

  // 2. Check primaryColor / color properties against known color names
  const colorProp = (item.primaryColor || item.color || '').toLowerCase().trim();
  if (colorProp) {
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(colorProp)) {
      return colorProp;
    }
    for (const [name, hex] of Object.entries(COLOR_NAME_MAP)) {
      if (colorProp.includes(name)) return hex;
    }
  }

  // 3. Scan item.name for explicit color keywords (e.g. "White Jacket & White Jeans")
  const nameLower = (item.name || '').toLowerCase();
  for (const [name, hex] of Object.entries(COLOR_NAME_MAP)) {
    // word boundary regex
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(nameLower)) return hex;
  }

  // 4. Fallback if valid hex or default
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(fallback)) {
    return fallback;
  }
  return '#F5F5F0';
}

function isWhiteOrLight(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 215;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 215;
  }
  return false;
}

const slotForItem = (item: OutfitClothingItem): MannequinSlot => {
  if (item.slotType === 'outerLayer') return 'OUTERWEAR';
  if (item.slotType === 'bottom') return 'BOTTOM';
  if (item.slotType === 'shoes') return 'SHOES';
  if (item.slotType === 'accessory') return 'ACCESSORIES';
  const name = (item.name || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  if (/hoodie|jacket|blazer|coat|cardigan|sweatshirt|crewneck|vest|bomber|parka/.test(name) || cat === 'outerwear') {
    return 'OUTERWEAR';
  }
  if (/jean|denim|pant|trouser|chino|short|skirt|cargo/.test(name) || cat === 'bottom') {
    return 'BOTTOM';
  }
  if (/shoe|sneaker|boot|loafer|sandal|slipper|heel|flat/.test(name) || cat === 'shoes') {
    return 'SHOES';
  }
  if (/watch|sunglass|glasses|belt|bag|tote|necklace|chain|airpod/.test(name) || cat === 'accessory' || cat === 'accessories') {
    return 'ACCESSORIES';
  }
  return 'TOP';
};

export default function Mannequin2D({
  profile,
  items = [],
  activeSlot,
  onSelectSlot,
  compact = false,
  staticPreview = false,
  skinTone: propSkinTone,
  hairStyle: propHairStyle,
  hairColor: propHairColor,
  faceStyle: propFaceStyle,
  zoomMode = 'body',
  viewBoxOverride,
  occasionScene,
}: Mannequin2DProps) {
  const settings = useSettings();

  // Gender & Anatomy
  const gender = profile?.gender === 'female' ? 'female' : 'male';
  const heightCm = Number(profile?.heightCm) || 168;
  const weightKg = Number(profile?.weightKg) || 62;
  const fitPref = (profile?.fitPreference || 'regular').toLowerCase();
  const isBaggy = fitPref.includes('baggy') || fitPref.includes('oversized');
  const isSlim = fitPref.includes('slim') || fitPref.includes('tailored');

  const heightScale = clamp(heightCm / 168, 0.90, 1.10);
  const widthScale = clamp((weightKg / 62) * (isBaggy ? 1.10 : isSlim ? 0.92 : 1.0), 0.88, 1.18);

  // Character Attributes with Settings / Profile Fallbacks
  const resolvedSkinTone = useMemo(() => {
    const raw = (propSkinTone || (profile as any)?.skinTone || settings.mannequinSkinTone || '').trim();
    if (
      !raw ||
      raw === '#B7D69C' ||
      raw === '#A8D5A2' ||
      raw.toLowerCase().includes('d69c') ||
      raw.toLowerCase().includes('d5a2')
    ) {
      return '#F1CBA9'; // Warm Asian ivory/beige default
    }
    return raw;
  }, [propSkinTone, (profile as any)?.skinTone, settings.mannequinSkinTone]);

  const resolvedHairStyle = useMemo(() => {
    const raw = propHairStyle || (profile as any)?.hairStyle || settings.hairStyle;
    if (raw) return raw;
    return gender === 'female' ? 'female_long_tucked' : 'male_twoblock';
  }, [propHairStyle, (profile as any)?.hairStyle, settings.hairStyle, gender]);

  const resolvedHairColor = useMemo(() => {
    return propHairColor || (profile as any)?.hairColor || settings.hairColor || '#1C1613';
  }, [propHairColor, (profile as any)?.hairColor, settings.hairColor]);

  const resolvedFaceStyle = useMemo(() => {
    return propFaceStyle || (profile as any)?.faceStyle || settings.faceStyle || 'friendly';
  }, [propFaceStyle, (profile as any)?.faceStyle, settings.faceStyle]);

  const skinShade = useMemo(() => adjustColor(resolvedSkinTone, -16), [resolvedSkinTone]);
  const skinHighlight = useMemo(() => adjustColor(resolvedSkinTone, 14), [resolvedSkinTone]);
  const hairShade = useMemo(() => adjustColor(resolvedHairColor, -22), [resolvedHairColor]);
  const hairHighlight = useMemo(() => adjustColor(resolvedHairColor, 18), [resolvedHairColor]);

  // Group garments by slot
  const bySlot = useMemo(() => {
    const map: Partial<Record<MannequinSlot, OutfitClothingItem>> = {};
    for (const item of items) {
      if (item && item.name) {
        const slot = slotForItem(item);
        if (!map[slot]) {
          map[slot] = item;
        }
      }
    }
    return map;
  }, [items]);

  const topItem = bySlot.TOP ?? null;
  const outerItem = bySlot.OUTERWEAR ?? null;
  const bottomItem = bySlot.BOTTOM ?? null;
  const shoesItem = bySlot.SHOES ?? null;
  const accessoryItem = bySlot.ACCESSORIES ?? null;

  // Garment names and color resolution
  const topColor = resolveGarmentHex(topItem, '#F5F5F0');
  const outerColor = resolveGarmentHex(outerItem, '#2D3A45');
  const bottomColor = resolveGarmentHex(bottomItem, '#23395B');
  const shoesColor = resolveGarmentHex(shoesItem, '#FFFFFF');
  const accColor = resolveGarmentHex(accessoryItem, '#D4AF37');

  const topName = (topItem?.name || '').toLowerCase();
  const outerName = (outerItem?.name || '').toLowerCase();
  const bottomName = (bottomItem?.name || '').toLowerCase();
  const shoesName = (shoesItem?.name || '').toLowerCase();
  const accName = (accessoryItem?.name || '').toLowerCase();

  const isTopWhite = isWhiteOrLight(topColor);
  const isOuterWhite = isWhiteOrLight(outerColor);
  const isBottomWhite = isWhiteOrLight(bottomColor);
  const isShoeWhite = isWhiteOrLight(shoesColor);

  // Animation values (disabled in staticPreview to avoid scroll pulses)
  const breathAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (staticPreview) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: -3.5,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathing.start();
    return () => breathing.stop();
  }, [breathAnim, staticPreview]);

  useEffect(() => {
    if (staticPreview) return;
    bounceAnim.setValue(0.96);
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 5,
      tension: 75,
      useNativeDriver: true,
    }).start();
  }, [items, bounceAnim, staticPreview]);

  // Helper garment styling flags
  const isPolo = /polo/.test(topName);
  const isButtonDown = /button|oxford|shirt/.test(topName) && !isPolo;
  const isCropTop = /crop/.test(topName);

  const hasOuter = Boolean(outerItem);
  const isHoodie = /hoodie|zip|sweatshirt/.test(outerName) || (!hasOuter && /hoodie|zip|sweatshirt/.test(topName));
  const isBlazer = /blazer|suit|coat/.test(outerName);
  const isJacket = hasOuter && !isHoodie && !isBlazer;

  const isShorts = /short/.test(bottomName);
  const isSkirt = /skirt/.test(bottomName);
  const isCargo = /cargo/.test(bottomName);

  const hasWatch = /watch|smartwatch/.test(accName);
  const hasSunglasses = /sunglass|glasses/.test(accName);
  const hasNecklace = /chain|necklace/.test(accName);
  const hasAirpods = /airpod|earbud|earphone/.test(accName);
  const hasBelt = /belt/.test(accName);

  // Dynamic ViewBox: "45 0 150 165" zooms in on the head/face/hair, "0 0 240 385" fits full body
  const viewBox = viewBoxOverride || (zoomMode === 'head' ? '45 0 150 165' : '0 0 240 385');

  // Occasion Scene Rendering Helper
  const sceneKey = (occasionScene || '').toLowerCase();
  const isCasualScene = sceneKey.includes('casual') || sceneKey.includes('street') || sceneKey.includes('everyday');
  const isAcademicScene = sceneKey.includes('academic') || sceneKey.includes('school') || sceneKey.includes('campus');
  const isOfficeScene = sceneKey.includes('office') || sceneKey.includes('work') || sceneKey.includes('smart') || sceneKey.includes('formal');
  const isPartyScene = sceneKey.includes('party') || sceneKey.includes('evening') || sceneKey.includes('night');
  const isWorkoutScene = sceneKey.includes('workout') || sceneKey.includes('gym') || sceneKey.includes('sport');

  const renderSvgContent = () => (
    <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      <Defs>
        {/* Skin Gradient */}
        <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={skinHighlight} />
          <Stop offset="70%" stopColor={resolvedSkinTone} />
          <Stop offset="100%" stopColor={skinShade} />
        </LinearGradient>

        {/* Hair Gradient */}
        <LinearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={hairHighlight} />
          <Stop offset="65%" stopColor={resolvedHairColor} />
          <Stop offset="100%" stopColor={hairShade} />
        </LinearGradient>

        {/* Top Fabric Gradient */}
        <LinearGradient id="topGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={isTopWhite ? '#FFFFFF' : adjustColor(topColor, 18)} />
          <Stop offset="70%" stopColor={topColor} />
          <Stop offset="100%" stopColor={isTopWhite ? '#ECEAE3' : adjustColor(topColor, -20)} />
        </LinearGradient>

        {/* Outerwear Fabric Gradient */}
        <LinearGradient id="outerGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={isOuterWhite ? '#FFFFFF' : adjustColor(outerColor, 18)} />
          <Stop offset="70%" stopColor={outerColor} />
          <Stop offset="100%" stopColor={isOuterWhite ? '#ECEAE3' : adjustColor(outerColor, -24)} />
        </LinearGradient>

        {/* Bottom Fabric Gradient */}
        <LinearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={isBottomWhite ? '#FFFFFF' : adjustColor(bottomColor, 18)} />
          <Stop offset="70%" stopColor={bottomColor} />
          <Stop offset="100%" stopColor={isBottomWhite ? '#ECEAE3' : adjustColor(bottomColor, -22)} />
        </LinearGradient>

        {/* Shoes Gradient */}
        <LinearGradient id="shoeGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={isShoeWhite ? '#FFFFFF' : adjustColor(shoesColor, 16)} />
          <Stop offset="80%" stopColor={shoesColor} />
          <Stop offset="100%" stopColor={isShoeWhite ? '#E4E2DC' : adjustColor(shoesColor, -25)} />
        </LinearGradient>

        {/* Ground Floor Shadow */}
        <LinearGradient id="shadowGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <Stop offset="50%" stopColor="rgba(0,0,0,0.12)" />
          <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </LinearGradient>
      </Defs>

      {/* ================= 0. OCCASION BACKGROUND SCENE (SUBTLE & LAYERED) ================= */}
      {zoomMode !== 'head' && (
        <G opacity={0.65}>
          {isCasualScene && (
            <G>
              {/* Soft Urban Skyline Silhouette */}
              <Path
                d="M 20,240 L 40,240 L 40,200 L 65,200 L 65,225 L 85,225 L 85,190 L 105,190 L 105,240 L 135,240 L 135,210 L 160,210 L 160,230 L 180,230 L 180,195 L 210,195 L 210,240 L 225,240"
                fill="none"
                stroke="#E2E6DF"
                strokeWidth="1.2"
              />
              {/* Café Awning Accent */}
              <Path
                d="M 25,32 L 215,32 L 205,48 Q 195,54 185,48 Q 175,54 165,48 Q 155,54 145,48 Q 135,54 125,48 Q 115,54 105,48 Q 95,54 85,48 Q 75,54 65,48 Q 55,54 45,48 Q 35,54 25,48 Z"
                fill="#F0E8DD"
                stroke="#D8CFBE"
                strokeWidth="1"
              />
              <Line x1="70" y1="32" x2="65" y2="48" stroke="#E57A58" strokeWidth="2" opacity={0.7} />
              <Line x1="110" y1="32" x2="105" y2="48" stroke="#E57A58" strokeWidth="2" opacity={0.7} />
              <Line x1="150" y1="32" x2="145" y2="48" stroke="#E57A58" strokeWidth="2" opacity={0.7} />
              <Line x1="190" y1="32" x2="185" y2="48" stroke="#E57A58" strokeWidth="2" opacity={0.7} />
            </G>
          )}

          {isAcademicScene && (
            <G>
              {/* Campus Archway & Library Windows */}
              <Path
                d="M 50,260 L 50,90 C 50,45 190,45 190,90 L 190,260"
                fill="none"
                stroke="#DCE2D6"
                strokeWidth="1.6"
              />
              <Path
                d="M 65,260 L 65,100 C 65,65 175,65 175,100 L 175,260"
                fill="none"
                stroke="#E8EDE2"
                strokeWidth="1"
              />
              <Line x1="120" y1="52" x2="120" y2="120" stroke="#E8EDE2" strokeWidth="1" />
              <Line x1="65" y1="110" x2="175" y2="110" stroke="#E8EDE2" strokeWidth="1" />
            </G>
          )}

          {isOfficeScene && (
            <G>
              {/* Modern Office Architectural Glass Lines */}
              <Line x1="40" y1="30" x2="40" y2="280" stroke="#E2E7DE" strokeWidth="1.2" strokeDasharray="6,4" />
              <Line x1="200" y1="30" x2="200" y2="280" stroke="#E2E7DE" strokeWidth="1.2" strokeDasharray="6,4" />
              <Line x1="30" y1="120" x2="210" y2="120" stroke="#E9EEE5" strokeWidth="1" />
              <Line x1="30" y1="190" x2="210" y2="190" stroke="#E9EEE5" strokeWidth="1" />
              {/* Indoor Plant Silhouette */}
              <Path
                d="M 210,270 C 205,250 190,235 175,238 C 185,250 195,265 210,270 Z"
                fill="rgba(74, 93, 78, 0.18)"
              />
              <Path
                d="M 215,265 C 220,245 205,225 192,230 C 200,244 208,258 215,265 Z"
                fill="rgba(74, 93, 78, 0.14)"
              />
            </G>
          )}

          {isPartyScene && (
            <G>
              {/* Evening Twilight Bokeh Circles */}
              <Circle cx="45" cy="70" r="14" fill="#FFD166" opacity={0.16} />
              <Circle cx="195" cy="90" r="18" fill="#F07E57" opacity={0.14} />
              <Circle cx="170" cy="45" r="10" fill="#FFE3A8" opacity={0.2} />
              <Circle cx="60" cy="160" r="12" fill="#D4AF37" opacity={0.15} />
              <Circle cx="185" cy="180" r="15" fill="#FFD166" opacity={0.14} />
            </G>
          )}

          {isWorkoutScene && (
            <G>
              {/* Outdoor Athletic Running Track Lines */}
              <Path d="M 20,330 C 70,300 170,300 220,330" fill="none" stroke="#E2E8F0" strokeWidth="2" />
              <Path d="M 15,346 C 70,316 170,316 225,346" fill="none" stroke="#E2E8F0" strokeWidth="2" strokeDasharray="8,6" />
              <Path d="M 10,362 C 70,332 170,332 230,362" fill="none" stroke="#E2E8F0" strokeWidth="2" />
            </G>
          )}

          {/* Ground Footwear Shadow Ellipse */}
          <Ellipse cx="120" cy="360" rx="66" ry="8" fill="url(#shadowGrad)" />
        </G>
      )}

      {/* ================= 1. SCALED MANNEQUIN CHARACTER ================= */}
      <G transform={`translate(120, 192) scale(${widthScale}, ${heightScale}) translate(-120, -192)`}>
        {/* Female Hair Back Layer (Behind Neck) */}
        {gender === 'female' && resolvedHairStyle === 'female_long_tucked' && (
          <G>
            <Path
              d="M 98,46 C 84,62 80,94 84,136 C 92,136 102,112 104,82 C 104,68 100,55 98,46 Z"
              fill="url(#hairGrad)"
            />
            <Path
              d="M 142,46 C 156,62 160,94 156,136 C 148,136 138,112 136,82 C 136,68 140,55 142,46 Z"
              fill="url(#hairGrad)"
            />
          </G>
        )}
        {gender === 'female' && resolvedHairStyle === 'female_bob' && (
          <G>
            <Path d="M 96,48 C 90,62 90,72 96,76 C 100,76 102,68 103,58 Z" fill="url(#hairGrad)" />
            <Path d="M 144,48 C 150,62 150,72 144,76 C 140,76 138,68 137,58 Z" fill="url(#hairGrad)" />
          </G>
        )}
        {gender === 'female' && resolvedHairStyle === 'female_ponytail' && (
          <G>
            <Path d="M 136,24 C 154,26 166,48 160,88 C 153,88 148,58 136,30 Z" fill="url(#hairGrad)" />
          </G>
        )}
        {gender === 'female' && resolvedHairStyle === 'female_buns' && (
          <G>
            <Circle cx="94" cy="18" r="10" fill="url(#hairGrad)" stroke={hairShade} strokeWidth="1" />
            <Circle cx="146" cy="18" r="10" fill="url(#hairGrad)" stroke={hairShade} strokeWidth="1" />
          </G>
        )}

        {/* Anatomical Base Body (Sloped Shoulders & Tapered Fashion Silhouette) */}
        <G>
          {/* Neck with Natural Taper */}
          <Path
            d="M 110,68 C 110,64 130,64 130,68 L 132,88 C 124,90 116,90 108,88 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.8"
          />

          {/* Visible Collarbone */}
          <Path
            d="M 104,86 C 112,89 119,87 120,87 C 121,87 128,89 136,86"
            stroke={skinShade}
            strokeWidth="1.1"
            strokeLinecap="round"
            fill="none"
          />

          {/* Head (cx=120, cy=48, r=22) -> Top of skull at y=26 */}
          <Circle
            cx="120"
            cy="48"
            r="22"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.8"
          />

          {/* Ears */}
          <Ellipse cx="95" cy="48" rx="4" ry="7" fill="url(#skinGrad)" stroke={skinShade} strokeWidth="0.7" />
          <Ellipse cx="145" cy="48" rx="4" ry="7" fill="url(#skinGrad)" stroke={skinShade} strokeWidth="0.7" />

          {/* Natural Tapered Torso Silhouette */}
          <Path
            d="M 84,88 C 96,82 144,82 156,88 L 148,182 L 92,182 Z"
            fill="url(#skinGrad)"
          />

          {/* Arms with Natural Elbow Contour & Proportioned Hands */}
          {/* Left Arm & Hand */}
          <Path
            d="M 84,88 C 76,98 71,126 67,146 L 71,182 L 77,182 L 75,146 C 77,130 83,106 90,92 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
          <Path
            d="M 69,182 C 67,190 71,202 74,202 C 77,202 79,192 77,182 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.6"
          />

          {/* Right Arm & Hand */}
          <Path
            d="M 156,88 C 164,98 169,126 173,146 L 169,182 L 163,182 L 165,146 C 163,130 157,106 150,92 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
          <Path
            d="M 171,182 C 173,190 169,202 166,202 C 163,202 161,192 163,182 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.6"
          />

          {/* Legs with Natural Calf & Ankle Taper */}
          {/* Left Leg */}
          <Path
            d="M 92,182 L 118,182 L 116,220 L 114,335 L 82,335 L 86,236 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
          {/* Right Leg */}
          <Path
            d="M 122,182 L 148,182 L 154,236 L 158,335 L 126,335 L 124,220 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
        </G>

        {/* ================= 2. DESELECTABLE INNER BASE LAYERS ================= */}
        {/* If BOTH Top and Outerwear are deselected, render clean anatomical fitted undershirt */}
        {!topItem && !outerItem && (
          <G>
            <Path
              d="M 90,88 C 102,84 138,84 150,88 L 145,182 L 95,182 Z"
              fill="#EAE6DF"
              stroke="#D5D1CA"
              strokeWidth="1"
            />
            {/* Undershirt scoop neck */}
            <Path
              d="M 108,86 C 114,94 126,94 132,86"
              fill="none"
              stroke="#D5D1CA"
              strokeWidth="1.2"
            />
          </G>
        )}

        {/* If Bottom is deselected, render clean neutral fitted base shorts */}
        {!bottomItem && (
          <G>
            <Path
              d="M 92,182 L 148,182 L 151,228 L 123,228 L 120,214 L 117,228 L 89,228 Z"
              fill="#DFDBD2"
              stroke="#CAC6BD"
              strokeWidth="1"
            />
          </G>
        )}

        {/* If Shoes are deselected, render clean bare feet / ankle socks */}
        {!shoesItem && (
          <G onPress={() => onSelectSlot?.('SHOES')}>
            {/* Left foot/sock */}
            <Path
              d="M 82,334 L 114,334 L 114,354 L 76,354 C 72,350 76,342 82,334 Z"
              fill="#F0ECE4"
              stroke="#D8D4CC"
              strokeWidth="1"
            />
            {/* Right foot/sock */}
            <Path
              d="M 126,334 L 158,334 C 164,342 168,350 164,354 L 126,354 Z"
              fill="#F0ECE4"
              stroke="#D8D4CC"
              strokeWidth="1"
            />
          </G>
        )}

        {/* Facial Features */}
        <G>
          {resolvedFaceStyle === 'friendly' && (
            <G>
              <Path d="M 106,37 Q 112,34 117,37" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              <Path d="M 123,37 Q 128,34 134,37" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              <Circle cx="112" cy="45" r="2.5" fill="#241812" />
              <Circle cx="111.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              <Circle cx="128" cy="45" r="2.5" fill="#241812" />
              <Circle cx="127.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              <Path d="M 120,46 L 118.5,52 L 121.5,52" fill="none" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />
              <Path d="M 115,55 Q 120,59 125,55" fill="none" stroke="#C47362" strokeWidth="1.6" strokeLinecap="round" />
              <Ellipse cx="106" cy="51" rx="4" ry="2" fill="rgba(240, 110, 110, 0.22)" />
              <Ellipse cx="134" cy="51" rx="4" ry="2" fill="rgba(240, 110, 110, 0.22)" />
            </G>
          )}

          {resolvedFaceStyle === 'cool' && (
            <G>
              <Path d="M 105,37 L 117,35" fill="none" stroke="#241812" strokeWidth="1.8" strokeLinecap="round" />
              <Path d="M 123,35 L 135,37" fill="none" stroke="#241812" strokeWidth="1.8" strokeLinecap="round" />
              <Circle cx="112" cy="45" r="2.3" fill="#241812" />
              <Circle cx="111.4" cy="44.4" r="0.7" fill="#FFFFFF" />
              <Circle cx="128" cy="45" r="2.3" fill="#241812" />
              <Circle cx="127.4" cy="44.4" r="0.7" fill="#FFFFFF" />
              <Path d="M 120,45 L 118.5,51 L 121.5,51" fill="none" stroke={skinShade} strokeWidth="1.2" strokeLinecap="round" />
              <Path d="M 116,56 C 120,56 124,54 126,53" fill="none" stroke="#C47362" strokeWidth="1.6" strokeLinecap="round" />
            </G>
          )}

          {resolvedFaceStyle === 'wink' && (
            <G>
              <Path d="M 106,36 Q 112,33 117,36" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              <Path d="M 123,38 Q 128,35 134,38" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              <Circle cx="112" cy="45" r="2.5" fill="#241812" />
              <Circle cx="111.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              <Path d="M 124,46 Q 128,42 132,46" fill="none" stroke="#241812" strokeWidth="2.2" strokeLinecap="round" />
              <Path d="M 120,46 L 118.5,52 L 121.5,52" fill="none" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />
              <Path d="M 115,55 Q 120,60 126,56" fill="none" stroke="#C47362" strokeWidth="1.6" strokeLinecap="round" />
              <Ellipse cx="106" cy="51" rx="4.5" ry="2.2" fill="rgba(240, 110, 110, 0.28)" />
              <Ellipse cx="134" cy="51" rx="4.5" ry="2.2" fill="rgba(240, 110, 110, 0.28)" />
            </G>
          )}
        </G>

        {/* Connected Footwear */}
        {shoesItem && (
          <G onPress={() => onSelectSlot?.('SHOES')}>
            {/* Left Shoe */}
            <G>
              <Path
                d="M 76,332 L 115,332 L 115,356 L 66,356 C 62,352 66,342 76,332 Z"
                fill="url(#shoeGrad)"
                stroke={isShoeWhite ? '#D0CEC7' : adjustColor(shoesColor, -35)}
                strokeWidth={isShoeWhite ? 1.3 : 1.2}
              />
              <Rect
                x="64"
                y="355"
                width="53"
                height="7"
                rx="2.5"
                fill="#FFFFFF"
                stroke="#C2C7BD"
                strokeWidth="1"
              />
              <Line x1="84" y1="337" x2="96" y2="343" stroke={isShoeWhite ? '#C8C4BC' : adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
              <Line x1="88" y1="343" x2="100" y2="349" stroke={isShoeWhite ? '#C8C4BC' : adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
            </G>

            {/* Right Shoe */}
            <G>
              <Path
                d="M 125,332 L 164,332 C 174,342 178,352 174,356 L 125,356 Z"
                fill="url(#shoeGrad)"
                stroke={isShoeWhite ? '#D0CEC7' : adjustColor(shoesColor, -35)}
                strokeWidth={isShoeWhite ? 1.3 : 1.2}
              />
              <Rect
                x="123"
                y="355"
                width="53"
                height="7"
                rx="2.5"
                fill="#FFFFFF"
                stroke="#C2C7BD"
                strokeWidth="1"
              />
              <Line x1="144" y1="343" x2="156" y2="337" stroke={isShoeWhite ? '#C8C4BC' : adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
              <Line x1="140" y1="349" x2="152" y2="343" stroke={isShoeWhite ? '#C8C4BC' : adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
            </G>

            {activeSlot === 'SHOES' && (
              <G>
                <Rect x="60" y="328" width="120" height="38" rx="8" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
              </G>
            )}
          </G>
        )}

        {/* 2D Bottoms (y="184" to y="336") */}
        {bottomItem && (
          <G onPress={() => onSelectSlot?.('BOTTOM')}>
            {isShorts ? (
              <G>
                <Path
                  d="M 88,184 L 152,184 L 156,256 L 124,256 L 120,224 L 116,256 L 84,256 Z"
                  fill="url(#bottomGrad)"
                  stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -30)}
                  strokeWidth={isBottomWhite ? 1.4 : 1.3}
                />
                <Rect x="87" y="184" width="66" height="9" rx="1.5" fill={isBottomWhite ? '#ECE8E1' : adjustColor(bottomColor, -14)} stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -30)} strokeWidth="1" />
                <Line x1="120" y1="184" x2="120" y2="216" stroke={isBottomWhite ? '#C8C4BC' : adjustColor(bottomColor, -35)} strokeWidth="1.3" />
              </G>
            ) : isSkirt ? (
              <G>
                <Path
                  d="M 92,184 L 148,184 L 168,260 L 72,260 Z"
                  fill="url(#bottomGrad)"
                  stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -30)}
                  strokeWidth={isBottomWhite ? 1.4 : 1.3}
                />
                <Rect x="91" y="184" width="58" height="9" rx="1.5" fill={isBottomWhite ? '#ECE8E1' : adjustColor(bottomColor, -14)} stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -30)} strokeWidth="1" />
              </G>
            ) : (
              <G>
                {/* Left Pant Leg (Tapered) */}
                <Path
                  d="M 88,184 L 120,184 L 118,220 L 115,335 L 77,335 L 82,220 Z"
                  fill="url(#bottomGrad)"
                  stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -32)}
                  strokeWidth={isBottomWhite ? 1.4 : 1.3}
                />
                {/* Right Pant Leg (Tapered) */}
                <Path
                  d="M 120,184 L 152,184 L 158,220 L 163,335 L 125,335 L 122,220 Z"
                  fill="url(#bottomGrad)"
                  stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -32)}
                  strokeWidth={isBottomWhite ? 1.4 : 1.3}
                />
                {/* Waistband */}
                <Rect x="87" y="184" width="66" height="9" rx="1.5" fill={isBottomWhite ? '#ECE8E1' : adjustColor(bottomColor, -14)} stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -32)} strokeWidth="1" />
                {/* Zipper Fly */}
                <Line x1="120" y1="184" x2="120" y2="218" stroke={isBottomWhite ? '#C8C4BC' : adjustColor(bottomColor, -36)} strokeWidth="1.4" />
                {/* Inseam / Outseam Creases */}
                <Line x1="98" y1="198" x2="96" y2="330" stroke={isBottomWhite ? '#DCD8D0' : adjustColor(bottomColor, 12)} strokeWidth="1" opacity={0.6} />
                <Line x1="142" y1="198" x2="144" y2="330" stroke={isBottomWhite ? '#DCD8D0' : adjustColor(bottomColor, 12)} strokeWidth="1" opacity={0.6} />

                {isCargo && (
                  <G>
                    <Rect x="75" y="240" width="13" height="20" rx="2" fill={isBottomWhite ? '#ECE8E1' : adjustColor(bottomColor, -16)} stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -35)} strokeWidth="1" />
                    <Rect x="152" y="240" width="13" height="20" rx="2" fill={isBottomWhite ? '#ECE8E1' : adjustColor(bottomColor, -16)} stroke={isBottomWhite ? '#D0CEC7' : adjustColor(bottomColor, -35)} strokeWidth="1" />
                  </G>
                )}

                {hasBelt && (
                  <G>
                    <Rect x="87" y="185" width="66" height="7" fill="#1C1613" />
                    <Rect x="116" y="184" width="8" height="9" fill="#D4AF37" rx="1" />
                  </G>
                )}
              </G>
            )}

            {activeSlot === 'BOTTOM' && (
              <G>
                <Rect x="70" y="180" width="100" height="158" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
              </G>
            )}
          </G>
        )}

        {/* 2D Base Top (Inner Top) */}
        {topItem && (
          <G onPress={() => onSelectSlot?.('TOP')}>
            <G>
              {/* Tapered Top Torso Fabric */}
              <Path
                d={`M 84,88 C 96,82 144,82 156,88 L 149,${isCropTop ? 152 : 185} L 91,${isCropTop ? 152 : 185} Z`}
                fill="url(#topGrad)"
                stroke={isTopWhite ? '#D0CEC7' : adjustColor(topColor, -25)}
                strokeWidth={isTopWhite ? 1.4 : 1.2}
              />
              {/* Short Sleeves */}
              <Path d="M 84,88 L 68,124 L 79,127 L 90,92 Z" fill="url(#topGrad)" stroke={isTopWhite ? '#D0CEC7' : adjustColor(topColor, -25)} strokeWidth="1" />
              <Path d="M 156,88 L 172,124 L 161,127 L 150,92 Z" fill="url(#topGrad)" stroke={isTopWhite ? '#D0CEC7' : adjustColor(topColor, -25)} strokeWidth="1" />

              {/* Collar Types */}
              {isPolo ? (
                <G>
                  <Path d="M 106,84 L 120,102 L 134,84 Z" fill={isTopWhite ? '#FFFFFF' : adjustColor(topColor, 12)} stroke={isTopWhite ? '#D0CEC7' : adjustColor(topColor, -25)} strokeWidth="1" />
                  <Line x1="120" y1="102" x2="120" y2="122" stroke={isTopWhite ? '#C8C4BC' : adjustColor(topColor, -30)} strokeWidth="1.2" />
                  <Circle cx="120" cy="108" r="1.5" fill="#333333" />
                  <Circle cx="120" cy="116" r="1.5" fill="#333333" />
                </G>
              ) : isButtonDown ? (
                <G>
                  <Path d="M 104,84 L 120,104 L 136,84" fill="none" stroke={isTopWhite ? '#D0CEC7' : adjustColor(topColor, -25)} strokeWidth="1.2" />
                  <Line x1="120" y1="84" x2="120" y2="185" stroke={isTopWhite ? '#C8C4BC' : adjustColor(topColor, -25)} strokeWidth="1.2" />
                  <Circle cx="120" cy="114" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                  <Circle cx="120" cy="134" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                  <Circle cx="120" cy="154" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                  <Circle cx="120" cy="174" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                </G>
              ) : (
                <Path d="M 108,83 C 108,93 132,93 132,83 Z" fill="none" stroke={isTopWhite ? '#C8C4BC' : adjustColor(topColor, -28)} strokeWidth="2.2" />
              )}
            </G>

            {activeSlot === 'TOP' && !hasOuter && (
              <G>
                <Rect x="55" y="80" width="130" height="110" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
              </G>
            )}
          </G>
        )}

        {/* 2D Outerwear Layer (Over Inner Top) */}
        {hasOuter && (
          <G onPress={() => onSelectSlot?.('OUTERWEAR')}>
            {isHoodie ? (
              <G>
                {/* Fleece Hoodie Body */}
                <Path
                  d="M 80,86 C 94,80 146,80 160,86 L 153,194 L 87,194 Z"
                  fill="url(#outerGrad)"
                  stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)}
                  strokeWidth={isOuterWhite ? 1.4 : 1.3}
                />
                {/* Full Long Sleeves */}
                <Path d="M 80,86 L 64,140 L 70,182 L 78,182 L 74,140 L 88,92 Z" fill="url(#outerGrad)" stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)} strokeWidth="1.2" />
                <Path d="M 160,86 L 176,140 L 170,182 L 162,182 L 166,140 L 152,92 Z" fill="url(#outerGrad)" stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)} strokeWidth="1.2" />
                {/* Cuffs */}
                <Rect x="68" y="176" width="12" height="6" rx="1" fill={isOuterWhite ? '#ECE8E1' : adjustColor(outerColor, -15)} />
                <Rect x="160" y="176" width="12" height="6" rx="1" fill={isOuterWhite ? '#ECE8E1' : adjustColor(outerColor, -15)} />
                {/* Kangaroo Pocket */}
                <Path d="M 94,148 L 146,148 L 142,186 L 98,186 Z" fill={isOuterWhite ? '#ECE8E1' : adjustColor(outerColor, -12)} stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)} strokeWidth="1.1" />
                {/* Drawstrings */}
                <Path d="M 104,82 C 112,94 128,94 136,82" fill="none" stroke={isOuterWhite ? '#C8C4BC' : adjustColor(outerColor, -32)} strokeWidth="2.5" />
                <Line x1="114" y1="88" x2="112" y2="110" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                <Line x1="126" y1="88" x2="128" y2="110" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            ) : isBlazer ? (
              <G>
                {/* Tailored Blazer Body */}
                <Path
                  d="M 80,86 L 120,80 L 160,86 L 153,196 L 87,196 Z"
                  fill="url(#outerGrad)"
                  stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -32)}
                  strokeWidth={isOuterWhite ? 1.4 : 1.3}
                />
                <Path d="M 80,86 L 64,140 L 70,182 L 78,182 L 74,140 L 88,92 Z" fill="url(#outerGrad)" stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -32)} strokeWidth="1.2" />
                <Path d="M 160,86 L 176,140 L 170,182 L 162,182 L 166,140 L 152,92 Z" fill="url(#outerGrad)" stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -32)} strokeWidth="1.2" />
                {/* Lapel cutouts */}
                <Path d="M 102,84 L 120,132 L 96,136 Z" fill={isOuterWhite ? '#ECE8E1' : adjustColor(outerColor, -14)} stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -32)} strokeWidth="1" />
                <Path d="M 138,84 L 120,132 L 144,136 Z" fill={isOuterWhite ? '#ECE8E1' : adjustColor(outerColor, -14)} stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -32)} strokeWidth="1" />
                <Circle cx="120" cy="144" r="2.2" fill="#D4AF37" />
              </G>
            ) : (
              // Open Casual Jacket / Bomber
              <G>
                <Path
                  d="M 80,86 L 120,80 L 160,86 L 152,190 L 88,190 Z"
                  fill="url(#outerGrad)"
                  stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)}
                  strokeWidth={isOuterWhite ? 1.4 : 1.3}
                />
                <Path d="M 80,86 L 64,140 L 70,182 L 78,182 L 74,140 L 88,92 Z" fill="url(#outerGrad)" stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)} strokeWidth="1.2" />
                <Path d="M 160,86 L 176,140 L 170,182 L 162,182 L 166,140 L 152,92 Z" fill="url(#outerGrad)" stroke={isOuterWhite ? '#D0CEC7' : adjustColor(outerColor, -30)} strokeWidth="1.2" />
                {/* Zipper Line */}
                <Line x1="120" y1="84" x2="120" y2="190" stroke={isOuterWhite ? '#A8A49C' : '#1C1613'} strokeWidth="1.8" strokeDasharray="3,1.5" />
              </G>
            )}

            {activeSlot === 'OUTERWEAR' && (
              <G>
                <Rect x="52" y="76" width="136" height="124" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
              </G>
            )}
          </G>
        )}

        {/* Accessories */}
        {accessoryItem && (
          <G onPress={() => onSelectSlot?.('ACCESSORIES')}>
            {hasWatch && (
              <G>
                <Rect x="69" y="174" width="9" height="5" rx="1.5" fill="#1C1613" />
                <Rect x="71" y="173" width="5" height="7" rx="1.5" fill={accColor} />
              </G>
            )}

            {hasNecklace && (
              <G>
                <Path d="M 112,82 C 112,98 128,98 128,82" fill="none" stroke={accColor} strokeWidth="1.8" />
                <Circle cx="120" cy="94" r="2.2" fill={accColor} />
              </G>
            )}

            {hasAirpods && (
              <G>
                <Circle cx="95" cy="48" r="2.2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
                <Line x1="95" y1="48" x2="95" y2="54" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                <Circle cx="145" cy="48" r="2.2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
                <Line x1="145" y1="48" x2="145" y2="54" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </G>
            )}

            {hasSunglasses && (
              <G>
                <Rect x="103" y="40" width="14" height="10" rx="3" fill="#12151B" stroke="#D4AF37" strokeWidth="1.2" />
                <Rect x="123" y="40" width="14" height="10" rx="3" fill="#12151B" stroke="#D4AF37" strokeWidth="1.2" />
                <Line x1="117" y1="43" x2="123" y2="43" stroke="#D4AF37" strokeWidth="1.5" />
                <Line x1="96" y1="42" x2="103" y2="42" stroke="#D4AF37" strokeWidth="1.2" />
                <Line x1="137" y1="42" x2="144" y2="42" stroke="#D4AF37" strokeWidth="1.2" />
              </G>
            )}

            {activeSlot === 'ACCESSORIES' && (
              <G>
                <Circle cx="120" cy="50" r="34" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
              </G>
            )}
          </G>
        )}

        {/* Foreground Hair Layer - SCULPTED GEOMETRY */}
        {gender === 'male' ? (
          <G>
            {resolvedHairStyle === 'male_comma' ? (
              <G>
                <Path
                  d="M 95,43 C 93,18 105,14 120,14 C 136,14 148,18 146,43 C 138,32 130,28 124,30 C 114,28 104,36 110,42 C 104,38 98,38 95,43 Z"
                  fill="url(#hairGrad)"
                />
                <Path
                  d="M 124,30 C 120,37 112,42 110,40 C 114,35 119,32 124,30 Z"
                  fill={adjustColor(resolvedHairColor, 16)}
                />
                <Path d="M 95,43 L 95,48 L 98,46 Z" fill={hairShade} />
                <Path d="M 146,43 L 146,48 L 143,46 Z" fill={hairShade} />
              </G>
            ) : resolvedHairStyle === 'male_spiky' ? (
              <G>
                <Path
                  d="M 96,42 C 94,22 102,15 108,13 L 112,17 L 116,12 L 122,17 L 126,13 L 132,18 L 138,15 C 144,22 146,30 145,42 C 138,32 134,35 128,33 C 122,35 118,31 112,34 C 106,31 101,36 96,42 Z"
                  fill="url(#hairGrad)"
                />
                <Path d="M 96,42 L 96,48 L 99,45 Z" fill={hairShade} />
                <Path d="M 145,42 L 145,48 L 142,45 Z" fill={hairShade} />
              </G>
            ) : resolvedHairStyle === 'male_curly' ? (
              <G>
                <Path
                  d="M 96,43 C 93,22 102,14 107,15 C 112,13 118,14 121,15 C 126,13 133,14 137,16 C 143,18 147,24 145,43 C 138,35 133,37 127,33 C 122,36 116,33 111,36 C 105,34 100,38 96,43 Z"
                  fill="url(#hairGrad)"
                />
                <Circle cx="114" cy="22" r="3" fill="none" stroke={adjustColor(resolvedHairColor, 25)} strokeWidth="1" />
                <Circle cx="126" cy="22" r="3" fill="none" stroke={adjustColor(resolvedHairColor, 25)} strokeWidth="1" />
                <Circle cx="120" cy="28" r="3" fill="none" stroke={adjustColor(resolvedHairColor, 25)} strokeWidth="1" />
                <Path d="M 96,43 L 96,48 L 99,45 Z" fill={hairShade} />
                <Path d="M 145,43 L 145,48 L 142,45 Z" fill={hairShade} />
              </G>
            ) : (
              // Default: Korean Textured Two-Block Curtain Bangs
              <G>
                <Path
                  d="M 95,44 C 92,20 105,14 120,14 C 135,14 148,20 145,44 C 138,33 128,31 120,37 C 112,31 102,33 95,44 Z"
                  fill="url(#hairGrad)"
                />
                <Path d="M 112,31 Q 116,36 119,37" fill="none" stroke={adjustColor(resolvedHairColor, 22)} strokeWidth="1.2" />
                <Path d="M 128,31 Q 124,36 121,37" fill="none" stroke={adjustColor(resolvedHairColor, 22)} strokeWidth="1.2" />
                <Path d="M 95,44 L 95,49 L 98,46 Z" fill={hairShade} />
                <Path d="M 145,44 L 145,49 L 142,46 Z" fill={hairShade} />
              </G>
            )}
          </G>
        ) : (
          <G>
            {resolvedHairStyle === 'female_bob' ? (
              <G>
                <Path
                  d="M 95,44 C 92,18 106,14 120,14 C 134,14 148,18 145,44 C 148,56 148,70 142,76 C 138,72 137,58 136,50 C 132,36 126,33 120,34 C 114,33 108,36 104,50 C 103,58 102,72 98,76 C 92,70 92,56 95,44 Z"
                  fill="url(#hairGrad)"
                />
                <Path d="M 104,36 Q 112,40 120,38" fill="none" stroke={adjustColor(resolvedHairColor, 18)} strokeWidth="1" />
                <Path d="M 136,36 Q 128,40 120,38" fill="none" stroke={adjustColor(resolvedHairColor, 18)} strokeWidth="1" />
              </G>
            ) : resolvedHairStyle === 'female_ponytail' ? (
              <G>
                <Path
                  d="M 96,44 C 94,22 106,15 120,15 C 134,15 146,22 144,44 C 138,34 130,32 120,33 C 110,32 102,34 96,44 Z"
                  fill="url(#hairGrad)"
                />
                <Circle cx="136" cy="24" r="3.2" fill="#F07E57" />
              </G>
            ) : resolvedHairStyle === 'female_buns' ? (
              <G>
                <Path
                  d="M 96,44 C 94,22 106,15 120,15 C 134,15 146,22 144,44 C 138,34 130,32 120,33 C 110,32 102,34 96,44 Z"
                  fill="url(#hairGrad)"
                />
              </G>
            ) : (
              // Default: Long Layered Tucked Behind Ears
              <G>
                <Path
                  d="M 96,45 C 93,20 106,14 120,14 C 134,14 147,20 144,45 C 139,33 132,32 120,34 C 108,32 101,33 96,45 Z"
                  fill="url(#hairGrad)"
                />
                <Path d="M 98,36 Q 106,42 112,38 Q 104,34 100,32 Z" fill={hairHighlight} />
                <Path d="M 142,36 Q 134,42 128,38 Q 136,34 140,32 Z" fill={hairHighlight} />
              </G>
            )}
          </G>
        )}
      </G>
    </Svg>
  );

  return (
    <View style={[styles.container, compact && styles.compact, staticPreview && styles.staticPreview]}>
      {/* Occasion Scene Badge */}
      {occasionScene && !compact && !staticPreview && zoomMode !== 'head' && (
        <View style={styles.sceneBadge}>
          <Text style={styles.sceneBadgeText}>
            {isAcademicScene
              ? '🎓 Campus Scene'
              : isOfficeScene
              ? '💼 Office Scene'
              : isPartyScene
              ? '✨ Evening Scene'
              : isWorkoutScene
              ? '⚡ Athletic Scene'
              : '🏙️ Casual Scene'}
          </Text>
        </View>
      )}

      {staticPreview ? (
        <View style={styles.stage}>{renderSvgContent()}</View>
      ) : (
        <Animated.View
          style={[
            styles.stage,
            {
              transform: [
                { translateY: breathAnim },
                { scale: bounceAnim },
              ],
            },
          ]}
        >
          {renderSvgContent()}
        </Animated.View>
      )}

      {/* Interactive Touch Overlay Zones */}
      {!staticPreview && zoomMode !== 'head' && (
        <>
          <Pressable
            accessibilityLabel="Select accessories"
            onPress={() => onSelectSlot?.('ACCESSORIES')}
            style={[styles.touchZone, { top: '3%', left: '26%', width: '48%', height: '17%' }]}
          />
          <Pressable
            accessibilityLabel="Select outerwear or top"
            onPress={() => onSelectSlot?.(hasOuter ? 'OUTERWEAR' : 'TOP')}
            style={[styles.touchZone, { top: '20%', left: '20%', width: '60%', height: '27%' }]}
          />
          <Pressable
            accessibilityLabel="Select bottom"
            onPress={() => onSelectSlot?.('BOTTOM')}
            style={[styles.touchZone, { top: '47%', left: '22%', width: '56%', height: '36%' }]}
          />
          <Pressable
            accessibilityLabel="Select shoes"
            onPress={() => onSelectSlot?.('SHOES')}
            style={[styles.touchZone, { top: '83%', left: '22%', width: '56%', height: '12%' }]}
          />

          {/* Active slot indicator pill */}
          <View style={styles.pillContainer}>
            {activeSlot ? (
              <View style={styles.activePill}>
                <View style={styles.activeDot} />
                <Text style={styles.activePillText}>
                  Selected: {SLOT_LABELS[activeSlot]} · Tap to customize
                </Text>
              </View>
            ) : (
              <View style={styles.idlePill}>
                <Text style={styles.idlePillText}>
                  {gender === 'male' ? 'Tailored Silhouette' : 'Personal Silhouette'} · {heightCm} cm
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    minHeight: 380,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compact: {
    minHeight: 250,
    height: '100%',
  },
  staticPreview: {
    minHeight: undefined,
    height: '100%',
    width: '100%',
  },
  stage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E6DC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sceneBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#264C3B',
  },
  touchZone: {
    position: 'absolute',
    borderRadius: 16,
  },
  pillContainer: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(38, 76, 59, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F07E57',
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  idlePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E6DB',
  },
  idlePillText: {
    color: '#657468',
    fontSize: 10.5,
    fontWeight: '700',
  },
});
