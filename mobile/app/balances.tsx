import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState, saveOpeningBalance } from '../src/api/client';
import type { AccountId, FinanceState } from '../src/api/contracts';
import { Button, Input, ScreenHeader, createThemedStyles, GlassPanel } from '../src/ui';

const accounts: Array<{ id: AccountId; label: string; hint: string }> = [
  { id: 'cash', label: 'Efectivo', hint: 'Saldo inicial de efectivo' },
  { id: 'bank', label: 'Débito', hint: 'Saldo inicial de tu cuenta' },
];

export default function OpeningBalancesScreen() {
  const { colors, ui, styles } = useStyles();
  const [data, setData] = useState<FinanceState | null>(null);
  const [values, setValues] = useState<Record<AccountId, string>>({ cash: '', bank: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const latest = await loadFinanceState();
      setData(latest);
      setValues({ cash: String(latest.opening.cash), bank: String(latest.opening.bank) });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los saldos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!data || saving) return;
    const parsed = {
      cash: parseBalance(values.cash),
      bank: parseBalance(values.bank),
    };
    if (parsed.cash === null || parsed.bank === null) {
      setError('Ingresa un saldo válido para cada cuenta. Puedes usar coma o punto decimal.');
      return;
    }

    setSaving(true);
    setError('');
    let saved = false;
    try {
      await saveOpeningBalance('cash', parsed.cash);
      await saveOpeningBalance('bank', parsed.bank);
      saved = true;
      const latest = await loadFinanceState();
      setData(latest);
      setValues({ cash: String(latest.opening.cash), bank: String(latest.opening.bank) });
      Alert.alert('Saldos guardados', 'El libro ya muestra los cambios.');
    } catch (saveError) {
      setError(saved
        ? 'Los saldos se guardaron, pero no se pudo actualizar la pantalla. Reintenta guardar.'
        : saveError instanceof Error ? saveError.message : 'No se pudieron guardar los saldos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title="Saldos iniciales" subtitle="El punto de partida de tus cuentas" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>

          {loading && !data ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Cargando saldos…</Text></View> : null}
          {!loading && !data ? (
            <View style={styles.state}><Text style={styles.stateText}>{error || 'No se pudieron cargar los saldos.'}</Text><Button label="Reintentar" onPress={() => void load()} style={styles.primary} /></View>
          ) : null}

          {data ? <>
            <Text style={styles.intro}>Ingresa el saldo de cada cuenta antes de registrar movimientos.</Text>
            {accounts.map((account) => (
              <GlassPanel key={account.id} style={styles.card}>
                <Text style={styles.label}>{account.label}</Text>
                <Text style={styles.hint}>{account.hint}</Text>
                <View style={styles.amountRow}><Text style={styles.currency}>$</Text><Input
                  accessibilityLabel={account.hint}
                  editable={!saving && !loading}
                  keyboardType="default"
                  onChangeText={(value) => setValues((current) => ({ ...current, [account.id]: value }))}
                  placeholder="0,00"
                  selectTextOnFocus
                  style={styles.input}
                  value={values[account.id]}
                /></View>
              </GlassPanel>
            ))}
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={saving} disabled={loading} label={saving ? 'Guardando…' : 'Guardar saldos'} onPress={() => void save()} style={styles.primary} />
          </> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function parseBalance(value: string) {
  const cleanValue = value.trim().replace(',', '.');
  if (!cleanValue) return null;
  const amount = Number(cleanValue);
  return Number.isFinite(amount) ? amount : null;
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  safeArea: ui.screen,
  content: { ...ui.content, paddingTop: 0 },
  state: { alignItems: 'center', paddingVertical: 48 },
  stateText: { ...ui.helper, marginTop: 12, textAlign: 'center' },
  intro: { ...ui.helper, marginBottom: 20 },
  card: { ...ui.card, marginBottom: 14 },
  label: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  hint: { ...ui.helper, marginTop: 5 },
  amountRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 16 },
  currency: { color: colors.primary, fontSize: 28, fontWeight: '700' },
  input: { flex: 1, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], minHeight: 70 },
  primary: { marginTop: 18 },
}));
