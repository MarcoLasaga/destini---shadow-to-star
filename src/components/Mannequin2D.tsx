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
import { adjustColor, normalizeHex } from '../utils/garmentImageHelper';

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
  const widthScale = clamp((weightKg / 62) * (isBaggy ? 1.12 : isSlim ? 0.92 : 1.0), 0.85, 1.22);

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
      const slot = slotForItem(item);
      if (!map[slot]) {
        map[slot] = item;
      }
    }
    return map;
  }, [items]);

  const topItem = bySlot.TOP;
  const outerItem = bySlot.OUTERWEAR;
  const bottomItem = bySlot.BOTTOM;
  const shoesItem = bySlot.SHOES;
  const accessoryItem = bySlot.ACCESSORIES;

  // Garment names and color resolution
  const topColor = normalizeHex(topItem?.hexColor || topItem?.primaryColor || topItem?.color, '#F7F7F5');
  const outerColor = normalizeHex(outerItem?.hexColor || outerItem?.primaryColor || outerItem?.color, '#2D3A45');
  const bottomColor = normalizeHex(bottomItem?.hexColor || bottomItem?.primaryColor || bottomItem?.color, '#23395B');
  const shoesColor = normalizeHex(shoesItem?.hexColor || shoesItem?.primaryColor || shoesItem?.color, '#FFFFFF');
  const accColor = normalizeHex(accessoryItem?.hexColor || accessoryItem?.primaryColor || accessoryItem?.color, '#D4AF37');

  const topName = (topItem?.name || '').toLowerCase();
  const outerName = (outerItem?.name || '').toLowerCase();
  const bottomName = (bottomItem?.name || '').toLowerCase();
  const shoesName = (shoesItem?.name || '').toLowerCase();
  const accName = (accessoryItem?.name || '').toLowerCase();

  // Animation values (disabled in staticPreview to avoid scroll pulses)
  const breathAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (staticPreview) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: -4,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 0,
          duration: 1200,
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
    bounceAnim.setValue(0.94);
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 4,
      tension: 75,
      useNativeDriver: true,
    }).start();
  }, [items, bounceAnim, staticPreview]);

  // Helper flags
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

  const renderSvgContent = () => (
    <Svg width="100%" height="100%" viewBox="0 0 240 385" preserveAspectRatio="xMidYMid meet">
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
          <Stop offset="0%" stopColor={adjustColor(topColor, 18)} />
          <Stop offset="70%" stopColor={topColor} />
          <Stop offset="100%" stopColor={adjustColor(topColor, -20)} />
        </LinearGradient>

        {/* Outerwear Fabric Gradient */}
        <LinearGradient id="outerGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={adjustColor(outerColor, 18)} />
          <Stop offset="70%" stopColor={outerColor} />
          <Stop offset="100%" stopColor={adjustColor(outerColor, -24)} />
        </LinearGradient>

        {/* Bottom Fabric Gradient */}
        <LinearGradient id="bottomGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={adjustColor(bottomColor, 18)} />
          <Stop offset="70%" stopColor={bottomColor} />
          <Stop offset="100%" stopColor={adjustColor(bottomColor, -22)} />
        </LinearGradient>

        {/* Shoes Gradient */}
        <LinearGradient id="shoeGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={adjustColor(shoesColor, 16)} />
          <Stop offset="80%" stopColor={shoesColor} />
          <Stop offset="100%" stopColor={adjustColor(shoesColor, -25)} />
        </LinearGradient>
      </Defs>

      {/* Scaled Mannequin Group */}
      <G transform={`translate(120, 192) scale(${widthScale}, ${heightScale}) translate(-120, -192)`}>
        {/* 1. Female Hair Back Layer (Behind Neck & Torso) - NEVER FOR MALE */}
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
            <Path
              d="M 96,48 C 90,62 90,72 96,76 C 100,76 102,68 103,58 Z"
              fill="url(#hairGrad)"
            />
            <Path
              d="M 144,48 C 150,62 150,72 144,76 C 140,76 138,68 137,58 Z"
              fill="url(#hairGrad)"
            />
          </G>
        )}
        {gender === 'female' && resolvedHairStyle === 'female_ponytail' && (
          <G>
            <Path
              d="M 136,24 C 154,26 166,48 160,88 C 153,88 148,58 136,30 Z"
              fill="url(#hairGrad)"
            />
          </G>
        )}
        {gender === 'female' && resolvedHairStyle === 'female_buns' && (
          <G>
            <Circle cx="94" cy="18" r="10" fill="url(#hairGrad)" stroke={hairShade} strokeWidth="1" />
            <Circle cx="146" cy="18" r="10" fill="url(#hairGrad)" stroke={hairShade} strokeWidth="1" />
          </G>
        )}

        {/* 2. Bare Base Human Body (Anatomy & Skin) */}
        <G>
          {/* Neck */}
          <Rect
            x="108"
            y="68"
            width="24"
            height="24"
            rx="8"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.8"
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

          {/* Torso Silhouette (under clothing) */}
          <Path
            d="M 72,88 C 72,88 104,82 120,82 C 136,82 168,88 168,88 L 160,184 L 80,184 Z"
            fill="url(#skinGrad)"
          />

          {/* Left Arm & Hand */}
          <Path
            d="M 72,88 L 58,136 L 62,182 L 68,182 L 68,136 L 80,92 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
          <Path
            d="M 60,182 C 58,190 62,202 65,202 C 68,202 70,192 68,182 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.6"
          />

          {/* Right Arm & Hand */}
          <Path
            d="M 168,88 L 182,136 L 178,182 L 172,182 L 172,136 L 160,92 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
          <Path
            d="M 180,182 C 182,190 178,202 175,202 C 172,202 170,192 172,182 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.6"
          />

          {/* Legs (Connect cleanly down to Shoes at y=335) */}
          {/* Left Leg */}
          <Path
            d="M 84,184 L 118,184 L 115,224 L 115,335 L 76,335 L 82,245 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
          {/* Right Leg */}
          <Path
            d="M 122,184 L 156,184 L 158,245 L 164,335 L 125,335 L 125,224 Z"
            fill="url(#skinGrad)"
            stroke={skinShade}
            strokeWidth="0.7"
          />
        </G>

        {/* 3. Facial Features by faceStyle */}
        <G>
          {resolvedFaceStyle === 'friendly' && (
            <G>
              {/* Eyebrows */}
              <Path d="M 106,37 Q 112,34 117,37" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              <Path d="M 123,37 Q 128,34 134,37" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              {/* Eyes with specular highlights */}
              <Circle cx="112" cy="45" r="2.5" fill="#241812" />
              <Circle cx="111.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              <Circle cx="128" cy="45" r="2.5" fill="#241812" />
              <Circle cx="127.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              {/* Soft nose */}
              <Path d="M 120,46 L 118.5,52 L 121.5,52" fill="none" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />
              {/* Warm smile */}
              <Path d="M 115,55 Q 120,59 125,55" fill="none" stroke="#C47362" strokeWidth="1.6" strokeLinecap="round" />
              {/* Blush */}
              <Ellipse cx="106" cy="51" rx="4" ry="2" fill="rgba(240, 110, 110, 0.22)" />
              <Ellipse cx="134" cy="51" rx="4" ry="2" fill="rgba(240, 110, 110, 0.22)" />
            </G>
          )}

          {resolvedFaceStyle === 'cool' && (
            <G>
              {/* Sharp confident brows */}
              <Path d="M 105,37 L 117,35" fill="none" stroke="#241812" strokeWidth="1.8" strokeLinecap="round" />
              <Path d="M 123,35 L 135,37" fill="none" stroke="#241812" strokeWidth="1.8" strokeLinecap="round" />
              {/* Confident almond eyes */}
              <Circle cx="112" cy="45" r="2.3" fill="#241812" />
              <Circle cx="111.4" cy="44.4" r="0.7" fill="#FFFFFF" />
              <Circle cx="128" cy="45" r="2.3" fill="#241812" />
              <Circle cx="127.4" cy="44.4" r="0.7" fill="#FFFFFF" />
              {/* Sharp nose */}
              <Path d="M 120,45 L 118.5,51 L 121.5,51" fill="none" stroke={skinShade} strokeWidth="1.2" strokeLinecap="round" />
              {/* Confident smirk */}
              <Path d="M 116,56 C 120,56 124,54 126,53" fill="none" stroke="#C47362" strokeWidth="1.6" strokeLinecap="round" />
            </G>
          )}

          {resolvedFaceStyle === 'wink' && (
            <G>
              {/* Playful raised brows */}
              <Path d="M 106,36 Q 112,33 117,36" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              <Path d="M 123,38 Q 128,35 134,38" fill="none" stroke="#241812" strokeWidth="1.6" strokeLinecap="round" />
              {/* Left open eye */}
              <Circle cx="112" cy="45" r="2.5" fill="#241812" />
              <Circle cx="111.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              {/* Right wink eye */}
              <Path d="M 124,46 Q 128,42 132,46" fill="none" stroke="#241812" strokeWidth="2.2" strokeLinecap="round" />
              {/* Nose */}
              <Path d="M 120,46 L 118.5,52 L 121.5,52" fill="none" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />
              {/* Playful grin */}
              <Path d="M 115,55 Q 120,60 126,56" fill="none" stroke="#C47362" strokeWidth="1.6" strokeLinecap="round" />
              {/* Blush */}
              <Ellipse cx="106" cy="51" rx="4.5" ry="2.2" fill="rgba(240, 110, 110, 0.28)" />
              <Ellipse cx="134" cy="51" rx="4.5" ry="2.2" fill="rgba(240, 110, 110, 0.28)" />
            </G>
          )}
        </G>

        {/* 4. Connected Footwear (y="332" to y="362") */}
        <G onPress={() => onSelectSlot?.('SHOES')}>
          {/* Left Shoe */}
          <G>
            <Path
              d="M 76,332 L 115,332 L 115,356 L 66,356 C 62,352 66,342 76,332 Z"
              fill="url(#shoeGrad)"
              stroke={adjustColor(shoesColor, -35)}
              strokeWidth="1.2"
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
            <Line x1="84" y1="337" x2="96" y2="343" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
            <Line x1="88" y1="343" x2="100" y2="349" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
          </G>

          {/* Right Shoe */}
          <G>
            <Path
              d="M 125,332 L 164,332 C 174,342 178,352 174,356 L 125,356 Z"
              fill="url(#shoeGrad)"
              stroke={adjustColor(shoesColor, -35)}
              strokeWidth="1.2"
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
            <Line x1="144" y1="343" x2="156" y2="337" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
            <Line x1="140" y1="349" x2="152" y2="343" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
          </G>

          {activeSlot === 'SHOES' && (
            <G>
              <Rect x="60" y="328" width="120" height="38" rx="8" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
            </G>
          )}
        </G>

        {/* 5. 2D Bottoms (y="184" to y="336") */}
        <G onPress={() => onSelectSlot?.('BOTTOM')}>
          {isShorts ? (
            <G>
              <Path
                d="M 84,184 L 156,184 L 160,256 L 125,256 L 120,224 L 115,256 L 80,256 Z"
                fill="url(#bottomGrad)"
                stroke={adjustColor(bottomColor, -30)}
                strokeWidth="1.3"
              />
              <Rect x="83" y="184" width="74" height="10" rx="1.5" fill={adjustColor(bottomColor, -14)} stroke={adjustColor(bottomColor, -30)} strokeWidth="1" />
              <Line x1="120" y1="184" x2="120" y2="216" stroke={adjustColor(bottomColor, -35)} strokeWidth="1.3" />
            </G>
          ) : isSkirt ? (
            <G>
              <Path
                d="M 90,184 L 150,184 L 172,260 L 68,260 Z"
                fill="url(#bottomGrad)"
                stroke={adjustColor(bottomColor, -30)}
                strokeWidth="1.3"
              />
              <Rect x="89" y="184" width="62" height="9" rx="1.5" fill={adjustColor(bottomColor, -14)} stroke={adjustColor(bottomColor, -30)} strokeWidth="1" />
            </G>
          ) : (
            <G>
              {/* Left Pant Leg */}
              <Path
                d="M 84,184 L 120,184 L 118,220 L 115,335 L 75,335 L 80,220 Z"
                fill="url(#bottomGrad)"
                stroke={adjustColor(bottomColor, -32)}
                strokeWidth="1.4"
              />
              {/* Right Pant Leg */}
              <Path
                d="M 120,184 L 156,184 L 160,220 L 165,335 L 125,335 L 122,220 Z"
                fill="url(#bottomGrad)"
                stroke={adjustColor(bottomColor, -32)}
                strokeWidth="1.4"
              />
              {/* Waistband */}
              <Rect x="83" y="184" width="74" height="10" rx="1.5" fill={adjustColor(bottomColor, -14)} stroke={adjustColor(bottomColor, -32)} strokeWidth="1" />
              {/* Zipper Fly */}
              <Line x1="120" y1="184" x2="120" y2="218" stroke={adjustColor(bottomColor, -36)} strokeWidth="1.4" />
              {/* Inseam / Outseam Creases */}
              <Line x1="98" y1="198" x2="96" y2="330" stroke={adjustColor(bottomColor, 12)} strokeWidth="1" opacity={0.6} />
              <Line x1="142" y1="198" x2="144" y2="330" stroke={adjustColor(bottomColor, 12)} strokeWidth="1" opacity={0.6} />

              {/* Cargo Pockets if cargo pants */}
              {isCargo && (
                <G>
                  <Rect x="73" y="240" width="14" height="22" rx="2" fill={adjustColor(bottomColor, -16)} stroke={adjustColor(bottomColor, -35)} strokeWidth="1" />
                  <Rect x="153" y="240" width="14" height="22" rx="2" fill={adjustColor(bottomColor, -16)} stroke={adjustColor(bottomColor, -35)} strokeWidth="1" />
                </G>
              )}

              {/* Belt if accessory */}
              {hasBelt && (
                <G>
                  <Rect x="83" y="185" width="74" height="7" fill="#1C1613" />
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

        {/* 6. 2D Base Top (Inner Top) */}
        <G onPress={() => onSelectSlot?.('TOP')}>
          <G>
            {/* Top Torso Fabric */}
            <Path
              d={`M 72,88 C 72,88 104,82 120,82 C 136,82 168,88 168,88 L 162,${isCropTop ? 152 : 188} L 78,${isCropTop ? 152 : 188} Z`}
              fill="url(#topGrad)"
              stroke={adjustColor(topColor, -25)}
              strokeWidth="1.2"
            />
            {/* Short Sleeves */}
            <Path d="M 72,88 L 54,124 L 68,128 L 80,94 Z" fill="url(#topGrad)" stroke={adjustColor(topColor, -25)} strokeWidth="1" />
            <Path d="M 168,88 L 186,124 L 172,128 L 160,94 Z" fill="url(#topGrad)" stroke={adjustColor(topColor, -25)} strokeWidth="1" />

            {/* Collar Types */}
            {isPolo ? (
              <G>
                <Path d="M 104,82 L 120,102 L 136,82 Z" fill={adjustColor(topColor, 12)} stroke={adjustColor(topColor, -25)} strokeWidth="1" />
                <Line x1="120" y1="102" x2="120" y2="122" stroke={adjustColor(topColor, -30)} strokeWidth="1.2" />
                <Circle cx="120" cy="108" r="1.5" fill="#333333" />
                <Circle cx="120" cy="116" r="1.5" fill="#333333" />
              </G>
            ) : isButtonDown ? (
              <G>
                <Path d="M 102,82 L 120,106 L 138,82" fill="none" stroke={adjustColor(topColor, -25)} strokeWidth="1.2" />
                <Line x1="120" y1="84" x2="120" y2="188" stroke={adjustColor(topColor, -25)} strokeWidth="1.2" />
                <Circle cx="120" cy="114" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                <Circle cx="120" cy="134" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                <Circle cx="120" cy="154" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
                <Circle cx="120" cy="174" r="1.5" fill="#FFFFFF" stroke="#888888" strokeWidth="0.5" />
              </G>
            ) : (
              // Crewneck collar
              <Path d="M 106,82 C 106,94 134,94 134,82 Z" fill="none" stroke={adjustColor(topColor, -28)} strokeWidth="2.4" />
            )}
          </G>

          {activeSlot === 'TOP' && !hasOuter && (
            <G>
              <Rect x="50" y="80" width="140" height="112" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
            </G>
          )}
        </G>

        {/* 7. 2D Outerwear Layer (Over Inner Top) */}
        {hasOuter && (
          <G onPress={() => onSelectSlot?.('OUTERWEAR')}>
            {isHoodie ? (
              <G>
                {/* Oversized fleece hoodie body */}
                <Path
                  d="M 66,86 C 66,86 102,78 120,78 C 138,78 174,86 174,86 L 168,194 L 72,194 Z"
                  fill="url(#outerGrad)"
                  stroke={adjustColor(outerColor, -30)}
                  strokeWidth="1.4"
                />
                {/* Full long sleeves */}
                <Path d="M 66,86 L 50,140 L 56,182 L 68,182 L 66,140 L 76,92 Z" fill="url(#outerGrad)" stroke={adjustColor(outerColor, -30)} strokeWidth="1.2" />
                <Path d="M 174,86 L 190,140 L 184,182 L 172,182 L 174,140 L 164,92 Z" fill="url(#outerGrad)" stroke={adjustColor(outerColor, -30)} strokeWidth="1.2" />
                {/* Ribbed sleeve cuffs */}
                <Rect x="54" y="176" width="14" height="6" rx="1" fill={adjustColor(outerColor, -15)} />
                <Rect x="172" y="176" width="14" height="6" rx="1" fill={adjustColor(outerColor, -15)} />
                {/* Kangaroo front pocket */}
                <Path d="M 88,148 L 152,148 L 146,186 L 94,186 Z" fill={adjustColor(outerColor, -12)} stroke={adjustColor(outerColor, -30)} strokeWidth="1.2" />
                {/* Hood collar & drawstring */}
                <Path d="M 98,80 C 110,94 130,94 142,80" fill="none" stroke={adjustColor(outerColor, -32)} strokeWidth="3" />
                <Line x1="112" y1="88" x2="110" y2="112" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                <Line x1="128" y1="88" x2="130" y2="112" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
              </G>
            ) : isBlazer ? (
              <G>
                {/* Tailored blazer body */}
                <Path
                  d="M 66,86 L 120,80 L 174,86 L 168,198 L 72,198 Z"
                  fill="url(#outerGrad)"
                  stroke={adjustColor(outerColor, -32)}
                  strokeWidth="1.4"
                />
                {/* Left/Right sleeves */}
                <Path d="M 66,86 L 50,140 L 56,182 L 68,182 L 66,140 L 76,92 Z" fill="url(#outerGrad)" stroke={adjustColor(outerColor, -32)} strokeWidth="1.2" />
                <Path d="M 174,86 L 190,140 L 184,182 L 172,182 L 174,140 L 164,92 Z" fill="url(#outerGrad)" stroke={adjustColor(outerColor, -32)} strokeWidth="1.2" />
                {/* Lapel cutouts showing inner top */}
                <Path d="M 98,84 L 120,132 L 88,136 Z" fill={adjustColor(outerColor, -14)} stroke={adjustColor(outerColor, -32)} strokeWidth="1" />
                <Path d="M 142,84 L 120,132 L 152,136 Z" fill={adjustColor(outerColor, -14)} stroke={adjustColor(outerColor, -32)} strokeWidth="1" />
                {/* Blazer button */}
                <Circle cx="120" cy="144" r="2.2" fill="#D4AF37" />
              </G>
            ) : (
              // Open casual jacket / bomber
              <G>
                <Path
                  d="M 66,86 L 120,80 L 174,86 L 166,190 L 74,190 Z"
                  fill="url(#outerGrad)"
                  stroke={adjustColor(outerColor, -30)}
                  strokeWidth="1.4"
                />
                <Path d="M 66,86 L 50,140 L 56,182 L 68,182 L 66,140 L 76,92 Z" fill="url(#outerGrad)" stroke={adjustColor(outerColor, -30)} strokeWidth="1.2" />
                <Path d="M 174,86 L 190,140 L 184,182 L 172,182 L 174,140 L 164,92 Z" fill="url(#outerGrad)" stroke={adjustColor(outerColor, -30)} strokeWidth="1.2" />
                {/* Zipper line running down */}
                <Line x1="120" y1="84" x2="120" y2="190" stroke="#1C1613" strokeWidth="2" strokeDasharray="3,1.5" />
              </G>
            )}

            {activeSlot === 'OUTERWEAR' && (
              <G>
                <Rect x="46" y="76" width="148" height="126" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
              </G>
            )}
          </G>
        )}

        {/* 8. Accessories */}
        <G onPress={() => onSelectSlot?.('ACCESSORIES')}>
          {/* Smartwatch / Watch on left wrist */}
          {hasWatch && (
            <G>
              <Rect x="58" y="174" width="10" height="5" rx="1.5" fill="#1C1613" />
              <Rect x="60" y="173" width="6" height="7" rx="1.5" fill={accColor} />
            </G>
          )}

          {/* Necklace / Chain */}
          {hasNecklace && (
            <G>
              <Path d="M 112,82 C 112,98 128,98 128,82" fill="none" stroke={accColor} strokeWidth="1.8" />
              <Circle cx="120" cy="94" r="2.2" fill={accColor} />
            </G>
          )}

          {/* Airpods */}
          {hasAirpods && (
            <G>
              <Circle cx="95" cy="48" r="2.2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
              <Line x1="95" y1="48" x2="95" y2="54" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              <Circle cx="145" cy="48" r="2.2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
              <Line x1="145" y1="48" x2="145" y2="54" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </G>
          )}

          {/* Sunglasses */}
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

        {/* 9. Foreground Hair Layer - SCULPTED GEOMETRY (NO BALD TOP & NO PONYTAIL FOR MALE) */}
        {gender === 'male' ? (
          <G>
            {resolvedHairStyle === 'male_comma' ? (
              // Male Comma Hair
              <G>
                <Path
                  d="M 95,43 C 93,18 105,14 120,14 C 136,14 148,18 146,43 C 138,32 130,28 124,30 C 114,28 104,36 110,42 C 104,38 98,38 95,43 Z"
                  fill="url(#hairGrad)"
                />
                {/* Comma curl strand over forehead */}
                <Path
                  d="M 124,30 C 120,37 112,42 110,40 C 114,35 119,32 124,30 Z"
                  fill={adjustColor(resolvedHairColor, 16)}
                />
                <Path d="M 95,43 L 95,48 L 98,46 Z" fill={hairShade} />
                <Path d="M 146,43 L 146,48 L 143,46 Z" fill={hairShade} />
              </G>
            ) : resolvedHairStyle === 'male_spiky' ? (
              // Male Spiky Crop
              <G>
                <Path
                  d="M 96,42 C 94,22 102,15 108,13 L 112,17 L 116,12 L 122,17 L 126,13 L 132,18 L 138,15 C 144,22 146,30 145,42 C 138,32 134,35 128,33 C 122,35 118,31 112,34 C 106,31 101,36 96,42 Z"
                  fill="url(#hairGrad)"
                />
                <Path d="M 96,42 L 96,48 L 99,45 Z" fill={hairShade} />
                <Path d="M 145,42 L 145,48 L 142,45 Z" fill={hairShade} />
              </G>
            ) : resolvedHairStyle === 'male_curly' ? (
              // Male Wavy/Curly Top Fade
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
                <Path
                  d="M 112,31 Q 116,36 119,37"
                  fill="none"
                  stroke={adjustColor(resolvedHairColor, 22)}
                  strokeWidth="1.2"
                />
                <Path
                  d="M 128,31 Q 124,36 121,37"
                  fill="none"
                  stroke={adjustColor(resolvedHairColor, 22)}
                  strokeWidth="1.2"
                />
                {/* Clean temple tapers strictly above y=50 */}
                <Path d="M 95,44 L 95,49 L 98,46 Z" fill={hairShade} />
                <Path d="M 145,44 L 145,49 L 142,46 Z" fill={hairShade} />
              </G>
            )}
          </G>
        ) : (
          <G>
            {resolvedHairStyle === 'female_bob' ? (
              // Female Chin-Length Bob
              <G>
                <Path
                  d="M 95,44 C 92,18 106,14 120,14 C 134,14 148,18 145,44 C 148,56 148,70 142,76 C 138,72 137,58 136,50 C 132,36 126,33 120,34 C 114,33 108,36 104,50 C 103,58 102,72 98,76 C 92,70 92,56 95,44 Z"
                  fill="url(#hairGrad)"
                />
                <Path d="M 104,36 Q 112,40 120,38" fill="none" stroke={adjustColor(resolvedHairColor, 18)} strokeWidth="1" />
                <Path d="M 136,36 Q 128,40 120,38" fill="none" stroke={adjustColor(resolvedHairColor, 18)} strokeWidth="1" />
              </G>
            ) : resolvedHairStyle === 'female_ponytail' ? (
              // Female High Ponytail
              <G>
                <Path
                  d="M 96,44 C 94,22 106,15 120,15 C 134,15 146,22 144,44 C 138,34 130,32 120,33 C 110,32 102,34 96,44 Z"
                  fill="url(#hairGrad)"
                />
                <Circle cx="136" cy="24" r="3.2" fill="#F07E57" />
              </G>
            ) : resolvedHairStyle === 'female_buns' ? (
              // Female Space Buns
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

      {/* Interactive Touch Overlay Zones (only active in interactive mode) */}
      {!staticPreview && (
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
                  Selected: {SLOT_LABELS[activeSlot]} · Tap piece to customize
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
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compact: {
    height: 310,
  },
  staticPreview: {
    height: '100%',
    width: '100%',
  },
  stage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
