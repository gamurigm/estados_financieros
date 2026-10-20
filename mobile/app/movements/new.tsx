import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { apiRequest, saveMovement } from '../../src/api/client';
import type { Account, Category, FinanceState, Movement } from '../../src/api/contracts';
import { MovementForm } from '../../src/features/movements/MovementForm';
import { parseAmount, type MovementDraft } from '../../src/features/movements/validation';
import { Button, createThemedStyles } from '../../src/ui';

export default function NewMovementScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: MovementDraft['kind'] = params.kind === 'income' ? 'income' : 'expense';
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [draft, setDraft] = useState<MovementDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const state = await apiRequest<FinanceState>('/api/state');
      setCategories(state.categories);
      setAccounts(state.accounts);
      setDraft((current) => current ?? {
        date: localDate(),
        kind,
        amount: '',
        categoryId: state.categories.find((item) => item.active && item.kind === kind)?.id ?? '',
        account: state.accounts.find((account) => account.kind === 'cash')?.id ?? 'cash',
        note: '',
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los rubros.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);

  async function submit(nextDraft: MovementDraft) {
    setSaving(true);
    setError('');
    let confirmedId = savedId;
    try {
      if (!confirmedId) {
        const result = await saveMovement(toPayload(nextDraft));
        confirmedId = result.id;
        setSavedId(confirmedId);
      }
      const latest = await apiRequest<FinanceState>('/api/state');
      if (!latest.movements.some((movement) => movement.id === confirmedId)) {
        throw new Error('El servidor guardó el movimiento, pero no aparece al actualizar el libro.');
      }
      Alert.alert('Movimiento guardado', 'El libro ya muestra el cambio.', [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (submitError) {
      setError(confirmedId
        ? 'El servidor guardó el movimiento, pero no se pudo actualizar el libro. Reintenta; no volverá a guardarse.'
        : submitError instanceof Error ? submitError.message : 'No se pudo guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) return <StateScreen message="Cargando rubros…" />;
  if (!categories || !draft) return <StateScreen message={error || 'No se pudo abrir el formulario.'} retry={() => { void loadCategories(); }} />;

  return (
    <MovementForm
      accounts={accounts}
      categories={categories}
      error={error}
      initialDraft={draft}
      key={`${kind}-${draft.date}`}
      locked={savedId !== null}
      onBack={() => router.back()}
      onSubmit={(value) => { void submit(value); }}
      submitLabel={savedId ? 'Actualizar libro' : 'Guardar movimiento'}
      submitting={saving}
      title={savedId ? 'Movimiento guardado' : kind === 'income' ? 'Registrar ingreso' : 'Registrar gasto'}
    />
  );
}

function toPayload(draft: MovementDraft): Omit<Movement, 'id'> {
  const amount = parseAmount(draft.amount);
  return {
    date: draft.date,
    kind: draft.kind,
    amount,
    categoryId: draft.categoryId,
    ...(draft.kind === 'income' ? { toAccount: draft.account } : { account: draft.account }),
    note: draft.note.trim(),
  };
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function StateScreen({ message, retry }: { message: string; retry?: () => void }) {
  const { colors, styles } = useStyles();
  return (
    <View style={styles.state}>
      {retry ? null : <ActivityIndicator color={colors.primary} />}
      <Text style={styles.stateText}>{message}</Text>
      {retry ? <Button label="Reintentar" onPress={retry} style={styles.retry} /> : null}
      <Button label="Volver al libro" onPress={() => router.back()} style={styles.back} variant="secondary" />
    </View>
  );
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  state: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', padding: 30 },
  stateText: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14, textAlign: 'center' },
  retry: { marginTop: 24 },
  back: { marginTop: 12 },
}));
