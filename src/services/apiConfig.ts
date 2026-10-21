import Constants from 'expo-constants';
import { Platform } from 'react-native';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL;

export function getApiUrl(): string {
  let url = configuredApiUrl;

  // On physical devices in development, "localhost" or "127.0.0.1" points to the phone itself.
  // Resolve host machine LAN IP from Expo's hostUri (e.g., 192.168.1.X:8081).
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const hostIp = hostUri ? hostUri.split(':')[0] : null;

  if (url) {
    if ((url.includes('localhost') || url.includes('127.0.0.1')) && hostIp) {
      url = url.replace(/localhost|127\.0\.0\.1/, hostIp);
    }
    return url.replace(/\/$/, '');
  }

  if (__DEV__) {
    if (hostIp) {
      return `http://${hostIp}:5000/api`;
    }
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:5000/api'
      : 'http://localhost:5000/api';
  }

  throw new Error('The production API URL is not configured for this build.');
}
