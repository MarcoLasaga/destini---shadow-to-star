import React from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { getApiUrl } from '../services/apiConfig';
import { colorNameToHex } from '../services/outfitRecommendationService';

export function resolveGarmentImageUrl(item: any): string | null {
  if (!item) return null;
  const raw =
    item.cutoutDataUri ||
    item.cutout_data_uri ||
    item.cutoutUri ||
    item.cutout_url ||
    item.cutoutUrl ||
    item.beautifiedDataUri ||
    item.beautified_data_uri ||
    item.beautifiedUri ||
    item.beautified_url ||
    item.imageUri ||
    item.image_url ||
    item.imageUrl ||
    item.image ||
    item.uri ||
    null;

  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.startsWith('illustration://')) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed;
  }

  try {
    const apiBase = getApiUrl().replace(/\/api\/?$/, '');
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${apiBase}${cleanPath}`;
  } catch {
    return trimmed;
  }
}

/**
 * Adjust hex color brightness by percent (+/-)
 */
export function adjustColor(hex: string, percent: number): string {
  let clean = (hex || '#888888').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return hex || '#888888';

  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function normalizeHex(colorValue?: string, fallback = '#3B414B'): string {
  if (!colorValue) return fallback;
  const trimmed = colorValue.trim();
  if (trimmed.startsWith('#')) {
    return trimmed.length === 4 || trimmed.length === 7 ? trimmed : fallback;
  }
  return colorNameToHex(trimmed) || fallback;
}

export type GarmentSlotType = 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES' | 'innerTop' | 'outerLayer' | 'bottom' | 'shoes' | 'accessory';

interface MiniGarmentProps {
  slot?: GarmentSlotType;
  name?: string;
  color?: string;
  secondaryColor?: string;
  size?: number;
}

/**
 * Miniature 2D Vector Garment Preview SVG
 * Replaces generic sparkle boxes with crisp, tailored 2D fashion illustrations
 */
export function MiniGarmentSvg({
  slot = 'TOP',
  name = '',
  color: rawColor,
  secondaryColor: rawSecondary,
  size = 50,
}: MiniGarmentProps) {
  const normSlot = String(slot).toUpperCase();
  const n = (name || '').toLowerCase();

  const isOuter =
    normSlot === 'OUTERWEAR' ||
    normSlot === 'OUTERLAYER' ||
    /hoodie|jacket|blazer|coat|cardigan|sweatshirt|crewneck|vest|bomber|parka/.test(n);
  const isBottom = normSlot === 'BOTTOM' || /jean|denim|pant|trouser|chino|short|skirt|cargo/.test(n);
  const isShoe = normSlot === 'SHOES' || /shoe|sneaker|boot|loafer|sandal|slipper|heel|flat/.test(n);
  const isAccessory = normSlot === 'ACCESSORIES' || normSlot === 'ACCESSORY' || /watch|sunglass|glasses|belt|bag|tote|necklace|chain|airpod/.test(n);

  const baseFill = normalizeHex(
    rawColor,
    isShoe ? '#2A2E35' : isBottom ? '#2F4858' : isOuter ? '#3D4A54' : '#F7F7F5'
  );
  const highlight = adjustColor(baseFill, 20);
  const shadow = adjustColor(baseFill, -22);
  const seam = adjustColor(baseFill, -35);
  const second = rawSecondary ? normalizeHex(rawSecondary, '#D9DDD4') : adjustColor(baseFill, 28);

  const gradId = `miniGrad_${Math.abs(baseFill.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0))}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={highlight} />
          <Stop offset="70%" stopColor={baseFill} />
          <Stop offset="100%" stopColor={shadow} />
        </LinearGradient>
      </Defs>

      {isOuter ? (
        // 2D Hoodie / Outerwear Miniature
        /hoodie|zip|sweatshirt/.test(n) ? (
          <G>
            {/* Hood backing */}
            <Path
              d="M 20,17 C 20,9 40,9 40,17 C 36,21 24,21 20,17 Z"
              fill={shadow}
              stroke={seam}
              strokeWidth="1.2"
            />
            {/* Outerwear Torso & Sleeves */}
            <Path
              d="M 12,20 L 7,34 L 14,35 L 17,28 L 17,47 L 43,47 L 43,28 L 46,35 L 53,34 L 48,20 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="1.3"
            />
            {/* Ribbed hem & cuffs */}
            <Rect x="17" y="47" width="26" height="4" rx="1" fill={shadow} stroke={seam} strokeWidth="1" />
            <Rect x="7" y="32" width="7" height="3" rx="1" fill={shadow} />
            <Rect x="46" y="32" width="7" height="3" rx="1" fill={shadow} />
            {/* Kangaroo pocket */}
            <Path
              d="M 22,35 L 38,35 L 40,44 L 20,44 Z"
              fill={baseFill}
              stroke={seam}
              strokeWidth="1.1"
            />
            {/* Drawstrings */}
            <Line x1="27" y1="18" x2="27" y2="28" stroke={second} strokeWidth="1.2" strokeLinecap="round" />
            <Line x1="33" y1="18" x2="33" y2="28" stroke={second} strokeWidth="1.2" strokeLinecap="round" />
          </G>
        ) : (
          <G>
            {/* Jacket / Blazer Miniature */}
            <Path
              d="M 14,19 L 8,35 L 15,36 L 18,27 L 18,49 L 42,49 L 42,27 L 45,36 L 52,35 L 46,19 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="1.3"
            />
            {/* Lapels */}
            <Path d="M 22,19 L 27,33 L 30,22 L 33,33 L 38,19" fill="none" stroke={second} strokeWidth="1.5" />
            <Line x1="30" y1="33" x2="30" y2="49" stroke={seam} strokeWidth="1.2" />
            {/* Pocket flaps */}
            <Rect x="20" y="38" width="8" height="3" rx="1" fill={shadow} stroke={seam} strokeWidth="0.8" />
            <Rect x="32" y="38" width="8" height="3" rx="1" fill={shadow} stroke={seam} strokeWidth="0.8" />
          </G>
        )
      ) : isBottom ? (
        // 2D Pants / Jeans / Shorts Miniature
        /short/.test(n) ? (
          <G>
            <Rect x="17" y="15" width="26" height="4" rx="1" fill={shadow} stroke={seam} strokeWidth="1" />
            <Path
              d="M 17,19 L 43,19 L 45,35 L 33,35 L 30,24 L 27,35 L 15,35 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="1.3"
            />
            <Line x1="30" y1="19" x2="30" y2="24" stroke={seam} strokeWidth="1.2" />
          </G>
        ) : /skirt/.test(n) ? (
          <G>
            <Rect x="19" y="16" width="22" height="4" rx="1" fill={shadow} stroke={seam} strokeWidth="1" />
            <Path
              d="M 20,20 L 40,20 L 48,48 L 12,48 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="1.3"
            />
          </G>
        ) : (
          <G>
            {/* Full Pants / Jeans */}
            <Rect x="17" y="14" width="26" height="4" rx="1" fill={shadow} stroke={seam} strokeWidth="1" />
            <Path
              d="M 17,18 L 43,18 L 46,50 L 33,50 L 30,26 L 27,50 L 14,50 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="1.3"
            />
            <Line x1="30" y1="18" x2="30" y2="26" stroke={seam} strokeWidth="1.2" />
            {/* Pocket curves */}
            <Path d="M 17,22 Q 22,23 23,18" fill="none" stroke={seam} strokeWidth="1.1" />
            <Path d="M 43,22 Q 38,23 37,18" fill="none" stroke={seam} strokeWidth="1.1" />
            {/cargo/.test(n) && (
              <>
                <Rect x="14" y="32" width="4" height="8" rx="1" fill={shadow} stroke={seam} strokeWidth="0.8" />
                <Rect x="42" y="32" width="4" height="8" rx="1" fill={shadow} stroke={seam} strokeWidth="0.8" />
              </>
            )}
          </G>
        )
      ) : isShoe ? (
        // 2D Shoes / Sneakers Miniature
        <G>
          {/* Shoe Upper */}
          <Path
            d="M 15,28 C 15,22 22,20 28,24 L 32,30 L 44,32 C 48,34 50,40 48,44 L 14,44 C 11,40 12,32 15,28 Z"
            fill={`url(#${gradId})`}
            stroke={seam}
            strokeWidth="1.3"
          />
          {/* Sneaker Midsole */}
          <Rect x="10" y="44" width="41" height="6" rx="2" fill="#FFFFFF" stroke="#B0B5A8" strokeWidth="1" />
          {/* Laces / Eyelets */}
          <Line x1="25" y1="26" x2="31" y2="30" stroke={second} strokeWidth="1.3" strokeLinecap="round" />
          <Line x1="27" y1="29" x2="33" y2="33" stroke={second} strokeWidth="1.3" strokeLinecap="round" />
          {/* Accent Swoosh / Stripe */}
          <Path d="M 20,38 Q 30,36 42,39" fill="none" stroke={second} strokeWidth="2" strokeLinecap="round" />
        </G>
      ) : isAccessory ? (
        // 2D Accessories Miniature (Watch / Sunglasses / Bag)
        /sunglass|glass/.test(n) ? (
          <G>
            <Rect x="12" y="24" width="15" height="12" rx="3" fill="#1C1E24" stroke={second} strokeWidth="1.3" />
            <Rect x="33" y="24" width="15" height="12" rx="3" fill="#1C1E24" stroke={second} strokeWidth="1.3" />
            <Line x1="27" y1="28" x2="33" y2="28" stroke={second} strokeWidth="1.5" />
            <Line x1="8" y1="26" x2="12" y2="26" stroke={second} strokeWidth="1.3" />
            <Line x1="48" y1="26" x2="52" y2="26" stroke={second} strokeWidth="1.3" />
          </G>
        ) : /bag|tote|backpack/.test(n) ? (
          <G>
            <Path d="M 24,14 C 24,9 36,9 36,14" fill="none" stroke={seam} strokeWidth="1.8" />
            <Rect x="16" y="14" width="28" height="34" rx="4" fill={`url(#${gradId})`} stroke={seam} strokeWidth="1.3" />
            <Line x1="16" y1="26" x2="44" y2="26" stroke={second} strokeWidth="1.2" />
          </G>
        ) : (
          <G>
            {/* Watch */}
            <Rect x="26" y="8" width="8" height="44" rx="2" fill="#24272C" stroke={seam} strokeWidth="1" />
            <Circle cx="30" cy="30" r="12" fill={`url(#${gradId})`} stroke={second} strokeWidth="2" />
            <Circle cx="30" cy="30" r="9" fill="#1B1E23" />
            <Line x1="30" y1="30" x2="30" y2="24" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" />
            <Line x1="30" y1="30" x2="35" y2="30" stroke="#FFF" strokeWidth="1" strokeLinecap="round" />
          </G>
        )
      ) : (
        // 2D Tops (T-Shirt / Polo / Button Down / Corduroy)
        <G>
          {/* Main Top Body & Short Sleeves */}
          <Path
            d="M 17,17 L 8,26 L 14,29 L 18,24 L 18,48 L 42,48 L 42,24 L 46,29 L 52,26 L 43,17 Z"
            fill={`url(#${gradId})`}
            stroke={seam}
            strokeWidth="1.3"
          />
          {/polo|oxford|button|shirt/.test(n) ? (
            <>
              {/* Folded Collar */}
              <Path d="M 22,17 L 30,25 L 38,17" fill="none" stroke={second} strokeWidth="2" strokeLinecap="round" />
              <Line x1="30" y1="25" x2="30" y2="44" stroke={second} strokeWidth="1.3" />
              <Circle cx="30" cy="30" r="1.1" fill={second} />
              <Circle cx="30" cy="37" r="1.1" fill={second} />
            </>
          ) : (
            <>
              {/* Crewneck Ribbing */}
              <Path d="M 23,17 Q 30,23 37,17" fill="none" stroke={seam} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {/* Contoured waistline hem */}
          <Line x1="18" y1="46" x2="42" y2="46" stroke={seam} strokeWidth="0.9" />
        </G>
      )}
    </Svg>
  );
}

