export const lightTheme = {
  mode: 'light' as const,
  background: '#FAF8F5',
  surface: '#FFFFFF',
  primaryAccent: '#CBB499',
  secondaryAccent: '#4A4458',
  buttonBg: '#4A4458',
  buttonText: '#FFFFFF',
  buttonBorder: 'transparent',
  activePillBg: '#4A4458',
  activePillText: '#FFFFFF',
  text: '#18181B',
  textMuted: '#6E6879',
  border: '#E5E0D8',
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#0F1115',
  surface: '#17191E',
  primaryAccent: '#D4AF37',
  secondaryAccent: '#6366F1',
  buttonBg: '#2D2A3E',
  buttonText: '#F4F4F5',
  buttonBorder: '#6366F1',
  activePillBg: '#D4AF37',
  activePillText: '#0F1115',
  text: '#F4F4F5',
  textMuted: '#9B96A6',
  border: '#24262E',
};

export type Theme = typeof lightTheme | typeof darkTheme;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 };

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
  sectionHeader: {
    fontSize: 11.5,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
  },
};