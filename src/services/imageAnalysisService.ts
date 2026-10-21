import { getApiUrl } from './apiConfig';

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

export interface ClothingPrediction {
  category?: 'TOP' | 'BOTTOM' | 'SHOES' | 'OUTERWEAR' | 'ACCESSORIES';
  categoryConfidence?: number;
  color?: string;
  style?: 'CASUAL' | 'FORMAL' | 'SPORTY' | 'STREETWEAR' | 'MINIMALIST' | 'BOHEMIAN' | 'VINTAGE' | 'CLASSIC';
  suggestedName?: string;
  occasion?: string;
  material?: string;
  season?: string;
  confidence?: number;
  palette?: ClothingPalette;
  is_safe_garment?: boolean;
  moderation_reason?: string | null;
  attributes?: Record<string, unknown> | null;
  cutoutDataUri?: string | null;
}

export type AIAnalysisResult = ClothingPrediction;

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
    };

    const prediction: ClothingPrediction = {
      ...rawData,
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
      cutoutDataUri:
        rawData.cutoutDataUri ??
        rawData.cutout_data_uri ??
        rawData.cutout_url ??
        rawData.cutout_image ??
        null,
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

export const analyzeImage = analyzeClothingImage;
