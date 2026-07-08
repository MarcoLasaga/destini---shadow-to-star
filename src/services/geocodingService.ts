export interface GeocodeResult {
  displayName: string;
  lat: number;
  lon: number;
}

export async function searchDestinations(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 2) return [];

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&addressdetails=1&limit=6&featureType=city`;

  const response = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'StyleSense-App/1.0' },
  });

  if (!response.ok) return [];

  const data = await response.json();
  return (data as any[]).map((entry) => ({
    displayName: entry.display_name as string,
    lat: parseFloat(entry.lat),
    lon: parseFloat(entry.lon),
  }));
}