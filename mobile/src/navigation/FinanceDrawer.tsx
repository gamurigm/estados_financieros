import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

const drawerContext = createContext<(() => void) | null>(null);

const destinations: { href: string; label: string; symbol: string }[] = [
  { href: '/(tabs)', label: 'Libro', symbol: '▤' },
  { href: '/budget', label: 'Presupuesto', symbol: '◷' },
  { href: '/analysis', label: 'Análisis', symbol: '▥' },
  { href: '/balance-general', label: 'Balance general', symbol: '◈' },
  { href: '/cash-flow', label: 'Flujo de caja', symbol: '↗' },
];

export function FinanceDrawerProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const pathname = usePathname();
  const drawerWidth = Math.min(320, windowWidth * 0.86);

  const open = useCallback(() => {
    translateX.setValue(-drawerWidth);
    setVisible(true);
    requestAnimationFrame(() => {
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    });
  }, [drawerWidth, translateX]);

  const close = useCallback(() => {
    Animated.timing(translateX, { toValue: -drawerWidth, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [drawerWidth, translateX]);

  const select = useCallback((href: string) => {
    close();
    const alreadyThere = pathname === href || (href === '/(tabs)' && pathname === '/');
    if (!alreadyThere) router.push(href as Href);
  }, [close, pathname]);

  return (
    <drawerContext.Provider value={open}>
      {children}
      <Modal animationType="none" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="Cerrar menú" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
          <Animated.View accessibilityViewIsModal style={[styles.panel, { backgroundColor: colors.surfaceSolid, borderColor: colors.border, width: drawerWidth, transform: [{ translateX }] }]}>
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.headingRow}>
                <View>
                  <Text style={[styles.eyebrow, { color: colors.muted }]}>ESTADOS FINANCIEROS</Text>
                  <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink }]}>Navegación</Text>
                </View>
                <Pressable accessibilityLabel="Cerrar menú" accessibilityRole="button" onPress={close} style={({ pressed }) => [styles.closeButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.closeText, { color: colors.ink }]}>×</Text>
                </Pressable>
              </View>
              <View style={styles.links}>
                {destinations.slice(0, 3).map((destination) => {
                  const selected = pathname === destination.href || (destination.href === '/(tabs)' && pathname === '/');
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={destination.href}
                      onPress={() => select(destination.href)}
                      style={({ pressed }) => [styles.link, { backgroundColor: selected ? colors.tint : 'transparent', borderColor: selected ? colors.primary : 'transparent' }, pressed && styles.pressed]}
                    >
                      <Text style={[styles.symbol, { color: selected ? colors.primary : colors.muted }]}>{destination.symbol}</Text>
                      <Text style={[styles.linkLabel, { color: selected ? colors.primary : colors.ink }]}>{destination.label}</Text>
                    </Pressable>
                  );
                })}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                {destinations.slice(3).map((destination) => {
                  const selected = pathname === destination.href;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={destination.href}
                      onPress={() => select(destination.href)}
                      style={({ pressed }) => [styles.link, { backgroundColor: selected ? colors.tint : 'transparent', borderColor: selected ? colors.primary : 'transparent' }, pressed && styles.pressed]}
                    >
                      <Text style={[styles.symbol, { color: selected ? colors.primary : colors.muted }]}>{destination.symbol}</Text>
                      <Text style={[styles.linkLabel, { color: selected ? colors.primary : colors.ink }]}>{destination.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.footer, { color: colors.muted }]}>Tus finanzas, a la vista</Text>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </drawerContext.Provider>
  );
}

export function DrawerMenuButton() {
  const open = useContext(drawerContext);
  const { colors } = useTheme();
  if (!open) throw new Error('FinanceDrawerProvider no está disponible.');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir menú de navegación" onPress={open} style={({ pressed }) => [styles.menuButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
      <Text style={[styles.menuSymbol, { color: colors.primary }]}>☰</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(3, 8, 20, 0.62)', flex: 1, flexDirection: 'row' },
  panel: { borderRightWidth: 1, elevation: 18, height: '100%', shadowColor: '#000000', shadowOffset: { width: 8, height: 0 }, shadowOpacity: 0.24, shadowRadius: 24 },
  safeArea: { flex: 1, paddingHorizontal: 18 },
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 22, paddingTop: 18 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heading: { fontSize: 23, fontWeight: '800', marginTop: 5 },
  closeButton: { alignItems: 'center', borderRadius: 13, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  closeText: { fontSize: 28, lineHeight: 32, marginTop: -2 },
  links: { gap: 8 },
  link: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 14, minHeight: 56, paddingHorizontal: 14 },
  symbol: { fontSize: 22, textAlign: 'center', width: 24 },
  linkLabel: { fontSize: 15, fontWeight: '700' },
  divider: { height: 1, marginHorizontal: 7, marginVertical: 8 },
  footer: { fontSize: 12, marginTop: 'auto', paddingBottom: 14, paddingTop: 24 },
  menuButton: { alignItems: 'center', borderRadius: 14, borderWidth: 1, height: 48, justifyContent: 'center', width: 48 },
  menuSymbol: { fontSize: 21, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
