// App-wide theme tokens.
export const theme = {
  colors: {
    bg: '#0B0D12',
    surface: '#141821',
    surfaceAlt: '#1B2130',
    border: '#242A3A',
    text: '#F4F6FB',
    textMuted: '#8A93A6',
    accent: '#7C5CFF',
    accent2: '#3EC1D3',
    danger: '#FF5C7A',
    warning: '#FFB547',
    success: '#4ADE80',
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  font: {
    xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, title: 34,
  },
};
export type Theme = typeof theme;
