import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { apiRequest, saveMovement } from '../../src/api/client';
import type { Account, AccountId, FinanceState } from '../../src/api/contracts';
import { getAccountBalanceAsOf } from '../../src/features/ledger/selectors';
import { parseAmount, validateTransfer, type TransferDraft } from '../../src/features/movements/validation';
import { Button, Input, ScreenHeader, createThemedStyles, GlassPanel } from '../../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

export default function NewTransferScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const withdrawal = mode === 'withdrawal';
  const { ui, styles } = useStyles();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [financeState, setFinanceState] = useState<FinanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<TransferDraft>({
    date: localDate(), amount: '', account: 'cash', toAccount: 'bank', note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const cash = accounts.find((account) => account.kind === 'cash');
  const banks = accounts.filter((account) => account.kind === 'bank');

  useEffect(() => {
    let active = true;
    setError('');
    apiRequest<FinanceState>('/api/state').then((state) => {
      if (!active) return;
      setFinanceState(state);
      setAccounts(state.accounts);
      const bank = state.accounts.find((account) => account.kind === 'bank');
      const cashAccount = state.accounts.find((account) => account.kind === 'cash');
      setDraft((current) => ({
        ...current,
        account: withdrawal ? bank?.id ?? 'bank' : cashAccount?.id ?? 'cash',
        toAccount: withdrawal ? cashAccount?.id ?? 'cash' : bank?.id ?? 'bank',
      }));
      if (withdrawal && !bank) setError('Agrega una cuenta bancaria antes de retirar efectivo.');
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar tus cuentas.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [withdrawal, retry]);

  async function submit() {
    if (withdrawal && (!banks.some((account) => account.id === draft.account) || !cash)) {
      setError('Selecciona una cuenta bancaria válida.');
      return;
    }
    const availableBalance = financeState
      ? getAccountBalanceAsOf(financeState, draft.account, draft.date)
      : 0;
    const validation = validateTransfer(draft, availableBalance);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setSaving(true);
    setError('');
    let confirmedId = savedId;
    try {
      if (!confirmedId) {
        const saved = await saveMovement({
          date: draft.date,
          kind: 'transfer',
          amount: parseAmount(draft.amount),
          account: draft.account,
          toAccount: withdrawal ? cash!.id : draft.toAccount,
          note: draft.note.trim() || (withdrawal ? 'Retiro de efectivo' : ''),
        });
        confirmedId = saved.id;
        setSavedId(confirmedId);
      }
      const latest = await apiRequest<FinanceState>('/api/state');
      const refreshed = latest.movements.find((movement) => movement.id === confirmedId && movement.kind === 'transfer');
      if (!refreshed) throw new Error('El servidor guardó la transferencia, pero no aparece al actualizar el libro.');
      Alert.alert(withdrawal ? 'Retiro guardado' : 'Transferencia guardada', 'Los saldos ya están actualizados. No cuenta como ingreso ni gasto.', [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (submitError) {
      setError(confirmedId
        ? 'El servidor guardó la transferencia, pero no se pudo actualizar el libro. Reintenta; no volverá a guardarse.'
        : submitError instanceof Error ? submitError.message : 'No se pudo guardar la transferencia.');
    } finally {
      setSaving(false);
    }
  }

  function availableAt(accountId: AccountId) {
    return financeState ? getAccountBalanceAsOf(financeState, accountId, draft.date) : 0;
  }

  function changeSource(account: AccountId) {
    setDraft((current) => ({
      ...current,
      account,
      ...(!withdrawal && current.toAccount === account
        ? { toAccount: accounts.find((item) => item.id !== account)?.id ?? current.toAccount }
        : {}),
    }));
    setError('');
  }

  if (loading) return <SafeAreaView style={styles.safeArea}><View style={styles.state}><Text style={styles.helper}>Cargando cuentas…</Text></View></SafeAreaView>;
  if (!accounts.length) return <SafeAreaView style={styles.safeArea}><ScreenHeader title={withdrawal ? 'Retirar efectivo' : 'Transferir dinero'} subtitle="No se cargaron tus cuentas" onBack={() => router.back()} /><View style={styles.state}><Text style={styles.helper}>{error || 'No se pudieron cargar las cuentas.'}</Text><Button label="Reintentar" onPress={() => { setLoading(true); setRetry((value) => value + 1); }} style={styles.submitButton} /></View></SafeAreaView>;
  if (withdrawal && !banks.length) return <SafeAreaView style={styles.safeArea}><ScreenHeader title="Retirar efectivo" subtitle="De tu banco al efectivo" onBack={() => router.back()} /><View style={styles.state}><Text style={styles.helper}>{error || 'Agrega una cuenta bancaria para registrar retiros.'}</Text><Button label="Agregar cuenta" onPress={() => router.push('/balances')} style={styles.submitButton} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title={withdrawal ? 'Retirar efectivo' : 'Transferir dinero'} subtitle={withdrawal ? 'De tu banco al efectivo' : 'Entre tus cuentas'} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <GlassPanel style={styles.card}>
            <Text style={styles.helper}>{withdrawal ? 'Se resta de la cuenta bancaria y se suma al efectivo.' : 'El traslado cambia los saldos, pero no cuenta como ingreso ni gasto.'}</Text>
            <Text style={styles.dateHint}>Saldos disponibles al {draft.date}</Text>
            <Text style={styles.label}>Monto (USD)</Text>
            <Input accessibilityLabel="Monto en dólares" editable={savedId === null && !saving} keyboardType="decimal-pad" onChangeText={(amount) => { setDraft((current) => ({ ...current, amount })); setError(''); }} placeholder="0,00" style={ui.amount} value={draft.amount} />
            <AccountPicker accounts={withdrawal ? banks : accounts} balanceForAccount={availableAt} disabled={savedId !== null || saving} label="Desde" value={draft.account} onChange={changeSource} />
            {withdrawal ? <><Text style={styles.label}>Hacia: {cash?.name ?? 'Efectivo'}</Text><Text style={styles.dateHint}>Saldo al {draft.date}: {currency.format(cash ? availableAt(cash.id) : 0)}</Text></> : <AccountPicker accounts={accounts.filter((account) => account.id !== draft.account)} balanceForAccount={availableAt} disabled={savedId !== null || saving} label="Hacia" value={draft.toAccount} onChange={(toAccount) => { setDraft((current) => ({ ...current, toAccount })); setError(''); }} />}
            <Text style={styles.label}>Fecha</Text>
            <Input accessibilityLabel="Fecha" editable={savedId === null && !saving} keyboardType="numbers-and-punctuation" onChangeText={(date) => { setDraft((current) => ({ ...current, date })); setError(''); }} placeholder="AAAA-MM-DD" value={draft.date} />
            <Text style={styles.dateHint}>Formato: AAAA-MM-DD</Text>
            <Text style={styles.label}>Descripción (opcional)</Text>
            <Input accessibilityLabel="Descripción" editable={savedId === null && !saving} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} placeholder="Agrega un detalle" value={draft.note} />
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={saving} label={saving ? 'Guardando…' : savedId ? 'Actualizar libro' : withdrawal ? 'Guardar retiro' : 'Guardar transferencia'} onPress={() => void submit()} style={styles.submitButton} />
          </GlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountPicker({ accounts, balanceForAccount, label, value, disabled, onChange }: { accounts: Account[]; balanceForAccount: (account: AccountId) => number; label: string; value: AccountId; disabled: boolean; onChange: (account: AccountId) => void }) {
  const { ui, styles } = useStyles();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.accountRow}>
        {accounts.map((account) => {
          const selected = account.id === value;
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`${account.name}, disponible ${currency.format(balanceForAccount(account.id))}`} accessibilityState={{ selected, disabled }} disabled={disabled} key={account.id} onPress={() => onChange(account.id)} style={({ pressed }) => [styles.accountOption, selected && styles.accountOptionActive, disabled && ui.disabled, pressed && ui.pressed]}>
              <Text numberOfLines={2} style={[styles.accountText, selected && styles.accountTextActive]}>{selected ? '✓ ' : ''}{account.name}</Text>
              <Text style={[styles.accountBalance, selected && styles.accountTextActive]}>{currency.format(balanceForAccount(account.id))}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: ui.screen,
  scroll: { ...ui.content, paddingTop: 0 },
  card: ui.card,
  helper: { ...ui.helper, backgroundColor: colors.tint, borderRadius: 14, color: colors.primaryPressed, padding: 14 },
  label: ui.label,
  dateHint: { ...ui.helper, marginTop: 7 },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountOption: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 2, flexBasis: '47%', flexGrow: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 8, paddingVertical: 12 },
  accountOptionActive: { backgroundColor: colors.tint, borderColor: colors.primary },
  accountText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  accountTextActive: { color: colors.primary, fontWeight: '800' },
  accountBalance: { color: colors.muted, fontSize: 12, marginTop: 5 },
  state: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  submitButton: { marginTop: 28 },
}));
