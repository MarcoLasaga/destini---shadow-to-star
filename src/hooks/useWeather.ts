import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { WeatherData } from '../types';
import { fetchWeatherByCoords, placeholderWeather } from '../services/weatherService';

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData>(placeholderWeather);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWeather(placeholderWeather);
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const locationLabel = place
        ? `${place.city ?? place.subregion ?? ''}, ${place.region ?? ''}`.replace(/^, |, $/g, '')
        : 'Current Location';

      const data = await fetchWeatherByCoords(
        position.coords.latitude,
        position.coords.longitude,
        locationLabel || 'Current Location'
      );

      setWeather(data);
    } catch (err) {
      setError('Could not load live weather, showing placeholder');
      setWeather(placeholderWeather);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { weather, loading, error, refresh: load };
}