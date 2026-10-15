// Official StyleSense brand palette
export const brand = {
  darkPlum: '#24152C',
  mediumPlum: '#4B1D6F',
  softLilac: '#DECFE8',
  paleYellow: '#FBF5A7',
  peachGold: '#FDD78B',
  softCream: '#FDF3D2',
  alabaster: '#FAF7F0',
  darkCard: '#2E1B38',
};

export const lightTheme = {
  mode: 'light' as const,
  background: brand.alabaster,
  surface: '#FFFFFF',
  primaryAccent: brand.peachGold,
  secondaryAccent: brand.darkPlum, // primary CTA fill
  onAccent: brand.paleYellow, // text/icons on CTA fill
  badgeBg: brand.softLilac,
  badgeAlt: brand.peachGold,
  buttonBg: brand.darkPlum,
  buttonText: brand.paleYellow,
  buttonBorder: 'transparent',
  activePillBg: brand.darkPlum,
  activePillText: brand.paleYellow,
  text: brand.darkPlum,
  textMuted: brand.mediumPlum,
  border: brand.softLilac,
};

export const darkTheme = {
  mode: 'dark' as const,
  background: brand.darkPlum,
  surface: brand.darkCard,
  primaryAccent: brand.peachGold,
  secondaryAccent: brand.paleYellow, // primary CTA fill
  onAccent: brand.darkPlum,
  badgeBg: brand.mediumPlum,
  badgeAlt: brand.peachGold,
  buttonBg: brand.paleYellow,
  buttonText: brand.darkPlum,
  buttonBorder: 'transparent',
  activePillBg: brand.paleYellow,
  activePillText: brand.darkPlum,
  text: brand.softCream,
  textMuted: brand.softLilac,
  border: brand.mediumPlum,
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