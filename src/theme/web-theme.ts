export type WebThemeMode = 'light' | 'dark';

export const webThemeStorageKey = 'finance.ui-theme';

export function themeFromStorage(value: string | null): WebThemeMode {
  return value === 'light' ? 'light' : 'dark';
}
