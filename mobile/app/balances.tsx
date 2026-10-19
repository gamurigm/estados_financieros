import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState, saveOpeningBalance } from '../src/api/client';
import type { AccountId, FinanceState } from '../src/api/contracts';

const accounts: Array<{ id: AccountId; label: string; hint: string }> = [
  { id: 'cash', label: 'Efectivo', hint: 'Saldo inicial de efectivo' },
  { id: 'bank', label: 'Débito', hint: 'Saldo inicial de tu cuenta' },
];

export default function OpeningBalancesScreen() {
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.headerText}><Text style={styles.eyebrow}>CONFIGURA TU LIBRO</Text><Text style={styles.title}>Saldos iniciales</Text></View>
        </View>

        {loading && !data ? <View style={styles.state}><ActivityIndicator color="#173c32" /><Text style={styles.stateText}>Cargando saldos…</Text></View> : null}
        {!loading && !data ? (
          <View style={styles.state}><Text style={styles.stateText}>{error || 'No se pudieron cargar los saldos.'}</Text><Pressable onPress={() => void load()} style={styles.primary}><Text style={styles.primaryText}>Reintentar</Text></Pressable></View>
        ) : null}

        {data ? <>
          <Text style={styles.intro}>Ingresa el saldo de cada cuenta antes de registrar movimientos.</Text>
          {accounts.map((account) => (
            <View key={account.id} style={styles.card}>
              <Text style={styles.label}>{account.label}</Text>
              <Text style={styles.hint}>{account.hint}</Text>
              <View style={styles.amountRow}><Text style={styles.currency}>$</Text><TextInput
                accessibilityLabel={account.hint}
                editable={!saving && !loading}
                keyboardType="default"
                onChangeText={(value) => setValues((current) => ({ ...current, [account.id]: value }))}
                placeholder="0.00"
                placeholderTextColor="#98a29b"
                selectTextOnFocus
                style={styles.input}
                value={values[account.id]}
              /></View>
            </View>
          ))}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void save()} style={[styles.primary, (saving || loading) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Guardar saldos</Text>}
          </Pressable>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function parseBalance(value: string) {
  const cleanValue = value.trim().replace(',', '.');
  if (!cleanValue) return null;
  const amount = Number(cleanValue);
  return Number.isFinite(amount) ? amount : null;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f5f6f2', flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', marginBottom: 21 },
  back: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e0e6df', borderRadius: 13, borderWidth: 1, height: 43, justifyContent: 'center', marginRight: 13, width: 43 },
  backText: { color: '#315a45', fontSize: 31, lineHeight: 34, marginTop: -4 },
  headerText: { flex: 1 },
  eyebrow: { color: '#47725d', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#182a24', fontSize: 25, fontWeight: '800', marginTop: 4 },
  state: { alignItems: 'center', paddingVertical: 48 },
  stateText: { color: '#66736c', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  intro: { color: '#6d7a71', fontSize: 13, lineHeight: 20, marginBottom: 17 },
  card: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 16 },
  label: { color: '#253b30', fontSize: 15, fontWeight: '800' },
  hint: { color: '#78837b', fontSize: 11, marginTop: 5 },
  amountRow: { alignItems: 'center', backgroundColor: '#f7f8f5', borderColor: '#e0e6df', borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginTop: 13, paddingHorizontal: 12 },
  currency: { color: '#47725d', fontSize: 19, fontWeight: '700', marginRight: 8 },
  input: { color: '#233a2e', flex: 1, fontSize: 18, fontWeight: '700', minHeight: 50, paddingVertical: 8 },
  error: { backgroundColor: '#fff0ec', borderRadius: 11, color: '#a33d37', fontSize: 12, lineHeight: 18, marginTop: 6, padding: 10 },
  primary: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 13, justifyContent: 'center', marginTop: 15, minHeight: 48, paddingHorizontal: 20, paddingVertical: 13 },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