/**
 * 32 Canonical Garment Vector Subtypes
 */
export const GARMENT_32_SUBTYPES = [
  'hoodie',
  'zip_hoodie',
  'windbreaker',
  'bomber',
  'blazer',
  'cardigan',
  'denim_jacket',
  'trench_coat',
  'puffer',
  'vest',
  'tshirt',
  'polo',
  'button_down',
  'oxford_shirt',
  'blouse',
  'tank_top',
  'crop_top',
  'sweater',
  'crewneck',
  'long_sleeve',
  'trousers',
  'chinos',
  'jeans',
  'cargo_pants',
  'track_pants',
  'joggers',
  'shorts',
  'skirt',
  'sneakers',
  'loafers',
  'boots',
  'watch',
] as const;

export type GarmentVectorSubtype = (typeof GARMENT_32_SUBTYPES)[number] | string;

export function inferVectorSubtype(
  name?: string,
  category?: string,
  explicitSubtype?: string
): string {
  if (explicitSubtype && explicitSubtype.trim().length > 0) {
    return explicitSubtype.trim().toLowerCase().replace(/\s+/g, '_');
  }
  const n = (name || '').toLowerCase();
  const c = (category || '').toUpperCase();

  if (c.startsWith('TOP')) {
    if (/polo/.test(n)) return 'polo';
    if (/oxford/.test(n)) return 'oxford_shirt';
    if (/button|dress.*shirt|flannel|chambray/.test(n)) return 'button_down';
    if (/blouse/.test(n)) return 'blouse';
    if (/tank|camisole|sleeveless/.test(n)) return 'tank_top';
    if (/crop/.test(n)) return 'crop_top';
    if (/crewneck|sweatshirt/.test(n)) return 'crewneck';
    if (/sweater|knit|jumper|turtleneck/.test(n)) return 'sweater';
    if (/long.*sleeve|henley/.test(n)) return 'long_sleeve';
    return 'tshirt';
  }

  if (c.startsWith('OUTER')) {
    if (/zip.*hoodie|full.*zip/.test(n)) return 'zip_hoodie';
    if (/hoodie|pullover/.test(n)) return 'hoodie';
    if (/windbreaker|anorak|rain/.test(n)) return 'windbreaker';
    if (/bomber|varsity|flight/.test(n)) return 'bomber';
    if (/blazer|suit/.test(n)) return 'blazer';
    if (/cardigan/.test(n)) return 'cardigan';
    if (/denim.*jacket|trucker/.test(n)) return 'denim_jacket';
    if (/trench|overcoat|coat/.test(n)) return 'trench_coat';
    if (/puffer|down.*jacket|quilted/.test(n)) return 'puffer';
    if (/vest|gilet/.test(n)) return 'vest';
    return 'jacket';
  }

  if (/polo/.test(n)) return 'polo';
  if (/oxford/.test(n)) return 'oxford_shirt';
  if (/button|dress.*shirt|flannel|chambray/.test(n)) return 'button_down';
  if (/blouse/.test(n)) return 'blouse';
  if (/tank|camisole|sleeveless/.test(n)) return 'tank_top';
  if (/crop/.test(n)) return 'crop_top';
  if (/crewneck|sweatshirt/.test(n)) return 'crewneck';
  if (/sweater|knit|jumper|turtleneck/.test(n)) return 'sweater';
  if (/long.*sleeve|henley/.test(n)) return 'long_sleeve';

  if (/cargo/.test(n)) return 'cargo_pants';
  if (/track.*pant|sweatpant/.test(n)) return 'track_pants';
  if (/jogger/.test(n)) return 'joggers';
  if (/chino|khaki/.test(n)) return 'chinos';
  if (/trouser|slack|dress.*pant|tailored/.test(n)) return 'trousers';
  if (/jean|denim/.test(n)) return 'jeans';
  if (/short/.test(n)) return 'shorts';
  if (/skirt/.test(n)) return 'skirt';

  if (/loafer|moccasin|oxford.*shoe|derby/.test(n)) return 'loafers';
  if (/boot|chelsea|combat/.test(n)) return 'boots';
  if (/sneaker|trainer|runner|shoe/.test(n)) return 'sneakers';
  if (/watch|bracelet|bag|sunglass|cap|hat|belt/.test(n)) return 'watch';

  if (c.startsWith('OUTER')) return 'hoodie';
  if (c.startsWith('BOTTOM')) return 'trousers';
  if (c.startsWith('SHOE')) return 'sneakers';
  if (c.startsWith('ACCESSOR')) return 'watch';
  return 'tshirt';
}

