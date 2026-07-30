export interface ClothingPrediction {
  category?: 'TOP' | 'BOTTOM' | 'SHOES' | 'OUTERWEAR' | 'ACCESSORIES';
  color?: string;
  style?: 'CASUAL' | 'FORMAL' | 'SPORTY' | 'STREETWEAR' | 'MINIMALIST' | 'BOHEMIAN' | 'VINTAGE' | 'CLASSIC';
  confidence?: number;
}

const API_URL = (process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export async function analyzeClothingImage(uri: string, accessToken: string): Promise<ClothingPrediction> {
  const form = new FormData();
  form.append('image', { uri, name: 'clothing.jpg', type: 'image/jpeg' } as any);
  const response = await fetch(`${API_URL}/wardrobe/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || 'Image analysis failed.');
  return body.data as ClothingPrediction;
}
