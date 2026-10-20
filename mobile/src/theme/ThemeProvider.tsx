import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type PropsWithChildren, type RefObject } from 'react';
import { Alert, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { palettes, themeStorageKey, type ThemeColors, type ThemeMode } from './palette';

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  selectTheme: (mode: ThemeMode) => void;
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(themeStorageKey)
      .then((saved) => { if (active && (saved === 'light' || saved === 'dark')) setMode(saved); })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const selectTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    writes.current = writes.current
      .then(() => SecureStore.setItemAsync(themeStorageKey, next))
      .catch(() => { Alert.alert('Tema actualizado', 'No se pudo guardar la elección en este dispositivo. Podrás volver a elegirla al abrir la app.'); });
  }, []);

  const value = useMemo(() => ({ mode, colors: palettes[mode], selectTheme, blurTarget }), [mode, selectTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {ready ? children : <View style={{ flex: 1, backgroundColor: palettes.dark.background }} />}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider no está disponible.');
  return theme;
}
