import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { createBankAccount, loadFinanceState, saveAccount, saveOpeningBalance } from '../src/api/client';
import type { FinanceState } from '../src/api/contracts';
import { Button, Input, ScreenHeader, createThemedStyles, GlassPanel } from '../src/ui';

export default function OpeningBalancesScreen() {
  const { colors, ui, styles } = useStyles();
  const [data, setData] = useState<FinanceState | null>(null);
  const [values, setValues] = useState<Record<string, { name: string; balance: string }>>({});
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const latest = await loadFinanceState();
      setData(latest);
      setValues(Object.fromEntries(latest.accounts.map((account) => [account.id, {
        name: account.name,
        balance: String(account.openingBalance),
      }])));
      return true;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las cuentas.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!data || saving) return;
    const balances = Object.fromEntries(data.accounts.map((account) => [account.id, parseBalance(values[account.id]?.balance ?? '')]));
    if (Object.values(balances).some((balance) => balance === null)) {
      setError('Ingresa un saldo válido para cada cuenta. Puedes usar coma o punto decimal.');
      return;
    }
    const accountName = newName.trim();
    const addedBalance = parseBalance(newBalance);
    if (accountName && (accountName.length > 120 || addedBalance === null)) {
      setError('Revisa el nombre y el saldo de la nueva cuenta.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await Promise.all(data.accounts.map((account) => account.kind === 'cash'
        ? saveOpeningBalance(account.id, balances[account.id] as number)
        : saveAccount({ id: account.id, name: values[account.id].name, openingBalance: balances[account.id] as number })));
      if (accountName) await createBankAccount({ name: accountName, openingBalance: addedBalance as number, startDate: localDate() });
      if (!await load()) throw new Error('Las cuentas se guardaron, pero no se pudo actualizar el libro. Reintenta la carga.');
      setNewName('');
      setNewBalance('0');
      Alert.alert('Cuentas guardadas', 'El libro ya muestra los saldos actualizados.');
    } catch (saveError) {
      await load();
      setError(saveError instanceof Error ? saveError.message : 'No se pudieron guardar las cuentas. Revisa el libro por si hubo cambios parciales.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title="Cuentas y saldos" subtitle="Efectivo y tus bancos, por separado" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
          {loading && !data ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Cargando cuentas…</Text></View> : null}
          {!loading && !data ? (
            <View style={styles.state}><Text style={styles.stateText}>{error || 'No se pudieron cargar las cuentas.'}</Text><Button label="Reintentar" onPress={() => void load()} style={styles.primary} /></View>
          ) : null}

          {data ? <>
            <Text style={styles.intro}>Cada cuenta bancaria nueva comienza hoy. Los saldos anteriores se conservan.</Text>
            {data.accounts.map((account) => (
              <GlassPanel key={account.id} style={styles.card}>
                <Text style={styles.label}>{account.kind === 'cash' ? 'Efectivo' : 'Cuenta bancaria'}</Text>
                {account.kind === 'bank' ? <Input
                  accessibilityLabel={`Nombre de ${account.name}`}
                  editable={!saving && !loading}
                  onChangeText={(name) => setValues((current) => ({ ...current, [account.id]: { ...current[account.id], name } }))}
                  placeholder="Banco o número de cuenta"
                  style={styles.nameInput}
                  value={values[account.id]?.name ?? account.name}
                /> : null}
                <Text style={styles.hint}>Saldo inicial · desde {account.startDate}</Text>
                <View style={styles.amountRow}><Text style={styles.currency}>$</Text><Input
                  accessibilityLabel={`Saldo inicial de ${account.name}`}
                  editable={!saving && !loading}
                  keyboardType="decimal-pad"
                  onChangeText={(balance) => setValues((current) => ({ ...current, [account.id]: { ...current[account.id], balance } }))}
                  placeholder="0,00"
                  selectTextOnFocus
                  style={styles.input}
                  value={values[account.id]?.balance ?? ''}
                /></View>
              </GlassPanel>
            ))}

            <GlassPanel style={styles.card}>
              <Text style={styles.label}>Agregar cuenta bancaria</Text>
              <Text style={styles.hint}>Pon un nombre o una referencia, como el número de cuenta.</Text>
              <Input accessibilityLabel="Nombre o número de cuenta" editable={!saving} onChangeText={setNewName} placeholder="Banco · 1234" style={styles.nameInput} value={newName} />
              <View style={styles.amountRow}><Text style={styles.currency}>$</Text><Input accessibilityLabel="Saldo inicial de la nueva cuenta" editable={!saving} keyboardType="decimal-pad" onChangeText={setNewBalance} placeholder="0,00" selectTextOnFocus style={styles.input} value={newBalance} /></View>
              <Text style={styles.hint}>Su saldo comienza hoy: {localDate()}</Text>
            </GlassPanel>

            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={saving} disabled={loading} label={saving ? 'Guardando…' : 'Guardar cuentas'} onPress={() => void save()} style={styles.primary} />
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

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  nameInput: { color: colors.ink, fontSize: 17, minHeight: 52, marginTop: 10 },
  amountRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 12 },
  currency: { color: colors.primary, fontSize: 28, fontWeight: '700' },
  input: { flex: 1, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'], minHeight: 70 },
  primary: { marginTop: 18 },
}));
