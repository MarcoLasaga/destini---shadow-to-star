import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';

export function isPlaceholderGarmentImage(uri?: string | null): boolean {
  if (!uri || !uri.trim()) return true;
  const lower = uri.toLowerCase();
  return (
    lower.startsWith('illustration://') ||
    lower.includes('picsum.photos') ||
    lower.includes('via.placeholder.com') ||
    lower.includes('placehold.co')
  );
}

export function resolveColorHex(colorName?: string | null, fallbackHex?: string): string {
  if (fallbackHex && /^#[0-9A-Fa-f]{6}$/.test(fallbackHex)) return fallbackHex;
  const c = (colorName || '').toLowerCase();
  if (c.includes('white') || c.includes('ivory')) return '#F7F7F5';
  if (c.includes('charcoal') || c.includes('slate')) return '#36393F';
  if (c.includes('black') || c.includes('onyx')) return '#1E1E24';
  if (c.includes('navy') || c.includes('indigo')) return '#1D2D50';
  if (c.includes('blue') || c.includes('cobalt') || c.includes('denim')) return '#3B6EA5';
  if (c.includes('khaki') || c.includes('tan') || c.includes('camel') || c.includes('beige') || c.includes('sand')) return '#C8B08A';
  if (c.includes('cream') || c.includes('ecru')) return '#F2EAD3';
  if (c.includes('gray') || c.includes('grey') || c.includes('silver') || c.includes('heather')) return '#8C929C';
  if (c.includes('brown') || c.includes('espresso') || c.includes('leather')) return '#5C4033';
  if (c.includes('green') || c.includes('olive') || c.includes('sage')) return '#4E6E58';
  if (c.includes('red') || c.includes('burgundy') || c.includes('maroon')) return '#8B2635';
  if (c.includes('pink') || c.includes('blush')) return '#E6A8B8';
  if (c.includes('yellow') || c.includes('mustard') || c.includes('gold')) return '#D9B44A';
  if (c.includes('purple') || c.includes('plum') || c.includes('lilac')) return '#5B3278';
  return '#4A5568';
}

export type GarmentSilhouetteType =
  | 'polo'
  | 'tshirt'
  | 'blazer'
  | 'hoodie'
  | 'trousers'
  | 'shorts'
  | 'shoes'
  | 'watch'
  | 'bag';

export function detectGarmentSilhouette(name?: string | null, category?: string | null): GarmentSilhouetteType {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  if (/\b(watch|smartwatch|casio|wristwatch|rolex|seiko)\b/.test(n)) return 'watch';
  if (/\b(bag|tote|backpack|briefcase|purse)\b/.test(n)) return 'bag';
  if (/\b(short|shorts)\b/.test(n)) return 'shorts';
  if (/\b(hoodie|sweatshirt|pullover)\b/.test(n)) return 'hoodie';
  if (/\b(blazer|suit|jacket|coat|cardigan|overshirt)\b/.test(n)) return 'blazer';
  if (/\b(polo|oxford|button|collar|dress shirt|blouse|shirt)\b/.test(n) && !/\bt-shirt\b/.test(n)) return 'polo';
  if (/\b(t-shirt|tee|crewneck|top|tank)\b/.test(n)) return 'tshirt';
  if (/\b(jean|trouser|chino|pant|slack|jogger|legging|bottom)\b/.test(n)) return 'trousers';
  if (/\b(shoe|sneaker|loafer|boot|oxford shoe|flat|slipper|sandal|heel)\b/.test(n)) return 'shoes';

  if (c.includes('accessor')) return 'watch';
  if (c.includes('outer')) return 'blazer';
  if (c.includes('bottom')) return 'trousers';
  if (c.includes('shoe')) return 'shoes';
  return 'polo';
}

interface GarmentIllustrationProps {
  name?: string | null;
  category?: string | null;
  color?: string | null;
  hexColor?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function GarmentIllustration({
  name,
  category,
  color,
  hexColor,
  size = 64,
  style,
}: GarmentIllustrationProps) {
  const silhouette = detectGarmentSilhouette(name, category);
  const fill = resolveColorHex(color || name, hexColor);
  const isVeryLight = fill === '#F7F7F5' || fill === '#F2EAD3' || fill === '#E6A8B8' || fill === '#D9B44A';
  const stroke = isVeryLight ? '#2D2A32' : '#E2E8F0';
  const detailStroke = isVeryLight ? '#4A4453' : '#CBD5E1';
  const bg = isVeryLight ? '#EDE9FE' : '#F4F1EA';

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: bg }, style]}>
      <Svg width={size * 0.84} height={size * 0.84} viewBox="0 0 100 100">
        {silhouette === 'polo' && (
          <G>
            {/* Collared Polo / Oxford Shirt with Placket & Buttons */}
            <Path
              d="M32 20 L20 26 L10 46 L23 53 L28 38 L28 86 L72 86 L72 38 L77 53 L90 46 L80 26 L68 20 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            {/* Shirt Collar Flaps */}
            <Path
              d="M32 20 L43 32 L50 25 L38 16 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            <Path
              d="M68 20 L57 32 L50 25 L62 16 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
            {/* Button Placket */}
            <Rect
              x="47"
              y="25"
              width="6"
              height="24"
              rx="2"
              fill={fill}
              stroke={detailStroke}
              strokeWidth={1.8}
            />
            <Circle cx="50" cy="31" r="1.5" fill={detailStroke} />
            <Circle cx="50" cy="37" r="1.5" fill={detailStroke} />
            <Circle cx="50" cy="43" r="1.5" fill={detailStroke} />
          </G>
        )}

        {silhouette === 'tshirt' && (
          <G>
            {/* Crewneck T-Shirt */}
            <Path
              d="M33 20 C39 27 61 27 67 20 L82 27 L91 45 L77 52 L72 39 L72 85 L28 85 L28 39 L23 52 L9 45 L18 27 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            {/* Crewneck Ribbing */}
            <Path
              d="M35 22 C41 29 59 29 65 22"
              fill="none"
              stroke={detailStroke}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          </G>
        )}

        {silhouette === 'blazer' && (
          <G>
            {/* Inner Crisp Shirt V-insert */}
            <Path d="M38 20 L50 52 L62 20 Z" fill="#FFFFFF" stroke="#2D2A32" strokeWidth={1.8} />
            {/* Tailored Lapel Blazer / Jacket */}
            <Path
              d="M34 18 L18 25 L10 78 L24 80 L28 42 L28 86 L49 86 L49 50 L38 20 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            <Path
              d="M66 18 L82 25 L90 78 L76 80 L72 42 L72 86 L51 86 L51 50 L62 20 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {/* Notched Lapels */}
            <Path
              d="M38 20 L31 36 L49 52"
              fill="none"
              stroke={detailStroke}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            <Path
              d="M62 20 L69 36 L51 52"
              fill="none"
              stroke={detailStroke}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />
            {/* Blazer Buttons & Pocket Welt */}
            <Circle cx="49" cy="58" r="2" fill={detailStroke} />
            <Circle cx="49" cy="67" r="2" fill={detailStroke} />
            <Line x1="57" y1="40" x2="66" y2="40" stroke={detailStroke} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}

        {silhouette === 'hoodie' && (
          <G>
            {/* Pullover Hoodie with Hood, Drawstrings & Kangaroo Pocket */}
            <Path
              d="M34 26 C32 10 68 10 66 26 L81 32 L90 76 L77 79 L72 44 L72 86 L28 86 L28 44 L23 79 L10 76 L19 32 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {/* Hood Opening */}
            <Path
              d="M39 24 C39 15 61 15 61 24 C56 29 44 29 39 24 Z"
              fill={isVeryLight ? '#D4D4D8' : '#111827'}
              stroke={detailStroke}
              strokeWidth={1.8}
            />
            {/* Drawstrings */}
            <Line x1="45" y1="28" x2="45" y2="42" stroke={detailStroke} strokeWidth={2} strokeLinecap="round" />
            <Line x1="55" y1="28" x2="55" y2="42" stroke={detailStroke} strokeWidth={2} strokeLinecap="round" />
            {/* Kangaroo Pocket */}
            <Path
              d="M34 62 L66 62 L70 80 L30 80 Z"
              fill="none"
              stroke={detailStroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </G>
        )}

        {silhouette === 'trousers' && (
          <G>
            {/* Tailored Chinos / Trousers / Jeans */}
            <Path
              d="M28 14 L72 14 L76 88 L54 88 L50 38 L46 88 L24 88 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            {/* Waistband & Belt Loops */}
            <Line x1="28" y1="22" x2="72" y2="22" stroke={detailStroke} strokeWidth={2.2} />
            <Line x1="38" y1="14" x2="38" y2="22" stroke={detailStroke} strokeWidth={2.2} />
            <Line x1="50" y1="14" x2="50" y2="35" stroke={detailStroke} strokeWidth={2} />
            <Line x1="62" y1="14" x2="62" y2="22" stroke={detailStroke} strokeWidth={2.2} />
            {/* Side Pockets */}
            <Path d="M29 24 Q37 32 39 22" fill="none" stroke={detailStroke} strokeWidth={1.8} />
            <Path d="M71 24 Q63 32 61 22" fill="none" stroke={detailStroke} strokeWidth={1.8} />
          </G>
        )}

        {silhouette === 'shorts' && (
          <G>
            {/* Tailored / Athletic Shorts */}
            <Path
              d="M26 20 L74 20 L78 68 L53 68 L50 42 L47 68 L22 68 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            <Line x1="26" y1="28" x2="74" y2="28" stroke={detailStroke} strokeWidth={2.2} />
            <Line x1="50" y1="20" x2="50" y2="40" stroke={detailStroke} strokeWidth={2} />
          </G>
        )}

        {silhouette === 'shoes' && (
          <G>
            {/* Clean Low-Top Sneaker / Loafer Profile */}
            <Path
              d="M14 66 L14 42 C22 42 30 47 36 36 L50 38 C58 48 72 52 84 54 C90 55 90 66 88 68 L14 68 Z"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.6}
              strokeLinejoin="round"
            />
            {/* Crisp Rubber Midsole */}
            <Rect
              x="12"
              y="66"
              width="78"
              height="9"
              rx="4"
              fill="#FFFFFF"
              stroke="#2D2A32"
              strokeWidth={2.2}
            />
            {/* Laces / Vamp Detail */}
            <Line x1="45" y1="42" x2="52" y2="38" stroke={detailStroke} strokeWidth={2.2} strokeLinecap="round" />
            <Line x1="52" y1="46" x2="59" y2="42" stroke={detailStroke} strokeWidth={2.2} strokeLinecap="round" />
            <Line x1="59" y1="50" x2="66" y2="46" stroke={detailStroke} strokeWidth={2.2} strokeLinecap="round" />
          </G>
        )}

        {silhouette === 'watch' && (
          <G>
            {/* Wristwatch / Smartwatch Silhouette */}
            <Rect x="40" y="10" width="20" height="24" rx="4" fill={fill} stroke={stroke} strokeWidth={2.4} />
            <Rect x="40" y="66" width="20" height="24" rx="4" fill={fill} stroke={stroke} strokeWidth={2.4} />
            <Rect
              x="29"
              y="29"
              width="42"
              height="42"
              rx="12"
              fill="#1E1E24"
              stroke={stroke}
              strokeWidth={2.8}
            />
            <Circle cx="50" cy="50" r="14" fill="#2A2B36" stroke="#A78BFA" strokeWidth={1.8} />
            {/* Watch Hands */}
            <Line x1="50" y1="50" x2="50" y2="41" stroke="#FBF5A7" strokeWidth={2.4} strokeLinecap="round" />
            <Line x1="50" y1="50" x2="58" y2="50" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
          </G>
        )}

        {silhouette === 'bag' && (
          <G>
            {/* Structured Tote / Bag Silhouette */}
            <Path
              d="M37 34 C37 16 63 16 63 34"
              fill="none"
              stroke={stroke}
              strokeWidth={3.2}
              strokeLinecap="round"
            />
            <Rect
              x="22"
              y="34"
              width="56"
              height="48"
              rx="8"
              fill={fill}
              stroke={stroke}
              strokeWidth={2.6}
            />
            <Circle cx="50" cy="48" r="3" fill={detailStroke} />
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

