import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { sessionManager } from '../src/auth/session';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await sessionManager.login(username.trim(), password);
      router.replace('/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandMark}><Text style={styles.brandInitial}>F</Text></View>
          <Text style={styles.eyebrow}>FINANZAS PERSONALES</Text>
          <Text style={styles.title}>Tu dinero, claro.</Text>
          <Text style={styles.subtitle}>Inicia sesión para ver tu libro financiero.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Usuario</Text>
            <TextInput
              accessibilityLabel="Usuario"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              onChangeText={setUsername}
              onSubmitEditing={submit}
              placeholder="Tu usuario"
              placeholderTextColor="#8a928c"
              returnKeyType="next"
              style={styles.input}
              textContentType="username"
              value={username}
            />

            <Text style={[styles.label, styles.passwordLabel]}>Contraseña</Text>
            <TextInput
              accessibilityLabel="Contraseña"
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder="Tu contraseña"
              placeholderTextColor="#8a928c"
              returnKeyType="go"
              secureTextEntry
              style={styles.input}
              textContentType="password"
              value={password}
            />

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [styles.button, pressed && !loading && styles.buttonPressed, loading && styles.buttonDisabled]}
            >
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Ingresar</Text>}
            </Pressable>
          </View>

          <Text style={styles.footer}>Acceso privado del propietario</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f5f6f2' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 36 },
  brandMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#173c32', alignItems: 'center', justifyContent: 'center', marginBottom: 29 },
  brandInitial: { color: '#d5efad', fontSize: 27, fontWeight: '800' },
  eyebrow: { color: '#47725d', fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 10 },
  title: { color: '#182a24', fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: '#66736c', fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 30 },
  card: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 22, borderWidth: 1, padding: 21 },
  label: { color: '#30483b', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  passwordLabel: { marginTop: 19 },
  input: { backgroundColor: '#f8faf7', borderColor: '#dce4dc', borderRadius: 13, borderWidth: 1, color: '#182a24', fontSize: 16, height: 52, paddingHorizontal: 14 },
  error: { color: '#a33d37', fontSize: 13, lineHeight: 19, marginTop: 15 },
  button: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 14, height: 53, justifyContent: 'center', marginTop: 23 },
  buttonPressed: { backgroundColor: '#245644' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  footer: { color: '#78837b', fontSize: 12, marginTop: 24, textAlign: 'center' },
});
