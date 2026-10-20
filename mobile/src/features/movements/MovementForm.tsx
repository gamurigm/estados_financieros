import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AccountId, Category } from '../../api/contracts';
import { validateMovement, type MovementDraft } from './validation';
import { Button, Input, ScreenHeader, createThemedStyles, GlassPanel } from '../../ui';

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
  const { ui, styles } = useStyles();
  const [draft, setDraft] = useState(initialDraft);
  const [validationError, setValidationError] = useState('');
  const [choosingCategory, setChoosingCategory] = useState(false);
  const availableCategories = categories.filter((category) => (
    category.kind === draft.kind && (category.active || category.id === draft.categoryId)
  ));
  const categoryName = availableCategories.find((category) => category.id === draft.categoryId)?.name ?? 'Seleccionar rubro';

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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title={title} subtitle="Los detalles de tu movimiento" onBack={onBack} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          <GlassPanel style={styles.card}>
            <View style={styles.kindSwitch}>
              <KindButton label="Ingreso" active={draft.kind === 'income'} disabled={locked || submitting || deleting} onPress={() => changeKind('income')} />
              <KindButton label="Gasto" active={draft.kind === 'expense'} disabled={locked || submitting || deleting} onPress={() => changeKind('expense')} />
            </View>

            <Text style={styles.label}>Monto (USD)</Text>
            <Input
              accessibilityLabel="Monto"
              editable={!locked && !submitting && !deleting}
              keyboardType="decimal-pad"
              onChangeText={(amount) => { setDraft((current) => ({ ...current, amount })); setValidationError(''); }}
              placeholder="0,00"
              style={ui.amount}
              value={draft.amount}
            />

            <Text style={styles.label}>Rubro</Text>
            {availableCategories.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rubro: ${categoryName}`}
                accessibilityHint="Abre la lista completa de rubros"
                accessibilityState={{ expanded: choosingCategory, disabled: locked || submitting || deleting }}
                disabled={locked || submitting || deleting}
                onPress={() => { Keyboard.dismiss(); setChoosingCategory(true); }}
                style={({ pressed }) => [styles.categorySelect, pressed && ui.pressed, (locked || submitting || deleting) && ui.disabled]}
              >
                <Text style={styles.categoryName}>{categoryName}</Text>
                <Text style={styles.changeText}>Cambiar ⌄</Text>
              </Pressable>
            ) : <Text style={styles.helper}>No hay rubros activos para este tipo.</Text>}

            <Text style={styles.label}>{draft.kind === 'income' ? 'Recibir en' : 'Pagar con'}</Text>
            <View style={styles.accountRow}>
              {accountOptions.map((account) => {
                const selected = draft.account === account.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: locked || submitting || deleting }}
                    disabled={locked || submitting || deleting}
                    key={account.id}
                    onPress={() => setDraft((current) => ({ ...current, account: account.id }))}
                    style={({ pressed }) => [styles.accountOption, selected && styles.accountOptionActive, pressed && ui.pressed, (locked || submitting || deleting) && ui.disabled]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>{selected ? '✓ ' : ''}{account.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Fecha</Text>
            <Input
              accessibilityLabel="Fecha"
              editable={!locked && !submitting && !deleting}
              keyboardType="numbers-and-punctuation"
              onChangeText={(date) => { setDraft((current) => ({ ...current, date })); setValidationError(''); }}
              placeholder="AAAA-MM-DD"
              value={draft.date}
            />
            <Text style={styles.dateHint}>Formato: AAAA-MM-DD</Text>

            <Text style={styles.label}>Descripción (opcional)</Text>
            <Input
              accessibilityLabel="Descripción"
              editable={!locked && !submitting && !deleting}
              onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
              placeholder="Agrega un detalle"
              value={draft.note}
            />

            {validationError || error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{validationError || error}</Text> : null}

            <Button
              busy={submitting}
              disabled={deleting}
              label={submitting ? 'Guardando…' : submitLabel}
              onPress={submit}
              style={styles.submitButton}
            />

            {onDelete ? (
              <Button
                busy={deleting}
                disabled={submitting}
                label={deleting ? 'Eliminando…' : deleteLabel}
                onPress={onDelete}
                style={styles.deleteButton}
                variant="danger"
              />
            ) : null}
          </GlassPanel>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal transparent visible={choosingCategory} onRequestClose={() => setChoosingCategory(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar lista de rubros" onPress={() => setChoosingCategory(false)} style={StyleSheet.absoluteFill} />
          <SafeAreaView accessibilityViewIsModal edges={['bottom']} style={styles.categorySheet}>
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={ui.title}>Elige un rubro</Text>
              <Button label="Cerrar" variant="secondary" onPress={() => setChoosingCategory(false)} />
            </View>
            <ScrollView contentContainerStyle={styles.categoryRow}>
              {availableCategories.map((category) => {
                const selected = category.id === draft.categoryId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={category.id}
                    onPress={() => { setDraft((current) => ({ ...current, categoryId: category.id })); setValidationError(''); setChoosingCategory(false); }}
                    style={({ pressed }) => [styles.option, selected && styles.optionActive, pressed && ui.pressed]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextActive]}>{selected ? '✓ ' : ''}{category.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function KindButton({ label, active, disabled, onPress }: { label: string; active: boolean; disabled: boolean; onPress: () => void }) {
  const { ui, styles } = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.kindButton, active && styles.kindButtonActive, disabled && ui.disabled, pressed && ui.pressed]}>
      <Text style={[styles.kindText, active && styles.kindTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: ui.screen,
  scroll: { ...ui.content, paddingTop: 0 },
  card: ui.card,
  kindSwitch: ui.segmented,
  kindButton: ui.segment,
  kindButtonActive: { backgroundColor: colors.primary },
  kindText: ui.segmentText,
  kindTextActive: { color: colors.onPrimary, fontWeight: '800' },
  label: ui.label,
  categorySelect: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 14, borderWidth: 2, flexDirection: 'row', gap: 10, minHeight: 54, paddingHorizontal: 14, paddingVertical: 14 },
  categoryName: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '600' },
  changeText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  modalBackdrop: { backgroundColor: 'rgba(3,8,24,0.7)', flex: 1, justifyContent: 'flex-end' },
  categorySheet: { backgroundColor: colors.surfaceSolid, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '85%', padding: 20 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 20 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
  option: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 2, justifyContent: 'center', minHeight: 48, paddingHorizontal: 12, paddingVertical: 10 },
  optionActive: { backgroundColor: colors.tint, borderColor: colors.primary },
  optionText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  optionTextActive: { color: colors.primary, fontWeight: '800' },
  helper: ui.helper,
  dateHint: { ...ui.helper, marginTop: 7 },
  accountRow: { flexDirection: 'row', gap: 8 },
  accountOption: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 13, borderWidth: 2, flex: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: 8, paddingVertical: 12 },
  accountOptionActive: { backgroundColor: colors.tint, borderColor: colors.primary },
  submitButton: { marginTop: 28 },
  deleteButton: { marginTop: 12 },
}));
