import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { sessionManager } from '../src/auth/session';
import { Button, createThemedStyles, GlassPanel, Input, ScreenHeader } from '../src/ui';

export default function PasswordScreen() {
  const { ui, styles } = useStyles();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!current || !next || !confirm) {
      setError('Completa las tres contraseñas.');
      return;
    }
    if (next !== confirm) {
      setError('La confirmación no coincide.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await sessionManager.changePassword(current, next, confirm);
      Alert.alert('Contraseña actualizada', 'Inicia sesión con tu nueva contraseña.', [{ text: 'Ingresar', onPress: () => router.replace('/login') }]);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title="Cambiar contraseña" subtitle="Se cerrarán las sesiones en otros dispositivos" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <GlassPanel style={ui.card}>
            <Text style={ui.label}>Contraseña actual</Text>
            <Input accessibilityLabel="Contraseña actual" autoComplete="current-password" editable={!saving} onChangeText={setCurrent} secureTextEntry textContentType="password" value={current} />
            <Text style={ui.label}>Nueva contraseña</Text>
            <Input accessibilityLabel="Nueva contraseña" autoComplete="new-password" editable={!saving} onChangeText={setNext} secureTextEntry textContentType="newPassword" value={next} />
            <Text style={ui.label}>Confirmar contraseña nueva</Text>
            <Input accessibilityLabel="Confirmar contraseña nueva" autoComplete="new-password" editable={!saving} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" value={confirm} />
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={saving} label={saving ? 'Guardando…' : 'Cambiar contraseña'} onPress={() => void submit()} style={styles.submit} />
          </GlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ ui }) => StyleSheet.create({
  flex: { flex: 1 },
  content: { ...ui.content, paddingTop: 0 },
  submit: { marginTop: 22 },
}));
