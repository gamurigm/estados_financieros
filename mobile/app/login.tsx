import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { sessionManager } from '../src/auth/session';
import { Button, colors, Input, ui } from '../src/ui';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);

  async function submit() {
    if (loading || !username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await sessionManager.login(username.trim(), password);
      router.replace('/(tabs)');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.brand}>
            <View style={styles.brandMark}><Text style={styles.brandInitial}>f.</Text></View>
            <Text style={styles.brandName}>Mi libro financiero</Text>
          </View>
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>Tu dinero,{"\n"}en orden.</Text>
            <Text style={styles.subtitle}>Tus cuentas y movimientos,{"\n"}en un solo lugar.</Text>
          </View>

          <View style={ui.card}>
            <Text style={styles.formTitle}>Iniciar sesión</Text>
            <Text style={styles.formHint}>Usa tu cuenta de propietario.</Text>
            <Text style={ui.label}>Usuario</Text>
            <Input
              accessibilityLabel="Usuario"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              editable={!loading}
              onChangeText={setUsername}
              onSubmitEditing={() => passwordInput.current?.focus()}
              placeholder="Tu usuario"
              returnKeyType="next"
              submitBehavior="submit"
              textContentType="username"
              value={username}
            />

            <Text style={ui.label}>Contraseña</Text>
            <View style={styles.passwordRow}>
              <Input
                accessibilityLabel="Contraseña"
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!loading}
                onChangeText={setPassword}
                onSubmitEditing={() => void submit()}
                placeholder="Tu contraseña"
                ref={passwordInput}
                returnKeyType="go"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                textContentType="password"
                value={password}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onPress={() => setShowPassword((value) => !value)} style={({ pressed }) => [styles.visibility, pressed && ui.pressed]}>
                <Text style={styles.visibilityText}>{showPassword ? 'Ocultar' : 'Mostrar'}</Text>
              </Pressable>
            </View>
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={loading} disabled={!username.trim() || !password} label={loading ? 'Ingresando…' : 'Ingresar'} onPress={() => void submit()} style={styles.submit} />
          </View>
          <View style={styles.footer}><View style={styles.privateDot} /><Text style={styles.footerText}>Tu espacio privado de finanzas</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 30 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  brandMark: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  brandInitial: { color: colors.accent, fontSize: 30, fontWeight: '800', marginTop: -4 },
  brandName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  intro: { marginBottom: 28, marginTop: 34 },
  title: { color: colors.ink, fontSize: 44, fontWeight: '800', letterSpacing: -1.8, lineHeight: 49 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 15 },
  formTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  formHint: { color: colors.muted, fontSize: 13, marginTop: 5 },
  passwordRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  passwordInput: { flex: 1, minWidth: 0 },
  visibility: { alignItems: 'center', justifyContent: 'center', minHeight: 54, minWidth: 64 },
  visibilityText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  submit: { marginTop: 24 },
  footer: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: 24 },
  privateDot: { backgroundColor: colors.primary, borderRadius: 3, height: 6, width: 6 },
  footerText: { color: colors.muted, fontSize: 12 },
});
