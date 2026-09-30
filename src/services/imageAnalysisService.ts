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
  confidence?: number;
  palette?: ClothingPalette;
  attributes?: Record<string, unknown> | null;
}

export async function analyzeClothingImage(uri: string, accessToken: string): Promise<ClothingPrediction> {
  const form = new FormData();
  form.append('image', { uri, name: 'clothing.jpg', type: 'image/jpeg' } as any);
  const response = await fetch(`${getApiUrl()}/wardrobe/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || 'Image analysis failed.');
  const prediction = body.data as ClothingPrediction;
  if (__DEV__) {
    console.info('[StyleSense] wardrobe analysis response', {
      ok: response.ok,
      status: response.status,
      category: prediction?.category ?? null,
      categoryConfidence: prediction?.categoryConfidence ?? prediction?.confidence ?? null,
      color: prediction?.color ?? null,
      paletteClusters: prediction?.palette?.palette?.length ?? 0,
      attributes: prediction?.attributes ?? null,
      style: prediction?.style ?? null,
    });
  }
  return prediction;
}
