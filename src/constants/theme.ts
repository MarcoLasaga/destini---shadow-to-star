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
  primary: brand.darkPlum,
  accent: brand.mediumPlum, // link / eyebrow / brandHighlight / progressFill: #4B1D6F Medium Plum (high contrast on light backgrounds)
  primaryAccent: brand.peachGold,
  secondaryAccent: brand.paleYellow, // primary CTA fill: bright Pale Yellow (for button background)
  buttonBg: brand.paleYellow, // used ONLY for button backgroundColor, NEVER for text
  buttonText: brand.darkPlum,
  buttonBorder: brand.softLilac,
  onAccent: brand.darkPlum, // text/icons on CTA fill: Dark Plum
  highlightText: brand.darkPlum, // crisp high-contrast highlight text
  accentText: '#4B1D6F', // Deep Plum — NEVER use #FBF5A7 yellow as text color on light backgrounds
  aiBannerBg: '#FDF3D2', // Warm Cream-Gold surface
  aiBannerBorder: '#4B1D6F', // Deep Plum border
  aiBannerText: '#24152C', // Ultra-crisp Dark Plum text — 13:1 AAA contrast for projectors/demos
  aiPillBg: '#DECFE8', // Soft Lilac pill background
  aiPillText: '#24152C', // Dark Plum pill text
  statIconColor: brand.mediumPlum, // crisp visible icon color
  badgeBg: brand.softLilac,
  badgeAlt: brand.peachGold,
  activeCardBg: brand.softLilac,
  activeCardBorder: brand.mediumPlum,
  activePillBg: brand.softLilac,
  activePillText: brand.darkPlum,
  navSurface: '#FFFFFF',
  navActiveHighlight: brand.paleYellow,
  navActiveIcon: brand.darkPlum,
  navInactiveIcon: brand.mediumPlum,
  text: brand.darkPlum,
  textMuted: '#5E4B6B',
  border: brand.softLilac,
};

export const darkTheme = {
  mode: 'dark' as const,
  background: brand.darkPlum,
  surface: brand.darkCard,
  primary: brand.softCream,
  accent: brand.paleYellow, // link / eyebrow / brandHighlight / progressFill: #FBF5A7 Pale Yellow in dark mode
  primaryAccent: brand.peachGold,
  secondaryAccent: brand.paleYellow, // primary CTA fill: bright Pale Yellow
  buttonBg: brand.paleYellow,
  buttonText: brand.darkPlum,
  buttonBorder: 'transparent',
  onAccent: brand.darkPlum,
  highlightText: brand.paleYellow,
  accentText: '#FBF5A7', // Soft Butter Yellow — high contrast on dark plum
  aiBannerBg: '#2E1B38',
  aiBannerBorder: '#FBF5A7',
  aiBannerText: '#FBF5A7',
  aiPillBg: '#4B1D6F',
  aiPillText: '#FBF5A7',
  statIconColor: brand.paleYellow,
  badgeBg: brand.mediumPlum,
  badgeAlt: brand.peachGold,
  activeCardBg: brand.mediumPlum,
  activeCardBorder: brand.paleYellow,
  activePillBg: brand.paleYellow,
  activePillText: brand.darkPlum,
  navSurface: brand.darkPlum,
  navActiveHighlight: brand.mediumPlum,
  navActiveIcon: brand.paleYellow,
  navInactiveIcon: brand.softLilac,
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