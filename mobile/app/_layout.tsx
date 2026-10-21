import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { CyberBackground, useUi } from '../src/ui';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { FinanceDrawerProvider } from '../src/navigation/FinanceDrawer';

export default function RootLayout() {
  return <ThemeProvider><AppShell /></ThemeProvider>;
}

function AppShell() {
  const { colors, mode } = useUi();
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...baseTheme, colors: { ...baseTheme.colors, background: 'transparent', card: colors.surfaceSolid, text: colors.ink, primary: colors.primary, border: colors.border } };
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <CyberBackground />
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <FinanceDrawerProvider>
          <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade',
          }} />
        </FinanceDrawerProvider>
      </View>
    </NavigationThemeProvider>
  );
}
