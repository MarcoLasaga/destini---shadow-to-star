import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../constants/theme';

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}