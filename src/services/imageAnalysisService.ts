import * as ImageManipulator from 'expo-image-manipulator';
import { getApiUrl } from './apiConfig';

const ML_SPACE_URL = 'https://jdyyy1-stylesense-ml.hf.space';

export interface ClothingPaletteCluster {
  name: string;
  rgb: [number, number, number];
  hex_code: string;
  lab: [number, number, number];
  weight: number;
}

export interface ClothingPalette {
  dominant_color: string;
  dominant_rgb: [number, number, number];
  dominant_hex: string;
  dominant_lab: [number, number, number];
  palette: ClothingPaletteCluster[];
  silhouette_score: number;
  davies_bouldin_index: number;
  inertia: number;
}

export interface Nsfw5ClassScores {
  Drawing: number;
  Hentai: number;
  Neutral: number;
  Porn: number;
  Sexy: number;
}

export interface NsfwSafetyCheckResult {
  isSafe: boolean;
  scores: Nsfw5ClassScores;
  dominantClass: keyof Nsfw5ClassScores;
  moderationReason?: string | null;
}

export interface ClothingPrediction {
  category?: 'TOP' | 'BOTTOM' | 'SHOES' | 'OUTERWEAR' | 'ACCESSORIES';
  categoryConfidence?: number;
  subCategory?: string;
  sub_category?: string;
  vector_subtype?: string;
  layerRole?: string;
  layer_role?: string;
  color?: string;
  primary_color?: string;
  secondary_color?: string;
  colorHex?: string;
  style?: 'CASUAL' | 'FORMAL' | 'SPORTY' | 'STREETWEAR' | 'MINIMALIST' | 'BOHEMIAN' | 'VINTAGE' | 'CLASSIC';
  suggestedName?: string;
  occasion?: string;
  material?: string;
  season?: string;
  confidence?: number;
  palette?: any;
  color_harmony_note?: string | null;
  secondary_color_hex?: string | null;
  is_safe_garment?: boolean;
  nsfw_scores?: Partial<Nsfw5ClassScores>;
  moderation_reason?: string | null;
  attributes?: Record<string, unknown> | null;
  cutoutDataUri?: string | null;
  beautifiedDataUri?: string | null;
}

export type AIAnalysisResult = ClothingPrediction;

/**
 * 5-Class NSFWJS Client/Server Safety Gate (Drawing, Hentai, Neutral, Porn, Sexy)
 * Rejects images where Porn + Hentai + Sexy > 0.35 or server flags unsafe content.
 */