export function formatSubtypeLabel(subtype?: string, fallbackCategory?: string): string {
  const raw = subtype || fallbackCategory || 'Garment';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

interface CanonicalStudioGarmentProps {
  vectorSubtype?: string;
  name?: string;
  category?: string;
  colorHex?: string;
  secondaryColor?: string;
  size?: number;
}

/**
 * Canonical 2D Studio Garment Vector Renderer
 * Reconstructs full studio silhouette (hidden hood, folded sleeves, cuffs, collar, and seams)
 */
export function CanonicalStudioGarmentSvg({
  vectorSubtype,
  name,
  category,
  colorHex,
  secondaryColor,
  size = 150,
}: CanonicalStudioGarmentProps) {
  const subtype = inferVectorSubtype(name, category, vectorSubtype);
  const baseFill = normalizeHex(colorHex, '#3B414B');
  const highlight = adjustColor(baseFill, 18);
  const shadow = adjustColor(baseFill, -20);
  const seam = adjustColor(baseFill, -36);
  const accent = secondaryColor ? normalizeHex(secondaryColor, '#E2E8F0') : adjustColor(baseFill, 32);

  const gradId = `studioGrad_${Math.abs(
    (subtype + baseFill).split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
  )}`;

  const isOuterSubtype = [
    'hoodie',
    'zip_hoodie',
    'windbreaker',
    'bomber',
    'blazer',
    'cardigan',
    'denim_jacket',
    'trench_coat',
    'puffer',
    'vest',
  ].includes(subtype);

  const isBottomSubtype = [
    'trousers',
    'chinos',
    'jeans',
    'cargo_pants',
    'track_pants',
    'joggers',
    'shorts',
    'skirt',
  ].includes(subtype);

  const isShoeSubtype = ['sneakers', 'loafers', 'boots'].includes(subtype);

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={highlight} />
          <Stop offset="65%" stopColor={baseFill} />
          <Stop offset="100%" stopColor={shadow} />
        </LinearGradient>
      </Defs>

      {isOuterSubtype ? (
        <G>
          {/* Reconstructed Full Studio Hood (for hoodie / zip_hoodie / windbreaker) */}
          {(subtype === 'hoodie' || subtype === 'zip_hoodie' || subtype === 'windbreaker') && (
            <Path
              d="M 40,28 C 38,10 82,10 80,28 C 72,35 48,35 40,28 Z"
              fill={shadow}
              stroke={seam}
              strokeWidth="2"
            />
          )}

          {/* Full Unfolded Studio Sleeves + Torso Silhouette */}
          <Path
            d="M 34,28 L 10,68 L 24,74 L 35,48 L 35,96 L 85,96 L 85,48 L 96,74 L 110,68 L 86,28 Z"
            fill={`url(#${gradId})`}
            stroke={seam}
            strokeWidth="2"
          />

          {/* Ribbed Cuffs & Waistband Hem */}
          <Rect x="35" y="94" width="50" height="7" rx="2" fill={shadow} stroke={seam} strokeWidth="1.5" />
          <Path d="M 10,68 L 24,74 L 22,79 L 8,73 Z" fill={shadow} stroke={seam} strokeWidth="1.2" />
          <Path d="M 110,68 L 96,74 L 98,79 L 112,73 Z" fill={shadow} stroke={seam} strokeWidth="1.2" />

          {/* Zipper or Kangaroo Pocket */}
          {(subtype === 'zip_hoodie' || subtype === 'windbreaker' || subtype === 'bomber') && (
            <Line x1="60" y1="30" x2="60" y2="101" stroke={accent} strokeWidth="2.2" />
          )}
          {(subtype === 'hoodie' || subtype === 'zip_hoodie') && (
            <>
              <Path
                d="M 43,72 L 77,72 L 80,91 L 40,91 Z"
                fill={baseFill}
                stroke={seam}
                strokeWidth="1.5"
              />
              <Line x1="54" y1="31" x2="54" y2="52" stroke={accent} strokeWidth="2" strokeLinecap="round" />
              <Line x1="66" y1="31" x2="66" y2="52" stroke={accent} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
          {(subtype === 'blazer' || subtype === 'trench_coat') && (
            <Path
              d="M 45,28 L 56,58 L 60,36 L 64,58 L 75,28"
              fill="none"
              stroke={accent}
              strokeWidth="2.2"
            />
          )}
        </G>
      ) : isBottomSubtype ? (
        <G>
          {/* Waistband */}
          <Rect x="34" y="18" width="52" height="8" rx="2" fill={shadow} stroke={seam} strokeWidth="1.8" />
          {subtype === 'shorts' ? (
            <Path
              d="M 34,26 L 86,26 L 90,66 L 65,66 L 60,44 L 55,66 L 30,66 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="2"
            />
          ) : subtype === 'skirt' ? (
            <Path
              d="M 36,26 L 84,26 L 96,86 L 24,86 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="2"
            />
          ) : (
            <Path
              d="M 34,26 L 86,26 L 91,102 L 66,102 L 60,46 L 54,102 L 29,102 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="2"
            />
          )}
          {/* Side Stripes for Track Pants */}
          {subtype === 'track_pants' && (
            <>
              <Line x1="33" y1="28" x2="29" y2="100" stroke={accent} strokeWidth="3" />
              <Line x1="87" y1="28" x2="91" y2="100" stroke={accent} strokeWidth="3" />
            </>
          )}
          {/* Cargo Pockets */}
          {subtype === 'cargo_pants' && (
            <>
              <Rect x="26" y="56" width="9" height="18" rx="2" fill={shadow} stroke={seam} strokeWidth="1.4" />
              <Rect x="85" y="56" width="9" height="18" rx="2" fill={shadow} stroke={seam} strokeWidth="1.4" />
            </>
          )}
        </G>
      ) : isShoeSubtype ? (
        <G>
          <Path
            d="M 24,54 C 24,42 40,38 54,46 L 64,58 L 90,62 C 98,66 102,78 98,86 L 22,86 C 18,78 20,62 24,54 Z"
            fill={`url(#${gradId})`}
            stroke={seam}
            strokeWidth="2"
          />
          <Rect x="18" y="86" width="84" height="11" rx="4" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.6" />
          <Path d="M 38,74 Q 60,68 86,76" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round" />
        </G>
      ) : (
        /* Canonical Tops: tshirt, polo, button_down, sweater, crewneck, long_sleeve */
        <G>
          {subtype === 'long_sleeve' || subtype === 'sweater' || subtype === 'crewneck' || subtype === 'button_down' || subtype === 'oxford_shirt' ? (
            <Path
              d="M 34,26 L 12,68 L 25,73 L 36,46 L 36,96 L 84,96 L 84,46 L 95,73 L 108,68 L 86,26 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="2"
            />
          ) : (
            <Path
              d="M 34,26 L 16,48 L 28,56 L 36,44 L 36,96 L 84,96 L 84,44 L 92,56 L 104,48 L 86,26 Z"
              fill={`url(#${gradId})`}
              stroke={seam}
              strokeWidth="2"
            />
          )}
          {subtype === 'polo' || subtype === 'button_down' || subtype === 'oxford_shirt' ? (
            <>
              <Path
                d="M 44,26 L 60,42 L 76,26"
                fill="none"
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <Line
                x1="60"
                y1="42"
                x2="60"
                y2={subtype === 'polo' ? '62' : '94'}
                stroke={accent}
                strokeWidth="2"
              />
            </>
          ) : (
            <Path
              d="M 45,26 Q 60,38 75,26"
              fill="none"
              stroke={seam}
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
        </G>
      )}
    </Svg>
  );
}


