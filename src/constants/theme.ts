// Official StyleSense Matte Editorial Palette (v7.2)
export const brand = {
  matteForest: '#1F4E3D',
  matteSage: '#2A6F57',
  matteCharcoal: '#18181B',
  matteObsidian: '#121214',
  matteSlate: '#52525B',
  matteZinc: '#A1A1AA',
  warmAlabaster: '#F7F6F2',
  collageLight: '#F3F3F1',
  collageDark: '#232327',
  darkCard: '#1C1C1F',
  darkPlum: '#18181B',
  mediumPlum: '#1F4E3D',
  softLilac: '#E4E4E7',
  paleYellow: '#1F4E3D',
  peachGold: '#D4D4D8',
  softCream: '#F4F4F5',
  alabaster: '#F7F6F2',
};

export const lightTheme = {
  mode: 'light' as const,
  background: '#F7F6F2', // Warm Matte Alabaster
  surface: '#FFFFFF', // Flat White Card Surface
  surfaceSecondary: '#F3F3F1', // Matte Secondary Surface
  collageCanvas: '#F3F3F1', // ALTA Collage Canvas (Light)
  primary: '#1F4E3D', // Matte Forest Green
  primaryText: '#FFFFFF', // Crisp White text on Matte Forest Green
  accent: '#1F4E3D', // Matte Forest Green
  accentSoft: '#E4E4E7', // Matte Soft Zinc
  primaryAccent: '#1F4E3D',
  secondaryAccent: '#1F4E3D', // Primary Accent Pill: Matte Forest Green
  buttonBg: '#1F4E3D',
  buttonText: '#FFFFFF',
  buttonBorder: '#E4E4E7',
  onAccent: '#FFFFFF', // Crisp White text on Matte Forest Green
  highlightText: '#18181B',
  accentText: '#1F4E3D',
  aiBannerBg: '#F3F3F1',
  aiBannerBorder: '#E4E4E7',
  aiBannerText: '#18181B',
  aiPillBg: '#E4E4E7',
  aiPillText: '#18181B',
  statIconColor: '#1F4E3D',
  badgeBg: '#F3F3F1',
  badgeAlt: '#E4E4E7',
  activeCardBg: '#F3F3F1',
  activeCardBorder: '#1F4E3D',
  activePillBg: '#1F4E3D',
  activePillText: '#FFFFFF',
  navSurface: '#FFFFFF',
  navActiveHighlight: '#F3F3F1',
  navActiveIcon: '#1F4E3D',
  navInactiveIcon: '#52525B',
  text: '#18181B', // Deep Matte Charcoal
  textSecondary: '#52525B', // Matte Slate
  textMuted: '#52525B', // Matte Slate (WCAG AA >= 4.5:1)
  border: '#E4E4E7', // Flat 1px border
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#121214', // Matte Obsidian
  surface: '#1C1C1F', // Matte Dark Card Surface
  surfaceSecondary: '#232327', // Matte Dark Secondary Surface
  collageCanvas: '#232327', // ALTA Collage Canvas (Dark)
  primary: '#2A6F57', // Matte Sage
  primaryText: '#F4F4F5', // Crisp Off-White text on Matte Sage
  accent: '#2A6F57', // Matte Sage
  accentSoft: '#2E2E33', // Matte Dark Border/Soft
  primaryAccent: '#2A6F57',
  secondaryAccent: '#2A6F57', // Primary Accent Pill: Matte Sage
  buttonBg: '#2A6F57',
  buttonText: '#F4F4F5',
  buttonBorder: '#2E2E33',
  onAccent: '#F4F4F5', // Crisp Off-White text on Matte Sage
  highlightText: '#F4F4F5',
  accentText: '#F4F4F5',
  aiBannerBg: '#1C1C1F',
  aiBannerBorder: '#2E2E33',
  aiBannerText: '#F4F4F5',
  aiPillBg: '#232327',
  aiPillText: '#F4F4F5',
  statIconColor: '#F4F4F5',
  badgeBg: '#232327',
  badgeAlt: '#2E2E33',
  activeCardBg: '#232327',
  activeCardBorder: '#2A6F57',
  activePillBg: '#2A6F57',
  activePillText: '#F4F4F5',
  navSurface: '#1C1C1F',
  navActiveHighlight: '#232327',
  navActiveIcon: '#F4F4F5',
  navInactiveIcon: '#A1A1AA',
  text: '#F4F4F5', // Crisp Off-White
  textSecondary: '#A1A1AA', // Matte Zinc
  textMuted: '#A1A1AA', // Matte Zinc
  border: '#2E2E33', // Flat 1px border
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