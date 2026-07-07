export const lightTheme = {
  mode: 'light' as const,
  background: '#FAF7F2',
  surface: '#FFFFFF',
  primaryAccent: '#FFD586',
  secondaryAccent: '#756E9E',
  text: '#1B1B1F',
  textMuted: '#756E9E',
  border: '#ECE6DA',
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#1B1B1F',
  surface: '#2A2A31',
  primaryAccent: '#FFD586',
  secondaryAccent: '#756E9E',
  text: '#FAF7F2',
  textMuted: '#A9A3C2',
  border: '#33333B',
};

export type Theme = typeof lightTheme;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 };

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
};