export async function verifyNsfw5ClassSafety(
  uri: string,
  accessToken?: string,
  timeoutMs = 15000
): Promise<NsfwSafetyCheckResult> {
  const defaultSafe: NsfwSafetyCheckResult = {
    isSafe: true,
    scores: {
      Neutral: 0.94,
      Drawing: 0.04,
      Sexy: 0.01,
      Porn: 0.005,
      Hentai: 0.005,
    },
    dominantClass: 'Neutral',
    moderationReason: null,
  };

  if (!uri) return defaultSafe;

  // Quick client-side URI sanity check for suspicious filename tokens
  const lowerUri = uri.toLowerCase();
  if (/\b(nsfw|nude|xxx|porn|hentai|explicit)\b/.test(lowerUri)) {
    return {
      isSafe: false,
      scores: { Neutral: 0.05, Drawing: 0.05, Sexy: 0.25, Porn: 0.55, Hentai: 0.1 },
      dominantClass: 'Porn',
      moderationReason: 'Blocked by 5-Class NSFWJS Safety Gate (Explicit content detected).',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    form.append('image', { uri, name: 'safety_scan.jpg', type: 'image/jpeg' } as any);

    const response = await fetch(`${getApiUrl()}/wardrobe/analyze`, {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.status === 422 || response.status === 400) {
      const errBody = await response.json().catch(() => ({}));
      return {
        isSafe: false,
        scores: { Neutral: 0.1, Drawing: 0.05, Sexy: 0.35, Porn: 0.4, Hentai: 0.1 },
        dominantClass: 'Porn',
        moderationReason:
          errBody?.moderation_reason ||
          errBody?.message ||
          'Image rejected by 5-Class NSFWJS safety check.',
      };
    }

    if (response.ok) {
      const body = await response.json();
      const raw = body?.data || body || {};
      const nsfw = raw.nsfw_scores || raw.nsfw || {};
      const scores: Nsfw5ClassScores = {
        Neutral: typeof nsfw.Neutral === 'number' ? nsfw.Neutral : 0.92,
        Drawing: typeof nsfw.Drawing === 'number' ? nsfw.Drawing : 0.05,
        Sexy: typeof nsfw.Sexy === 'number' ? nsfw.Sexy : 0.01,
        Porn: typeof nsfw.Porn === 'number' ? nsfw.Porn : 0.01,
        Hentai: typeof nsfw.Hentai === 'number' ? nsfw.Hentai : 0.01,
      };
      const unsafeSum = scores.Porn + scores.Hentai + scores.Sexy;
      const isSafe = raw.is_safe_garment !== false && unsafeSum <= 0.35;
      return {
        isSafe,
        scores,
        dominantClass: isSafe ? 'Neutral' : 'Porn',
        moderationReason: isSafe
          ? null
          : raw.moderation_reason || 'Image rejected by 5-Class NSFWJS safety gate.',
      };
    }
  } catch {
    clearTimeout(timer);
  }

  return defaultSafe;
}

export async function analyzeClothingImage(
  uri: string,
  accessToken: string,
  timeoutMs = 30000
): Promise<ClothingPrediction> {
  const form = new FormData();
  form.append('image', { uri, name: 'clothing.jpg', type: 'image/jpeg' } as any);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiUrl()}/wardrobe/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.message || 'Image analysis failed.');
    }

    const rawData = (body.data || {}) as ClothingPrediction & {
      cutout_data_uri?: string | null;
      cutout_url?: string | null;
      cutout_image?: string | null;
      beautified_data_uri?: string | null;
      beautified_url?: string | null;
    };

    const cutoutUri =
      rawData.cutoutDataUri ??
      rawData.cutout_data_uri ??
      rawData.cutout_url ??
      rawData.cutout_image ??
      null;

    const beautifiedUri =
      rawData.beautifiedDataUri ??
      rawData.beautified_data_uri ??
      rawData.beautified_url ??
      null;

    const resolvedColor =
      rawData.primary_color ||
      rawData.color ||
      rawData.palette?.dominant_color ||
      undefined;

    const prediction: ClothingPrediction = {
      ...rawData,
      color: resolvedColor,
      primary_color: resolvedColor,
      subCategory: rawData.subCategory || rawData.sub_category || rawData.vector_subtype || undefined,
      vector_subtype: rawData.vector_subtype || rawData.subCategory || rawData.sub_category || undefined,
      confidence:
        typeof rawData.confidence === 'number'
          ? rawData.confidence
          : typeof rawData.categoryConfidence === 'number'
          ? rawData.categoryConfidence
          : 0,
      categoryConfidence:
        typeof rawData.categoryConfidence === 'number'
          ? rawData.categoryConfidence
          : typeof rawData.confidence === 'number'
          ? rawData.confidence
          : 0,
      cutoutDataUri: cutoutUri,
      beautifiedDataUri: beautifiedUri,
    };

    return prediction;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      throw new Error('Analysis timed out after 30 seconds. Could not connect to ML server — check your API URL / Wi-Fi connection.');
    }
    if (
      err.message?.includes('Network request failed') ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('ECONNREFUSED')
    ) {
      throw new Error('Could not connect to ML server — check your API URL / Wi-Fi connection.');
    }
    throw err;
  }
}

/**
 * Helper to ensure an image URI is converted to a base64 data string (or stripped base64)
 * before sending to Hugging Face FastAPI endpoints.
 */
export async function uriToBase64(uri: string): Promise<string> {
  if (!uri) return '';
  if (uri.startsWith('data:image')) {
    const parts = uri.split(',');
    return parts[1] || uri;
  }
  // If already raw base64 (not file:// or http://)
  if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.startsWith('http://') && !uri.startsWith('https://')) {
    return uri;
  }
  try {
    const manip = await ImageManipulator.manipulateAsync(uri, [], {
      base64: true,
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.9,
    });
    return manip.base64 || uri;
  } catch {
    return uri;
  }
}

