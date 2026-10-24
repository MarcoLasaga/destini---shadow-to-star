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
}: Mannequin2DProps) {
  const { mannequinSkinTone } = useSettings();

  // Ensure human skin tone is never green (green is only for Mel the chameleon)
  const resolvedSkinTone = useMemo(() => {
    const raw = (mannequinSkinTone || '').trim();
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
  }, [mannequinSkinTone]);

  const skinShade = useMemo(() => adjustColor(resolvedSkinTone, -16), [resolvedSkinTone]);
  const skinHighlight = useMemo(() => adjustColor(resolvedSkinTone, 14), [resolvedSkinTone]);

  // Gender & Anatomy
  const gender = profile?.gender === 'female' ? 'female' : 'male';
  const heightCm = Number(profile?.heightCm) || 168;
  const weightKg = Number(profile?.weightKg) || 62;
  const fitPref = (profile?.fitPreference || 'regular').toLowerCase();
  const isBaggy = fitPref.includes('baggy') || fitPref.includes('oversized');
  const isSlim = fitPref.includes('slim') || fitPref.includes('tailored');

  const heightScale = clamp(heightCm / 168, 0.90, 1.10);
  const widthScale = clamp((weightKg / 62) * (isBaggy ? 1.12 : isSlim ? 0.92 : 1.0), 0.85, 1.22);

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

  // Animation values
  const breathAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(1)).current;

  // Continuous breathing loop (translateY 0 -> -4 -> 0 over 2400ms)
  useEffect(() => {
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
  }, [breathAnim]);

  // Spring pop on equip / items change
  useEffect(() => {
    bounceAnim.setValue(0.94);
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 4,
      tension: 75,
      useNativeDriver: true,
    }).start();
  }, [items, bounceAnim]);

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

  return (
    <View style={[styles.container, compact && styles.compact]}>
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
        <Svg width="100%" height="100%" viewBox="0 0 240 400" preserveAspectRatio="xMidYMid meet">
          <Defs>
            {/* Skin Gradient */}
            <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={skinHighlight} />
              <Stop offset="70%" stopColor={resolvedSkinTone} />
              <Stop offset="100%" stopColor={skinShade} />
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
          <G transform={`translate(120, 200) scale(${widthScale}, ${heightScale}) translate(-120, -200)`}>
            {/* 1. Female Long Hair (Back Layer) */}
            {gender === 'female' && (
              <G>
                <Path
                  d="M 98,46 C 84,62 80,94 84,124 C 92,126 102,108 104,82 C 104,68 100,55 98,46 Z"
                  fill="#2B1D16"
                />
                <Path
                  d="M 142,46 C 156,62 160,94 156,124 C 148,126 138,108 136,82 C 136,68 140,55 142,46 Z"
                  fill="#2B1D16"
                />
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

              {/* Head */}
              <Circle
                cx="120"
                cy="46"
                r="23"
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

              {/* Arms & Hands */}
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

              {/* Legs (Connect all the way down to Shoes at y=335) */}
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

            {/* 3. Facial Features */}
            <G>
              {/* Eyebrows */}
              <Path d="M 106,37 Q 112,34 117,37" fill="none" stroke="#2B1D16" strokeWidth="1.6" strokeLinecap="round" />
              <Path d="M 123,37 Q 128,34 134,37" fill="none" stroke="#2B1D16" strokeWidth="1.6" strokeLinecap="round" />

              {/* Eyes with catchlights */}
              <Circle cx="112" cy="45" r="2.5" fill="#241812" />
              <Circle cx="111.4" cy="44.2" r="0.8" fill="#FFFFFF" />
              <Circle cx="128" cy="45" r="2.5" fill="#241812" />
              <Circle cx="127.4" cy="44.2" r="0.8" fill="#FFFFFF" />

              {/* Soft nose */}
              <Path d="M 120,46 L 118.5,52 L 121.5,52" fill="none" stroke={skinShade} strokeWidth="1.1" strokeLinecap="round" />

              {/* Soft smile */}
              <Path d="M 116,56 Q 120,59 124,56" fill="none" stroke="#C47362" strokeWidth="1.5" strokeLinecap="round" />

              {/* Soft blush */}
              <Ellipse cx="106" cy="51" rx="4" ry="2" fill="rgba(240, 110, 110, 0.22)" />
              <Ellipse cx="134" cy="51" rx="4" ry="2" fill="rgba(240, 110, 110, 0.22)" />
            </G>

            {/* 4. Connected Footwear (y="332" to y="362") */}
            <G onPress={() => onSelectSlot?.('SHOES')}>
              {/* Left Shoe */}
              <G>
                {/* Upper Body */}
                <Path
                  d="M 76,332 L 115,332 L 115,356 L 66,356 C 62,352 66,342 76,332 Z"
                  fill="url(#shoeGrad)"
                  stroke={adjustColor(shoesColor, -35)}
                  strokeWidth="1.2"
                />
                {/* Thick Sneaker Midsole / Sole */}
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
                {/* Sneaker Laces / Stitch */}
                <Line x1="84" y1="337" x2="96" y2="343" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
                <Line x1="88" y1="343" x2="100" y2="349" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
              </G>

              {/* Right Shoe */}
              <G>
                {/* Upper Body */}
                <Path
                  d="M 125,332 L 164,332 C 174,342 178,352 174,356 L 125,356 Z"
                  fill="url(#shoeGrad)"
                  stroke={adjustColor(shoesColor, -35)}
                  strokeWidth="1.2"
                />
                {/* Thick Sneaker Midsole / Sole */}
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
                {/* Sneaker Laces / Stitch */}
                <Line x1="144" y1="343" x2="156" y2="337" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
                <Line x1="140" y1="349" x2="152" y2="343" stroke={adjustColor(shoesColor, -25)} strokeWidth="1.4" strokeLinecap="round" />
              </G>

              {/* Active selection outline for shoes */}
              {activeSlot === 'SHOES' && (
                <G>
                  <Rect x="60" y="328" width="120" height="38" rx="8" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
                </G>
              )}
            </G>

            {/* 5. 2D Bottoms (Full 2-Leg Trouser Silhouette y="184" to y="336") */}
            <G onPress={() => onSelectSlot?.('BOTTOM')}>
              {isShorts ? (
                // Shorts template
                <G>
                  <Path
                    d="M 84,184 L 156,184 L 160,256 L 125,256 L 120,224 L 115,256 L 80,256 Z"
                    fill="url(#bottomGrad)"
                    stroke={adjustColor(bottomColor, -30)}
                    strokeWidth="1.3"
                  />
                  {/* Waistband & Fly */}
                  <Rect x="83" y="184" width="74" height="10" rx="1.5" fill={adjustColor(bottomColor, -14)} stroke={adjustColor(bottomColor, -30)} strokeWidth="1" />
                  <Line x1="120" y1="184" x2="120" y2="216" stroke={adjustColor(bottomColor, -35)} strokeWidth="1.3" />
                </G>
              ) : isSkirt ? (
                // Skirt template
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
                // Full Two-Leg Trouser / Jean Silhouette (Exact same color on both legs!)
                <G>
                  <Path
                    d="M 84,184 L 156,184 L 164,336 L 125,336 L 120,224 L 115,336 L 76,336 Z"
                    fill="url(#bottomGrad)"
                    stroke={adjustColor(bottomColor, -32)}
                    strokeWidth="1.4"
                  />

                  {/* Waistband */}
                  <Rect
                    x="83"
                    y="184"
                    width="74"
                    height="11"
                    rx="1.5"
                    fill={adjustColor(bottomColor, -12)}
                    stroke={adjustColor(bottomColor, -32)}
                    strokeWidth="1"
                  />

                  {/* Belt loops */}
                  <Rect x="94" y="184" width="3" height="11" fill={adjustColor(bottomColor, -25)} />
                  <Rect x="118.5" y="184" width="3" height="11" fill={adjustColor(bottomColor, -25)} />
                  <Rect x="143" y="184" width="3" height="11" fill={adjustColor(bottomColor, -25)} />

                  {/* Center Fly Seam */}
                  <Line x1="120" y1="184" x2="120" y2="218" stroke={adjustColor(bottomColor, -38)} strokeWidth="1.4" />
                  <Path d="M 120,218 Q 124,222 124,210" fill="none" stroke={adjustColor(bottomColor, -38)} strokeWidth="1.2" />

                  {/* Left & Right Pockets */}
                  <Path d="M 84,196 Q 96,198 100,186" fill="none" stroke={adjustColor(bottomColor, -35)} strokeWidth="1.2" />
                  <Path d="M 156,196 Q 144,198 140,186" fill="none" stroke={adjustColor(bottomColor, -35)} strokeWidth="1.2" />

                  {/* Knee / Crease Lines */}
                  <Line x1="88" y1="262" x2="108" y2="262" stroke={adjustColor(bottomColor, -15)} strokeWidth="0.8" opacity="0.6" />
                  <Line x1="132" y1="262" x2="152" y2="262" stroke={adjustColor(bottomColor, -15)} strokeWidth="0.8" opacity="0.6" />

                  {/* Cargo Pockets (if cargo pants) */}
                  {isCargo && (
                    <G>
                      <Rect x="73" y="246" width="10" height="24" rx="2" fill={adjustColor(bottomColor, -16)} stroke={adjustColor(bottomColor, -35)} strokeWidth="1" />
                      <Rect x="72" y="244" width="12" height="6" rx="1.5" fill={adjustColor(bottomColor, -24)} stroke={adjustColor(bottomColor, -35)} strokeWidth="1" />
                      <Rect x="157" y="246" width="10" height="24" rx="2" fill={adjustColor(bottomColor, -16)} stroke={adjustColor(bottomColor, -35)} strokeWidth="1" />
                      <Rect x="156" y="244" width="12" height="6" rx="1.5" fill={adjustColor(bottomColor, -24)} stroke={adjustColor(bottomColor, -35)} strokeWidth="1" />
                    </G>
                  )}
                </G>
              )}

              {/* Active selection outline for bottoms */}
              {activeSlot === 'BOTTOM' && (
                <G>
                  <Rect x="72" y="180" width="96" height="158" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
                </G>
              )}
            </G>

            {/* 6. 2D Tops (T-Shirt, Polo, Button-Down, Long Sleeve) */}
            <G onPress={() => onSelectSlot?.('TOP')}>
              {/* Torso & Sleeves */}
              <Path
                d={`M 72,86 L 56,132 L 68,136 L 76,112 L 78,${isCropTop ? 152 : 188} L 162,${isCropTop ? 152 : 188} L 164,112 L 172,136 L 184,132 L 168,86 Z`}
                fill="url(#topGrad)"
                stroke={adjustColor(topColor, -32)}
                strokeWidth="1.3"
              />

              {/* Collar styling */}
              {isPolo || isButtonDown ? (
                <G>
                  {/* Folded Polo / Oxford Collars */}
                  <Path
                    d="M 102,78 L 120,94 L 138,78 L 120,84 Z"
                    fill={adjustColor(topColor, 12)}
                    stroke={adjustColor(topColor, -35)}
                    strokeWidth="1.3"
                  />
                  {/* Center Placket */}
                  <Line x1="120" y1="94" x2="120" y2="186" stroke={adjustColor(topColor, -32)} strokeWidth="1.4" />
                  <Circle cx="120" cy="110" r="1.5" fill={adjustColor(topColor, -40)} />
                  <Circle cx="120" cy="130" r="1.5" fill={adjustColor(topColor, -40)} />
                  <Circle cx="120" cy="150" r="1.5" fill={adjustColor(topColor, -40)} />
                </G>
              ) : (
                <G>
                  {/* Crewneck / V-Neckline Ribbing */}
                  <Path
                    d="M 106,78 Q 120,90 134,78"
                    fill="none"
                    stroke={adjustColor(topColor, -35)}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </G>
              )}

              {/* Bottom hemline seam */}
              <Line x1="78" y1={isCropTop ? 150 : 186} x2="162" y2={isCropTop ? 150 : 186} stroke={adjustColor(topColor, -25)} strokeWidth="1" />

              {/* Active selection outline for tops (when no outerwear active) */}
              {activeSlot === 'TOP' && !hasOuter && (
                <G>
                  <Rect x="54" y="80" width="132" height="110" rx="10" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
                </G>
              )}
            </G>

            {/* 7. 2D Hoodie / Outerwear (Layered Over Top) */}
            {hasOuter && (
              <G onPress={() => onSelectSlot?.('OUTERWEAR')}>
                {isHoodie ? (
                  // Hoodie / Zip-Hoodie
                  <G>
                    {/* Sculpted 2D hood cradling neck */}
                    <Path
                      d="M 88,78 C 88,60 152,60 152,78 C 146,88 94,88 88,78 Z"
                      fill={adjustColor(outerColor, -18)}
                      stroke={adjustColor(outerColor, -35)}
                      strokeWidth="1.4"
                    />

                    {/* Dropped shoulders, torso & long sleeves with ribbed cuffs */}
                    <Path
                      d="M 68,84 L 52,142 L 58,178 L 68,178 L 74,136 L 76,188 L 164,188 L 166,136 L 172,178 L 182,178 L 188,142 L 172,84 Z"
                      fill="url(#outerGrad)"
                      stroke={adjustColor(outerColor, -32)}
                      strokeWidth="1.4"
                    />

                    {/* Ribbed cuffs rx="4" */}
                    <Rect x="58" y="174" width="10" height="6" rx="3" fill={adjustColor(outerColor, -16)} stroke={adjustColor(outerColor, -35)} strokeWidth="0.8" />
                    <Rect x="172" y="174" width="10" height="6" rx="3" fill={adjustColor(outerColor, -16)} stroke={adjustColor(outerColor, -35)} strokeWidth="0.8" />

                    {/* Ribbed waistband hem */}
                    <Rect x="76" y="186" width="88" height="10" rx="2" fill={adjustColor(outerColor, -16)} stroke={adjustColor(outerColor, -35)} strokeWidth="1" />

                    {/* Front kangaroo pocket M 92,152 L 148,152 L 154,178 L 86,178 Z */}
                    <Path
                      d="M 92,152 L 148,152 L 154,178 L 86,178 Z"
                      fill={adjustColor(outerColor, 6)}
                      stroke={adjustColor(outerColor, -32)}
                      strokeWidth="1.3"
                    />

                    {/* Hoodie drawstrings: x1="110" y1="84" x2="110" y2="114" and x1="130" y1="84" x2="130" y2="114" */}
                    <Line x1="110" y1="84" x2="110" y2="114" stroke="#ECECE8" strokeWidth="1.8" strokeLinecap="round" />
                    <Circle cx="110" cy="115" r="1.3" fill="#D4AF37" />
                    <Line x1="130" y1="84" x2="130" y2="114" stroke="#ECECE8" strokeWidth="1.8" strokeLinecap="round" />
                    <Circle cx="130" cy="115" r="1.3" fill="#D4AF37" />
                  </G>
                ) : (
                  // Blazer / Jacket / Coat / Cardigan (Open front showing base Top underneath!)
                  <G>
                    {/* Left Jacket Panel */}
                    <Path
                      d="M 68,84 L 52,142 L 58,178 L 68,178 L 74,136 L 76,192 L 108,192 L 112,126 L 102,82 Z"
                      fill="url(#outerGrad)"
                      stroke={adjustColor(outerColor, -35)}
                      strokeWidth="1.4"
                    />
                    {/* Right Jacket Panel */}
                    <Path
                      d="M 172,84 L 188,142 L 182,178 L 172,178 L 166,136 L 164,192 L 132,192 L 128,126 L 138,82 Z"
                      fill="url(#outerGrad)"
                      stroke={adjustColor(outerColor, -35)}
                      strokeWidth="1.4"
                    />

                    {/* Blazer Lapels */}
                    {isBlazer && (
                      <G>
                        <Path d="M 102,82 L 114,130 L 104,138 L 108,190" fill="none" stroke={adjustColor(outerColor, 20)} strokeWidth="2" />
                        <Path d="M 138,82 L 126,130 L 136,138 L 132,190" fill="none" stroke={adjustColor(outerColor, 20)} strokeWidth="2" />
                        {/* Pocket Flaps */}
                        <Rect x="82" y="162" width="22" height="5" rx="1.5" fill={adjustColor(outerColor, -15)} stroke={adjustColor(outerColor, -35)} strokeWidth="1" />
                        <Rect x="136" y="162" width="22" height="5" rx="1.5" fill={adjustColor(outerColor, -15)} stroke={adjustColor(outerColor, -35)} strokeWidth="1" />
                      </G>
                    )}

                    {/* Jacket Zipper / Fasteners if casual jacket */}
                    {isJacket && (
                      <G>
                        <Line x1="112" y1="126" x2="112" y2="190" stroke="#C2C7BD" strokeWidth="1.4" strokeDasharray="2,2" />
                        <Line x1="128" y1="126" x2="128" y2="190" stroke="#C2C7BD" strokeWidth="1.4" strokeDasharray="2,2" />
                      </G>
                    )}
                  </G>
                )}

                {/* Active selection outline for outerwear */}
                {activeSlot === 'OUTERWEAR' && (
                  <G>
                    <Rect x="50" y="76" width="140" height="122" rx="12" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
                  </G>
                )}
              </G>
            )}

            {/* 8. Anatomical Accessories */}
            <G onPress={() => onSelectSlot?.('ACCESSORIES')}>
              {/* Belt on waist y="182" */}
              {hasBelt && (
                <G>
                  <Rect x="83" y="182" width="74" height="8" rx="2" fill="#2E241E" stroke="#1A1410" strokeWidth="1" />
                  <Rect x="115" y="180" width="10" height="12" rx="2" fill="#D4AF37" stroke="#A88725" strokeWidth="1" />
                </G>
              )}

              {/* Chain necklace on collarbone M 104,80 Q 120,98 136,80 */}
              {hasNecklace && (
                <Path
                  d="M 104,80 Q 120,98 136,80"
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              )}

              {/* Watch on left wrist x="64" y="182" */}
              {hasWatch && (
                <G>
                  {/* Watch strap */}
                  <Rect x="60" y="180" width="8" height="12" rx="1.5" fill="#1C1E24" stroke="#000" strokeWidth="0.8" />
                  {/* Watch face */}
                  <Circle cx="64" cy="186" r="4.5" fill="#C5CCD6" stroke="#1C1E24" strokeWidth="1.2" />
                  <Circle cx="64" cy="186" r="3" fill="#0D1117" />
                </G>
              )}

              {/* Airpods at ears: cx="95" cy="48" and cx="145" cy="48" */}
              {hasAirpods && (
                <G>
                  <Circle cx="95" cy="48" r="2.2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
                  <Line x1="95" y1="48" x2="95" y2="54" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                  <Circle cx="145" cy="48" r="2.2" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
                  <Line x1="145" y1="48" x2="145" y2="54" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                </G>
              )}

              {/* Sunglasses on face y="42" */}
              {hasSunglasses && (
                <G>
                  <Rect x="103" y="40" width="14" height="10" rx="3" fill="#12151B" stroke="#D4AF37" strokeWidth="1.2" />
                  <Rect x="123" y="40" width="14" height="10" rx="3" fill="#12151B" stroke="#D4AF37" strokeWidth="1.2" />
                  <Line x1="117" y1="43" x2="123" y2="43" stroke="#D4AF37" strokeWidth="1.5" />
                  <Line x1="96" y1="42" x2="103" y2="42" stroke="#D4AF37" strokeWidth="1.2" />
                  <Line x1="137" y1="42" x2="144" y2="42" stroke="#D4AF37" strokeWidth="1.2" />
                </G>
              )}

              {/* Active selection outline for accessories */}
              {activeSlot === 'ACCESSORIES' && (
                <G>
                  <Circle cx="120" cy="50" r="34" fill="none" stroke="#F07E57" strokeWidth="2" strokeDasharray="4,3" />
                </G>
              )}
            </G>

            {/* 9. Foreground Hair Layer */}
            {gender === 'male' ? (
              // Male: Textured two-block / wolf-cut hair framing forehead and temples (fill="#2B1D16")
              <G>
                <Path
                  d="M 96,48 C 94,20 106,16 120,16 C 134,16 146,20 144,48 C 144,42 138,30 133,36 C 128,28 123,35 120,30 C 117,35 112,28 107,36 C 102,30 96,42 96,48 Z"
                  fill="#2B1D16"
                />
                {/* Sideburns framing temples */}
                <Path d="M 96,46 L 96,56 L 99,52 Z" fill="#2B1D16" />
                <Path d="M 144,46 L 144,56 L 141,52 Z" fill="#2B1D16" />
              </G>
            ) : (
              // Female: Soft curtain front bangs tucked behind ears
              <G>
                <Path
                  d="M 98,46 C 98,22 142,22 142,46 C 140,40 134,30 120,32 C 106,30 100,40 98,46 Z"
                  fill="#2B1D16"
                />
                {/* Soft wispy strands tucked behind ears */}
                <Path d="M 98,36 Q 106,42 112,38 Q 104,34 100,32 Z" fill="#3D291F" />
                <Path d="M 142,36 Q 134,42 128,38 Q 136,34 140,32 Z" fill="#3D291F" />
              </G>
            )}
          </G>
        </Svg>
      </Animated.View>

      {/* Interactive Touch Overlay Zones */}
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

      {/* Subtle pill badge at the bottom indicating active slot or tap hint */}
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
