const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL;

export function getApiUrl(): string {
  if (configuredApiUrl) return configuredApiUrl.replace(/\/$/, '');

  if (__DEV__) return 'http://localhost:5000/api';

  throw new Error('The production API URL is not configured for this build.');
}