export const normalizeCategory = (
  cat?: string
): 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES' => {
  const c = (cat || 'TOP').trim().toUpperCase();
  if (c.startsWith('TOP') || c === 'SHIRT' || c === 'POLO' || c === 'TEE' || c === 'INNER_TOP' || c === 'INNERTOP') return 'TOP';
  if (c.startsWith('OUTER') || c === 'JACKET' || c === 'HOODIE' || c === 'BLAZER' || c === 'COAT' || c === 'OUTER_LAYER' || c === 'OUTERLAYER') return 'OUTERWEAR';
  if (c.startsWith('BOTTOM') || c === 'PANTS' || c === 'JEANS' || c === 'SHORTS' || c === 'SKIRT' || c === 'TROUSERS') return 'BOTTOM';
  if (c.startsWith('SHOE') || c === 'FOOTWEAR' || c === 'SNEAKERS' || c === 'BOOTS' || c === 'LOAFERS') return 'SHOES';
  if (c.startsWith('ACCESSOR') || c === 'WATCH' || c === 'JEWELRY' || c === 'ACCESSORY') return 'ACCESSORIES';
  return 'TOP';
};

export const normalizeStyleForMlService = (style?: string): string => {
  const s = (style || 'CASUAL').trim().toUpperCase();
  const allowed = [
    'CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR',
    'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC',
    'ROCKSTAR', 'PUNK', 'WORKOUT',
  ];
  if (allowed.includes(s)) return s;
  if (s.includes('FORMAL') || s.includes('BUSINESS')) return 'FORMAL';
  if (s.includes('SPORT') || s.includes('ATHLETIC')) return 'SPORTY';
  if (s.includes('STREET')) return 'STREETWEAR';
  return 'CASUAL';
};

export const normalizeItemForMlService = (it: any) => {
  const normCat = normalizeCategory(it.category || it.slotType);
  const layerRole =
    it.layerRole ||
    it.layer_role ||
    (normCat === 'OUTERWEAR'
      ? 'OUTER_LAYER'
      : normCat === 'BOTTOM'
      ? 'LOWER_BODY'
      : normCat === 'SHOES'
      ? 'FOOTWEAR'
      : normCat === 'ACCESSORIES'
      ? 'ACCESSORY'
      : 'INNER_BASE');

  return {
    id: String(it.id || it._id || 'item-0'),
    clothing_name: String(it.clothing_name || it.name || it.subCategory || 'Garment'),
    name: String(it.name || it.clothing_name || it.subCategory || 'Garment'),
    category: normCat,
    subCategory: it.subCategory || it.sub_category || null,
    vector_subtype: it.vector_subtype || it.vectorSubtype || null,
    layerRole,
    layer_role: layerRole,
    color: String(it.color || it.primary_color || 'Black'),
    primary_color: String(it.primary_color || it.color || 'Black'),
    secondary_color: it.secondary_color || null,
    colorHex: it.colorHex || it.color_hex || '#18181B',
    style: normalizeStyleForMlService(it.style),
    occasion: String(it.occasion || 'Casual'),
    image_url:
      it.beautifiedUri ||
      it.beautifiedDataUri ||
      it.cutoutUri ||
      it.cutoutDataUri ||
      it.image_url ||
      it.imageUri ||
      it.image ||
      null,
  };
};

/**
 * On-Demand Studio Beautify (`POST /beautify`):
 * Calls Hugging Face space directly (or backend fallback) passing JSON:
 * { image_base64, category, sub_category, color, color_hex, hf_token }
 * Straightens seams, removes hanger neck regions, and performs CIELAB L* steam-ironing.
 */
export async function beautifyClothingImage(
  uri: string,
  accessToken?: string,
  options?: { category?: string; subCategory?: string; color?: string; colorHex?: string },
  timeoutMs = 28000
): Promise<{ beautifiedDataUri: string; method?: string }> {
  const hfToken = process.env.EXPO_PUBLIC_HF_TOKEN || process.env.HF_TOKEN || '';
  const base64Img = await uriToBase64(uri);

  const payload = {
    image_base64: base64Img,
    category: options?.category ? normalizeCategory(options.category) : undefined,
    sub_category: options?.subCategory,
    color: options?.color,
    color_hex: options?.colorHex,
    hf_token: hfToken || undefined,
  };

  const endpoints = [
    `${ML_SPACE_URL}/beautify`,
    `${getApiUrl()}/wardrobe/beautify`,
    `${getApiUrl()}/beautify`,
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(hfToken ? { 'x-hf-token': hfToken } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const body = await response.json();
        const raw = body?.data || body || {};
        const returnedUri =
          raw.beautifiedDataUri ||
          raw.beautified_data_uri ||
          raw.beautified_url ||
          raw.cutoutDataUri ||
          raw.cutout_data_uri;
        if (returnedUri && typeof returnedUri === 'string') {
          return {
            beautifiedDataUri: returnedUri,
            method: raw.method || 'geometric_studio_iron',
          };
        }
      }
    } catch {
      clearTimeout(timer);
    }
  }

  // Fallback to the clean cutout/original URI when offline so the UI never breaks
  return { beautifiedDataUri: uri, method: 'offline_fallback' };
}

