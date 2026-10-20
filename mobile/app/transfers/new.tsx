import { useState } from 'react';
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
import { router } from 'expo-router';
import { apiRequest, saveMovement } from '../../src/api/client';
import type { AccountId, FinanceState } from '../../src/api/contracts';
import { parseAmount, validateTransfer, type TransferDraft } from '../../src/features/movements/validation';
import { Button, colors, Input, ScreenHeader, ui } from '../../src/ui';

const accounts: Array<{ id: AccountId; label: string }> = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'bank', label: 'Débito' },
];

export default function NewTransferScreen() {
  const [draft, setDraft] = useState<TransferDraft>({
    date: localDate(), amount: '', account: 'cash', toAccount: 'bank', note: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function submit() {
    const validation = validateTransfer(draft);
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
          toAccount: draft.toAccount,
          note: draft.note.trim(),
        });
        confirmedId = saved.id;
        setSavedId(confirmedId);
      }
      const latest = await apiRequest<FinanceState>('/api/state');
      const refreshed = latest.movements.find((movement) => movement.id === confirmedId && movement.kind === 'transfer');
      if (!refreshed) throw new Error('El servidor guardó la transferencia, pero no aparece al actualizar el libro.');
      Alert.alert('Transferencia guardada', 'Los saldos ya están actualizados. No cuenta como ingreso ni gasto.', [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (submitError) {
      setError(confirmedId
        ? 'El servidor guardó la transferencia, pero no se pudo actualizar el libro. Reintenta; no volverá a guardarse.'
        : submitError instanceof Error ? submitError.message : 'No se pudo guardar la transferencia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title="Transferir dinero" subtitle="Entre tus cuentas" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.card}>
            <Text style={styles.helper}>El traslado cambia los saldos, pero no cuenta como ingreso ni gasto.</Text>
            <Text style={styles.label}>Monto (USD)</Text>
            <Input accessibilityLabel="Monto en dólares" editable={savedId === null && !saving} keyboardType="decimal-pad" onChangeText={(amount) => { setDraft((current) => ({ ...current, amount })); setError(''); }} placeholder="0,00" style={ui.amount} value={draft.amount} />
            <AccountPicker disabled={savedId !== null || saving} label="Desde" value={draft.account} onChange={(account) => { setDraft((current) => ({ ...current, account })); setError(''); }} />
            <AccountPicker disabled={savedId !== null || saving} label="Hacia" value={draft.toAccount} onChange={(toAccount) => { setDraft((current) => ({ ...current, toAccount })); setError(''); }} />
            <Text style={styles.label}>Fecha</Text>
            <Input accessibilityLabel="Fecha" editable={savedId === null && !saving} keyboardType="numbers-and-punctuation" onChangeText={(date) => { setDraft((current) => ({ ...current, date })); setError(''); }} placeholder="AAAA-MM-DD" value={draft.date} />
            <Text style={styles.dateHint}>Formato: AAAA-MM-DD</Text>
            <Text style={styles.label}>Descripción (opcional)</Text>
            <Input accessibilityLabel="Descripción" editable={savedId === null && !saving} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} placeholder="Agrega un detalle" value={draft.note} />
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={saving} label={saving ? 'Guardando…' : savedId ? 'Actualizar libro' : 'Guardar transferencia'} onPress={() => void submit()} style={styles.submitButton} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountPicker({ label, value, disabled, onChange }: { label: string; value: AccountId; disabled: boolean; onChange: (account: AccountId) => void }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.accountRow}>
        {accounts.map((account) => {
          const selected = account.id === value;
          return (
            <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} key={account.id} onPress={() => onChange(account.id)} style={({ pressed }) => [styles.accountOption, selected && styles.accountOptionActive, disabled && ui.disabled, pressed && ui.pressed]}>
              <Text style={[styles.accountText, selected && styles.accountTextActive]}>{selected ? '✓ ' : ''}{account.label}</Text>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: ui.screen,
  scroll: { ...ui.content, paddingTop: 0 },
  card: ui.card,
  helper: { ...ui.helper, backgroundColor: colors.tint, borderRadius: 14, color: colors.primaryPressed, padding: 14 },
  label: ui.label,
  dateHint: { ...ui.helper, marginTop: 7 },
  accountRow: { flexDirection: 'row', gap: 8 },
  accountOption: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 2, flex: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 8, paddingVertical: 12 },
  accountOptionActive: { backgroundColor: colors.tint, borderColor: colors.primary },
  accountText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  accountTextActive: { color: colors.primary, fontWeight: '800' },
  submitButton: { marginTop: 28 },
});
