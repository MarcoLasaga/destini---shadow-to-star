import { Theme, lightTheme } from '../constants/theme';
import { useSettings } from '../contexts/SettingsContext';

export function useAppTheme(): Theme {
  try {
    const settings = useSettings();
    return settings.theme;
  } catch {
    return lightTheme;
  }
}