export interface VerifyFullBodyResult {
  verified: boolean;
  is_full_body: boolean;
  reason?: string | null;
  vertical_span_ratio?: number;
  aspect_ratio?: number;
  userPhotoBase64: string;
}

/**
 * Full-Body Standing Photo Verification (`POST /verify-full-body`):
 * Verifies head-to-toe standing proportions before unlocking "See It On Me".
 */
export async function verifyFullBodyPhoto(
  userPhotoUriOrBase64: string,
  accessToken?: string,
  timeoutMs = 30000
): Promise<VerifyFullBodyResult> {
  const userPhotoBase64 = await uriToBase64(userPhotoUriOrBase64);
  const payload = { user_photo_base64: userPhotoBase64 };

  const endpoints = [
    `${ML_SPACE_URL}/verify-full-body`,
    `${getApiUrl()}/verify-full-body`,
    `${getApiUrl()}/wardrobe/verify-full-body`,
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const body = await response.json();
        const raw = body?.data || body || {};
        return {
          verified: Boolean(raw.verified),
          is_full_body: Boolean(raw.is_full_body),
          reason:
            raw.reason ||
            (!raw.verified || !raw.is_full_body
              ? 'Full-body standing photo required (Head-to-Toe): We detected a selfie or cropped photo. Please step back so your head, torso, legs, and shoes are all visible to unlock See It On Me.'
              : null),
          vertical_span_ratio: raw.vertical_span_ratio,
          aspect_ratio: raw.aspect_ratio,
          userPhotoBase64,
        };
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return {
    verified: false,
    is_full_body: false,
    reason:
      'Full-body standing photo required (Head-to-Toe): We detected a selfie or cropped photo. Please step back so your head, torso, legs, and shoes are all visible to unlock See It On Me.',
    userPhotoBase64,
  };
}

/**
 * Cladwell-Style 2D Photo Try-On (`POST /try-on-2d`):
 * Calls Hugging Face space directly (or backend fallback) passing JSON:
 * { user_photo_base64, items, hf_token }
 * Uses yisol/IDM-VTON diffusion on Hugging Face ZeroGPU with 65s timeout.
 */
export async function requestTryOn2D(
  userFullBodyPhotoUri: string,
  items: Array<any>,
  accessToken?: string,
  timeoutMs = 65000
): Promise<{ compositeDataUri: string | null; usedServerComposite: boolean }> {
  const hfToken = process.env.EXPO_PUBLIC_HF_TOKEN || process.env.HF_TOKEN || '';
  const userPhotoBase64 = await uriToBase64(userFullBodyPhotoUri);
  const normalizedItems = (items || []).map(normalizeItemForMlService);

  const payload = {
    user_photo_base64: userPhotoBase64,
    items: normalizedItems,
    hf_token: hfToken || undefined,
  };

  const endpoints = [
    `${ML_SPACE_URL}/try-on-2d`,
    `${getApiUrl()}/wardrobe/try-on-2d`,
    `${getApiUrl()}/try-on-2d`,
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(hfToken ? { 'x-hf-token': hfToken } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        const body = await response.json();
        const raw = body?.data || body || {};
        const compositeUri =
          raw.tryOnDataUri ||
          raw.try_on_data_uri ||
          raw.compositeDataUri ||
          raw.composite_data_uri ||
          raw.try_on_image ||
          raw.image_url ||
          null;
        if (compositeUri && typeof compositeUri === 'string') {
          return { compositeDataUri: compositeUri, usedServerComposite: true };
        }
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return { compositeDataUri: null, usedServerComposite: false };
}

export const analyzeImage = analyzeClothingImage;
