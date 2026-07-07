import { WeatherData } from '../types';

const WMO_CONDITIONS: Record<number, { label: string; icon: WeatherData['icon'] }> = {
  0: { label: 'Clear Sky', icon: 'sunny' },
  1: { label: 'Mainly Clear', icon: 'sunny' },
  2: { label: 'Partly Cloudy', icon: 'partly-cloudy' },
  3: { label: 'Overcast', icon: 'cloudy' },
  45: { label: 'Foggy', icon: 'cloudy' },
  48: { label: 'Foggy', icon: 'cloudy' },
  51: { label: 'Light Drizzle', icon: 'rainy' },
  61: { label: 'Light Rain', icon: 'rainy' },
  63: { label: 'Rain', icon: 'rainy' },
  65: { label: 'Heavy Rain', icon: 'rainy' },
  71: { label: 'Light Snow', icon: 'snowy' },
  80: { label: 'Rain Showers', icon: 'rainy' },
  95: { label: 'Thunderstorm', icon: 'stormy' },
};

function tipForCondition(icon: WeatherData['icon'], tempF: number): string {
  if (icon === 'rainy' || icon === 'stormy') return 'Bring an umbrella today';
  if (tempF < 60) return "Layer up, it's chilly out there";
  if (tempF > 85) return 'Light fabrics recommended today';
  return 'Light layers you can adjust';
}

export async function fetchWeatherByCoords(
  latitude: number,
  longitude: number,
  locationLabel: string
): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }
  const data = await response.json();
  const current = data.current;
  const code = current.weather_code as number;
  const conditionInfo = WMO_CONDITIONS[code] ?? { label: 'Clear', icon: 'sunny' as const };
  const tempF = Math.round(current.temperature_2m);

  return {
    tempF,
    feelsLikeF: Math.round(current.apparent_temperature),
    condition: conditionInfo.label,
    humidity: Math.round(current.relative_humidity_2m),
    windMph: Math.round(current.wind_speed_10m),
    location: locationLabel,
    tip: tipForCondition(conditionInfo.icon, tempF),
    icon: conditionInfo.icon,
  };
}

export const placeholderWeather: WeatherData = {
  tempF: 72,
  feelsLikeF: 70,
  condition: 'Partly Cloudy',
  humidity: 55,
  windMph: 8,
  location: 'New York, NY',
  tip: 'Light layers you can adjust',
  icon: 'partly-cloudy',
};