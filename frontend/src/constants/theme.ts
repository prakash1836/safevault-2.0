// SafeVault premium design tokens.
// `accent` (primary/dark/surface) is overridden at runtime via ThemeContext.
// Status + structure tokens stay invariant across themes for trust.

export const colors = {
  // Base surfaces
  bg: '#FBFBF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F8F4',
  elevated: '#F4F5F0',
  scrim: 'rgba(20, 26, 24, 0.45)',

  // Text
  textPrimary: '#161A18',
  textSecondary: '#5C6A64',
  textTertiary: '#9AA8A2',
  textInverse: '#FFFFFF',
  textOnDark: 'rgba(255,255,255,0.92)',
  textOnDarkMuted: 'rgba(255,255,255,0.62)',
  textOnDarkSubtle: 'rgba(255,255,255,0.42)',

  // Default accent (forest) — overridden by ThemeContext at runtime
  primary: '#4A7D6A',
  primaryHover: '#3B6655',
  primarySurface: '#E5EFEA',
  dark: '#1C3F3A',

  // Status (universal — stays constant across themes)
  valid: '#4A7D6A',
  expiringSoon: '#C68A2C',
  expired: '#D16B54',
  overdue: '#B94C36',
  validSurface: '#E7EFEA',
  expiringSurface: '#FBF1DE',
  expiredSurface: '#F8E3DC',
  overdueSurface: '#F3D8D0',

  // Structure
  border: '#ECEAE2',
  borderSubtle: '#F2F0E8',
  divider: '#F0EEE6',

  // Skeleton shimmer
  skeletonBase: '#EDECE5',
  skeletonHi: '#F7F6F0',
};

// 4pt grid spacing
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40, massive: 56,
};

// Consistent radius scale
export const radius = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 22, xxl: 26,
  card: 22,
  hero: 28,
  pill: 999,
};

// Premium layered shadows
export const shadow = {
  none: {},
  xs: { shadowColor: '#1C3F3A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sm: { shadowColor: '#1C3F3A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  md: { shadowColor: '#1C3F3A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  lg: { shadowColor: '#1C3F3A', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 8 },
  hero: { shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 12 },
};

// Typography scale
export const typography = {
  display:  { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8, lineHeight: 38 },
  h1:       { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 32 },
  h2:       { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.3, lineHeight: 26 },
  h3:       { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 22 },
  bodyLg:   { fontSize: 15, fontWeight: '500' as const, lineHeight: 22 },
  body:     { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodySm:   { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  caption:  { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.8, lineHeight: 14 },
};

// Motion durations
export const motion = {
  fast: 140,
  base: 220,
  slow: 320,
};
