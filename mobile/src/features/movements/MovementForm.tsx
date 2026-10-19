import { useState } from 'react';
import {
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
import type { AccountId, Category } from '../../api/contracts';
import { validateMovement, type MovementDraft } from './validation';

const accountOptions: Array<{ id: AccountId; label: string }> = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'bank', label: 'Débito' },
];

type Props = {
  title: string;
  initialDraft: MovementDraft;
  categories: Category[];
  error: string;
  submitLabel: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (draft: MovementDraft) => void;
  onDelete?: () => void;
  deleteLabel?: string;
  deleting?: boolean;
  locked?: boolean;
};

export function MovementForm({
  title,
  initialDraft,
  categories,
  error,
  submitLabel,
  submitting,
  onBack,
  onSubmit,
  onDelete,
  deleteLabel = 'Eliminar movimiento',
  deleting = false,
  locked = false,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [validationError, setValidationError] = useState('');
  const availableCategories = categories.filter((category) => (
    category.kind === draft.kind && (category.active || category.id === draft.categoryId)
  ));

  function changeKind(kind: MovementDraft['kind']) {
    setDraft((current) => ({
      ...current,
      kind,
      categoryId: categories.find((category) => category.kind === kind && category.active)?.id ?? '',
    }));
    setValidationError('');
  }

  function submit() {
    const result = validateMovement(draft);
    if (!result.ok) {
      setValidationError(result.message);
      return;
    }
    setValidationError('');
    onSubmit({ ...draft, amount: String(parseFloat(draft.amount.trim().replace(',', '.'))) });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headingRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} style={styles.backButton}>
              <Text style={styles.backIcon}>‹</Text>
            </Pressable>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>MOVIMIENTO</Text>
              <Text style={styles.heading}>{title}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.kindSwitch}>
              <KindButton label="Ingreso" active={draft.kind === 'income'} disabled={locked || submitting || deleting} onPress={() => changeKind('income')} />
              <KindButton label="Gasto" active={draft.kind === 'expense'} disabled={locked || submitting || deleting} onPress={() => changeKind('expense')} />
            </View>

            <Text style={styles.label}>Monto</Text>
            <TextInput
              accessibilityLabel="Monto"
              editable={!locked && !submitting && !deleting}
              keyboardType="decimal-pad"
              onChangeText={(amount) => { setDraft((current) => ({ ...current, amount })); setValidationError(''); }}
              placeholder="0.00"
              placeholderTextColor="#8a928c"
              style={styles.input}
              value={draft.amount}
            />

            <Text style={styles.label}>Rubro</Text>
            {availableCategories.length ? (
              <ScrollView horizontal contentContainerStyle={styles.categoryRow} showsHorizontalScrollIndicator={false}>
                {availableCategories.map((category) => {
                  const selected = category.id === draft.categoryId;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={locked || submitting || deleting}
                      key={category.id}
                      onPress={() => { setDraft((current) => ({ ...current, categoryId: category.id })); setValidationError(''); }}
                      style={[styles.option, selected && styles.optionActive]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextActive]}>{category.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : <Text style={styles.helper}>No hay rubros activos para este tipo.</Text>}

            <Text style={styles.label}>{draft.kind === 'income' ? 'Recibir en' : 'Pagar con'}</Text>
            <View style={styles.accountRow}>
              {accountOptions.map((account) => {
                const selected = draft.account === account.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={locked || submitting || deleting}
                    key={account.id}
                    onPress={() => setDraft((current) => ({ ...current, account: account.id }))}
                    style={[styles.accountOption, selected && styles.accountOptionActive]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>{account.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Fecha</Text>
            <TextInput
              accessibilityLabel="Fecha"
              editable={!locked && !submitting && !deleting}
              keyboardType="numbers-and-punctuation"
              onChangeText={(date) => { setDraft((current) => ({ ...current, date })); setValidationError(''); }}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#8a928c"
              style={styles.input}
              value={draft.date}
            />

            <Text style={styles.label}>Descripción (opcional)</Text>
            <TextInput
              accessibilityLabel="Descripción"
              editable={!locked && !submitting && !deleting}
              onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
              placeholder="Agrega un detalle"
              placeholderTextColor="#8a928c"
              style={[styles.input, styles.noteInput]}
              value={draft.note}
            />

            {validationError || error ? <Text accessibilityRole="alert" style={styles.error}>{validationError || error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting || deleting }}
              disabled={submitting || deleting}
              onPress={submit}
              style={({ pressed }) => [styles.submitButton, pressed && styles.submitPressed, (submitting || deleting) && styles.disabled]}
            >
              <Text style={styles.submitText}>{submitting ? 'Guardando…' : submitLabel}</Text>
            </Pressable>

            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                disabled={submitting || deleting}
                onPress={onDelete}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>{deleting ? 'Eliminando…' : deleteLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function KindButton({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} style={[styles.kindButton, active && styles.kindButtonActive, disabled && styles.disabled]}>
      <Text style={[styles.kindText, active && styles.kindTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: '#f5f6f2', flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 12 },
  headingRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 19 },
  backButton: { alignItems: 'center', backgroundColor: '#e7eee7', borderRadius: 13, height: 42, justifyContent: 'center', marginRight: 12, width: 42 },
  backIcon: { color: '#315a45', fontSize: 31, lineHeight: 35, marginTop: -2 },
  headingCopy: { flex: 1 },
  eyebrow: { color: '#47725d', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: '#182a24', fontSize: 24, fontWeight: '800', marginTop: 4 },
  card: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 20, borderWidth: 1, padding: 17 },
  kindSwitch: { backgroundColor: '#f2f5f1', borderRadius: 13, flexDirection: 'row', marginBottom: 21, padding: 4 },
  kindButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 11 },
  kindButtonActive: { backgroundColor: '#173c32' },
  kindText: { color: '#718078', fontSize: 13, fontWeight: '700' },
  kindTextActive: { color: '#ffffff' },
  label: { color: '#30483b', fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 17 },
  input: { backgroundColor: '#f8faf7', borderColor: '#dce4dc', borderRadius: 12, borderWidth: 1, color: '#182a24', fontSize: 15, height: 48, paddingHorizontal: 13 },
  noteInput: { minHeight: 48, paddingTop: 13 },
  categoryRow: { gap: 8, paddingRight: 5 },
  option: { backgroundColor: '#f8faf7', borderColor: '#dce4dc', borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  optionActive: { backgroundColor: '#e2eee5', borderColor: '#b5d0bd' },
  optionText: { color: '#6b786f', fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: '#24533d', fontWeight: '800' },
  helper: { color: '#8a928c', fontSize: 12, marginTop: 2 },
  accountRow: { flexDirection: 'row', gap: 8 },
  accountOption: { alignItems: 'center', backgroundColor: '#f8faf7', borderColor: '#dce4dc', borderRadius: 11, borderWidth: 1, flex: 1, paddingVertical: 12 },
  accountOptionActive: { backgroundColor: '#e2eee5', borderColor: '#b5d0bd' },
  error: { backgroundColor: '#fff0ec', borderRadius: 11, color: '#a33d37', fontSize: 12, lineHeight: 18, marginTop: 15, padding: 10 },
  submitButton: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 13, marginTop: 22, paddingVertical: 14 },
  submitPressed: { backgroundColor: '#245644' },
  disabled: { opacity: 0.65 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  deleteButton: { alignItems: 'center', marginTop: 14, paddingVertical: 12 },
  deleteText: { color: '#a33d37', fontSize: 13, fontWeight: '700' },
});
