import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { sessionManager } from '../src/auth/session';
import { Button, createThemedStyles } from '../src/ui';

export default function IndexScreen() {
  const { colors, styles } = useStyles();
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(true);

  const restore = useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const active = await sessionManager.restore();
      if (active) {
        router.replace('/(tabs)');
        return;
      }
      router.replace('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo conectar al servidor.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { void restore(); }, [restore]);

  async function logout() {
    try {
      await sessionManager.logout();
    } catch {
      Alert.alert('Sesión cerrada en este teléfono', 'No se pudo confirmar el cierre de sesión con el servidor.');
    } finally {
      router.replace('/login');
    }
  }

  if (checking) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Revisando sesión…</Text></View></SafeAreaView>;
  }

  if (message) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Sin conexión</Text>
          <Text style={styles.muted}>{message}</Text>
          <Button label="Reintentar" onPress={() => void restore()} style={styles.button} />
          <Button label="Ir al inicio de sesión" onPress={() => router.replace('/login')} style={styles.secondary} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <View style={styles.brandMark}><Text style={styles.brandInitial}>F</Text></View>
        <Text style={styles.title}>Estados financieros</Text>
        <Text style={styles.muted}>Tu libro está listo.</Text>
        <Button label="Cerrar sesión" onPress={() => void logout()} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  brandMark: { width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 23 },
  brandInitial: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, marginTop: 25, paddingHorizontal: 24, paddingVertical: 15 },
  secondary: { marginTop: 18, padding: 10 },
}));
