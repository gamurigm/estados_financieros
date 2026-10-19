import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { sessionManager } from '../src/auth/session';

export default function IndexScreen() {
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(true);

  const restore = useCallback(async () => {
    setChecking(true);
    setMessage('');
    try {
      const active = await sessionManager.restore();
      if (active) return;
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
    return <SafeAreaView style={styles.safeArea}><View style={styles.center}><ActivityIndicator color="#173c32" /><Text style={styles.muted}>Revisando sesión…</Text></View></SafeAreaView>;
  }

  if (message) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Sin conexión</Text>
          <Text style={styles.muted}>{message}</Text>
          <Pressable onPress={() => void restore()} style={styles.button}><Text style={styles.buttonText}>Reintentar</Text></Pressable>
          <Pressable onPress={() => router.replace('/login')} style={styles.secondary}><Text style={styles.secondaryText}>Ir al inicio de sesión</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <View style={styles.brandMark}><Text style={styles.brandInitial}>F</Text></View>
        <Text style={styles.title}>Estados financieros</Text>
        <Text style={styles.muted}>Sesión iniciada. El libro móvil estará aquí.</Text>
        <Pressable onPress={() => void logout()} style={styles.button}><Text style={styles.buttonText}>Cerrar sesión</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f6f2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  brandMark: { width: 58, height: 58, borderRadius: 20, backgroundColor: '#173c32', alignItems: 'center', justifyContent: 'center', marginBottom: 23 },
  brandInitial: { color: '#d5efad', fontSize: 28, fontWeight: '800' },
  title: { color: '#182a24', fontSize: 25, fontWeight: '800', textAlign: 'center' },
  muted: { color: '#66736c', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 14, marginTop: 25, paddingHorizontal: 24, paddingVertical: 15 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondary: { marginTop: 18, padding: 10 },
  secondaryText: { color: '#305e49', fontSize: 14, fontWeight: '700' },
});
