import React from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { getApiUrl } from '../services/apiConfig';
import { colorNameToHex } from '../services/outfitRecommendationService';

export function resolveGarmentImageUrl(item: any): string | null {
  if (!item) return null;
  const raw =
    item.cutout_url ||
    item.cutoutUrl ||
    item.cutoutDataUri ||
    item.cutout_data_uri ||
    item.image_url ||
    item.imageUrl ||
    item.imageUri ||
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

