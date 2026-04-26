// SafeVault static design tokens.
// Accent (primary/dark/surface) is overridden at runtime via ThemeContext.
export const colors = {
  bg: '#FCFCFA',
  surface: '#FFFFFF',
  elevated: '#F4F5F0',
  textPrimary: '#1A1F1D',
  textSecondary: '#5C6A64',
  textTertiary: '#8A9A93',
  textInverse: '#FFFFFF',
  // Default accent (forest)
  primary: '#4A7D6A',
  primaryHover: '#3B6655',
  primarySurface: '#E5EFEA',
  dark: '#1C3F3A',
  // Status (universal)
  valid: '#4A7D6A',
  expiringSoon: '#DDA750',
  expired: '#D16B54',
  overdue: '#B94C36',
  border: '#EAE8E1',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, card: 20, pill: 999,
};

export const shadow = {
  sm: { shadowColor: '#1C3F3A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  md: { shadowColor: '#1C3F3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
};
