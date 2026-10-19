import { useState } from 'react';
import {
  Alert,
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
import { apiRequest, saveMovement } from '../../src/api/client';
import type { AccountId, FinanceState } from '../../src/api/contracts';
import { parseAmount, validateTransfer, type TransferDraft } from '../../src/features/movements/validation';

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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.backButton}><Text style={styles.backIcon}>‹</Text></Pressable>
            <View><Text style={styles.eyebrow}>ENTRE TUS CUENTAS</Text><Text style={styles.title}>Transferir dinero</Text></View>
          </View>
          <View style={styles.card}>
            <Text style={styles.helper}>El traslado cambia los saldos, pero no cuenta como ingreso ni gasto.</Text>
            <Text style={styles.label}>Monto</Text>
            <TextInput accessibilityLabel="Monto" editable={savedId === null && !saving} keyboardType="decimal-pad" onChangeText={(amount) => { setDraft((current) => ({ ...current, amount })); setError(''); }} placeholder="0.00" placeholderTextColor="#8a928c" style={styles.input} value={draft.amount} />
            <AccountPicker disabled={savedId !== null || saving} label="Desde" value={draft.account} onChange={(account) => { setDraft((current) => ({ ...current, account })); setError(''); }} />
            <AccountPicker disabled={savedId !== null || saving} label="Hacia" value={draft.toAccount} onChange={(toAccount) => { setDraft((current) => ({ ...current, toAccount })); setError(''); }} />
            <Text style={styles.label}>Fecha</Text>
            <TextInput accessibilityLabel="Fecha" editable={savedId === null && !saving} keyboardType="numbers-and-punctuation" onChangeText={(date) => { setDraft((current) => ({ ...current, date })); setError(''); }} placeholder="AAAA-MM-DD" placeholderTextColor="#8a928c" style={styles.input} value={draft.date} />
            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput accessibilityLabel="Descripción" editable={savedId === null && !saving} onChangeText={(note) => setDraft((current) => ({ ...current, note }))} placeholder="Agrega un detalle" placeholderTextColor="#8a928c" style={styles.input} value={draft.note} />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submit()} style={[styles.submitButton, saving && styles.disabled]}>
              <Text style={styles.submitText}>{saving ? 'Guardando…' : savedId ? 'Actualizar libro' : 'Guardar transferencia'}</Text>
            </Pressable>
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
            <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} key={account.id} onPress={() => onChange(account.id)} style={[styles.accountOption, selected && styles.accountOptionActive, disabled && styles.disabled]}>
              <Text style={[styles.accountText, selected && styles.accountTextActive]}>{account.label}</Text>
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
  safeArea: { backgroundColor: '#f5f6f2', flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 12 },
  header: { alignItems: 'center', flexDirection: 'row', marginBottom: 19 },
  backButton: { alignItems: 'center', backgroundColor: '#e7eee7', borderRadius: 13, height: 42, justifyContent: 'center', marginRight: 12, width: 42 },
  backIcon: { color: '#315a45', fontSize: 31, lineHeight: 35, marginTop: -2 },
  eyebrow: { color: '#47725d', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#182a24', fontSize: 22, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 20, borderWidth: 1, padding: 17 },
  helper: { backgroundColor: '#edf4ee', borderRadius: 12, color: '#466354', fontSize: 12, lineHeight: 18, padding: 12 },
  label: { color: '#30483b', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 17 },
  input: { backgroundColor: '#f8faf7', borderColor: '#dce4dc', borderRadius: 12, borderWidth: 1, color: '#182a24', fontSize: 15, height: 48, paddingHorizontal: 13 },
  accountRow: { flexDirection: 'row', gap: 8 },
  accountOption: { alignItems: 'center', backgroundColor: '#f8faf7', borderColor: '#dce4dc', borderRadius: 11, borderWidth: 1, flex: 1, paddingVertical: 12 },
  accountOptionActive: { backgroundColor: '#e2eee5', borderColor: '#b5d0bd' },
  accountText: { color: '#6b786f', fontSize: 12, fontWeight: '600' },
  accountTextActive: { color: '#24533d', fontWeight: '800' },
  error: { backgroundColor: '#fff0ec', borderRadius: 11, color: '#a33d37', fontSize: 12, lineHeight: 18, marginTop: 15, padding: 10 },
  submitButton: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 13, marginTop: 22, paddingVertical: 14 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
