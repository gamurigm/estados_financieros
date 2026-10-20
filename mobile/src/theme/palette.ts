export type ThemeMode = 'light' | 'dark';

export type ThemeColors = {
  background: string; surface: string; surfaceSolid: string; ink: string; muted: string;
  primary: string; onPrimary: string; primaryPressed: string; tint: string; accent: string;
  border: string; expense: string; expenseTint: string; hero: string; heroText: string;
  heroMuted: string; heroBorder: string; heroNegative: string; inactive: string; input: string;
  glow: string; cyanGlow: string; violetGlow: string; grid: string;
};

export const palettes: Record<ThemeMode, ThemeColors> = {
  light: {
    background: '#ECF0FC', surface: 'rgba(255,255,255,0.72)', surfaceSolid: '#F8FAFF',
    ink: '#172447', muted: '#52627E', primary: '#006B80', onPrimary: '#FFFFFF',
    primaryPressed: '#004F66', tint: '#DDEEF9', accent: '#6545C1',
    border: 'rgba(84,108,164,0.28)', expense: '#B33652', expenseTint: '#FBE7EF',
    hero: 'rgba(255,255,255,0.64)', heroText: '#172447', heroMuted: '#52627E',
    heroBorder: 'rgba(41,123,192,0.38)', heroNegative: '#B33652', inactive: '#E2E8F4',
    input: 'rgba(239,245,255,0.8)', glow: 'rgba(29,108,180,0.12)',
    cyanGlow: 'rgba(94,217,255,0.3)', violetGlow: 'rgba(167,139,250,0.28)',
    grid: 'rgba(63,94,158,0.075)',
  },
  dark: {
    background: '#080D1D', surface: 'rgba(19,28,55,0.82)', surfaceSolid: '#141D34',
    ink: '#EFF5FF', muted: '#B3C1DE', primary: '#64E7FF', onPrimary: '#071524',
    primaryPressed: '#ACF4FF', tint: '#15364B', accent: '#80EDFF',
    border: 'rgba(178,211,255,0.24)', expense: '#FF9AB1', expenseTint: '#402336',
    hero: 'rgba(20,34,66,0.82)', heroText: '#EFF5FF', heroMuted: '#B3C1DE',
    heroBorder: 'rgba(100,231,255,0.4)', heroNegative: '#FF9AB1', inactive: '#19243E',
    input: 'rgba(7,15,35,0.72)', glow: 'rgba(50,200,250,0.18)',
    cyanGlow: 'rgba(0,209,255,0.3)', violetGlow: 'rgba(134,74,255,0.3)',
    grid: 'rgba(126,171,242,0.075)',
  },
};

export const themeStorageKey = 'finance.ui-theme';
