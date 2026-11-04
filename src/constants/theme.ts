// Official StyleSense Matte Editorial Palette (v7.2)
export const brand = {
  matteForest: '#1F4E3D',
  matteSage: '#2A6F57',
  matteCharcoal: '#18181B',
  matteObsidian: '#0E100F',
  matteSlate: '#52525B',
  matteZinc: '#9EA8A2',
  warmAlabaster: '#F6F4F0',
  collageLight: '#EFECE6',
  collageDark: '#1A1F1C',
  darkCard: '#161918',
  darkPlum: '#18181B',
  mediumPlum: '#1F4E3D',
  softLilac: '#E4E4E7',
  paleYellow: '#1F4E3D',
  peachGold: '#D4D4D8',
  softCream: '#F4F4F5',
  alabaster: '#F6F4F0',
};

// Redesigned Editorial Palette (#F3F1EF, #364536, #E83E35)
export const editorialColors = {
  lightText: '#F3F1EF',
  forestPrimary: '#364536',
  forestDark: '#242F24',
  forestSoft: '#4A5D4A',
  forestTintLight: '#E8ECE8',
  forestTintDark: 'rgba(54, 69, 54, 0.45)',
  terracottaAccent: '#E83E35',
  terracottaSoft: 'rgba(232, 62, 53, 0.12)',
  warmSurfaceLight: '#FAF9F7',
  warmBorderLight: '#E2DFDA',
};

export const lightTheme = {
  mode: 'light' as const,
  background: '#F6F4F0',
  surface: '#FFFFFF',
  surfaceSecondary: '#EFECE6',
  collageCanvas: '#EFECE6',
  primary: '#364536',
  primaryText: '#FFFFFF',
  accent: '#364536',
  accentSoft: '#E3E8E3',
  primaryAccent: '#364536',
  secondaryAccent: '#364536',
  buttonBg: '#364536',
  buttonText: '#FFFFFF',
  buttonBorder: '#DFDCD5',
  onAccent: '#FFFFFF',
  highlightText: '#18181B',
  accentText: '#364536',
  aiBannerBg: '#EBF0EB',
  aiBannerBorder: '#D2DDD3',
  aiBannerText: '#223022',
  aiPillBg: '#E2EAE2',
  aiPillText: '#223022',
  statIconColor: '#364536',
  badgeBg: '#EFECE6',
  badgeAlt: '#E3E6E3',
  activeCardBg: '#EBF0EB',
  activeCardBorder: '#364536',
  activePillBg: '#364536',
  activePillText: '#FFFFFF',
  navSurface: '#FFFFFF',
  navActiveHighlight: '#EBF0EB',
  navActiveIcon: '#364536',
  navInactiveIcon: '#636B66',
  text: '#161817',
  textSecondary: '#555E58',
  textMuted: '#5C655F',
  border: '#E1DED7',
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#0E100F', // Deep Editorial Obsidian with subtle forest undertone
  surface: '#161918', // Elevated Dark Studio Card Surface
  surfaceSecondary: '#1E2421', // Distinct Secondary / Garment Stage Surface
  collageCanvas: '#181D1A', // Structured Collage Canvas
  primary: '#364536', // Signature StyleSense Forest
  primaryText: '#F3F1EF',
  accent: '#4C6B54', // Luminous Sage Accent for Dark Mode readability
  accentSoft: '#252E29',
  primaryAccent: '#4C6B54',
  secondaryAccent: '#364536',
  buttonBg: '#364536',
  buttonText: '#F3F1EF',
  buttonBorder: '#2A332E',
  onAccent: '#F3F1EF',
  highlightText: '#F3F1EF',
  accentText: '#C5DBC9',
  aiBannerBg: '#1A231E',
  aiBannerBorder: '#2D3C32',
  aiBannerText: '#E5EFE7',
  aiPillBg: '#233027',
  aiPillText: '#D9E8DC',
  statIconColor: '#C5DBC9',
  badgeBg: '#212724',
  badgeAlt: '#2A332E',
  activeCardBg: '#1E2722',
  activeCardBorder: '#4C6B54',
  activePillBg: '#364536',
  activePillText: '#F3F1EF',
  navSurface: '#141716',
  navActiveHighlight: '#212A24',
  navActiveIcon: '#F3F1EF',
  navInactiveIcon: '#8B968F',
  text: '#F3F1EF', // Crisp Warm Ivory
  textSecondary: '#A2ADA6',
  textMuted: '#9BA69F', // Balanced readable muted text
  border: '#28302C', // Crisp 1px dark border
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
