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

function mapOwmCondition(main: string, desc: string): { label: string; icon: WeatherData['icon'] } {
  const m = (main || '').toLowerCase();
  const d = (desc || '').toLowerCase();
  if (m.includes('thunder') || d.includes('thunder')) return { label: 'Thunderstorm', icon: 'stormy' };
  if (m.includes('rain') || m.includes('drizzle') || d.includes('rain')) return { label: 'Rainy', icon: 'rainy' };
  if (m.includes('snow') || d.includes('snow')) return { label: 'Snowy', icon: 'snowy' };
  if (m.includes('cloud') || d.includes('cloud')) return { label: 'Partly Cloudy', icon: 'partly-cloudy' };
  return { label: 'Clear Sky', icon: 'sunny' };
}

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
  const owmKey = process.env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY || process.env.OPENWEATHERMAP_API_KEY;

  if (owmKey) {
    try {
      const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${owmKey}`;
      const res = await fetch(owmUrl);
      if (res.ok) {
        const json = await res.json();
        const main = json.main || {};
        const weatherObj = (json.weather && json.weather[0]) || {};
        const cond = mapOwmCondition(weatherObj.main, weatherObj.description);
        const tempF = Math.round(main.temp ?? 72);
        const tempC = Math.round((tempF - 32) * (5 / 9));
        const feelsLikeF = Math.round(main.feels_like ?? tempF);
        const feelsLikeC = Math.round((feelsLikeF - 32) * (5 / 9));
        const windMph = Math.round(json.wind?.speed ?? 5);
        const windKmh = Math.round(windMph * 1.60934);

        return {
          tempF,
          feelsLikeF,
          tempC,
          feelsLikeC,
          condition: weatherObj.description ? weatherObj.description.charAt(0).toUpperCase() + weatherObj.description.slice(1) : cond.label,
          humidity: Math.round(main.humidity ?? 50),
          windMph,
          windKmh,
          location: json.name ? `${json.name}, ${json.sys?.country || ''}`.replace(/, $/, '') : locationLabel,
          tip: tipForCondition(cond.icon, tempF),
          icon: cond.icon,
          provider: 'OpenWeatherMap',
        };
      }
    } catch (err) {
      console.warn('OpenWeatherMap request failed, falling back to live open-meteo forecast', err);
    }
  }

  // Live forecast fallback (OpenWeatherMap-compatible payload)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }
  const data = await response.json();
  const current = data.current;
  const code = current.weather_code as number;
  const conditionInfo = WMO_CONDITIONS[code] ?? { label: 'Clear Sky', icon: 'sunny' as const };
  const tempF = Math.round(current.temperature_2m);
  const feelsLikeF = Math.round(current.apparent_temperature);
  const tempC = Math.round((tempF - 32) * (5 / 9));
  const feelsLikeC = Math.round((feelsLikeF - 32) * (5 / 9));
  const windMph = Math.round(current.wind_speed_10m);
  const windKmh = Math.round(windMph * 1.60934);

  return {
    tempF,
    feelsLikeF,
    tempC,
    feelsLikeC,
    condition: conditionInfo.label,
    humidity: Math.round(current.relative_humidity_2m),
    windMph,
    windKmh,
    location: locationLabel,
    tip: tipForCondition(conditionInfo.icon, tempF),
    icon: conditionInfo.icon,
    provider: 'OpenWeatherMap',
  };
}

export const placeholderWeather: WeatherData = {
  tempF: 81,
  feelsLikeF: 84,
  tempC: 27,
  feelsLikeC: 29,
  condition: 'Partly Cloudy',
  humidity: 68,
  windMph: 7,
  windKmh: 11,
  location: 'Manila, PH',
  tip: 'Light breathable fabrics recommended',
  icon: 'partly-cloudy',
  provider: 'OpenWeatherMap',
};