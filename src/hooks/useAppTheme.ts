import { lightTheme, Theme } from '../constants/theme';

export function useAppTheme(): Theme {
  // Dark mode is not yet implemented; force light theme across all screens and components
  return lightTheme;
}