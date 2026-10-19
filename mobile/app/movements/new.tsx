import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { apiRequest, saveMovement } from '../../src/api/client';
import type { Category, FinanceState, Movement } from '../../src/api/contracts';
import { MovementForm } from '../../src/features/movements/MovementForm';
import { parseAmount, type MovementDraft } from '../../src/features/movements/validation';

export default function NewMovementScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: MovementDraft['kind'] = params.kind === 'income' ? 'income' : 'expense';
  const [categories, setCategories] = useState<Category[] | null>(null);
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
      setDraft((current) => current ?? {
        date: localDate(),
        kind,
        amount: '',
        categoryId: state.categories.find((item) => item.active && item.kind === kind)?.id ?? '',
        account: 'cash',
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
  return (
    <View style={styles.state}>
      {retry ? null : <ActivityIndicator color="#173c32" />}
      <Text style={styles.stateText}>{message}</Text>
      {retry ? <Pressable onPress={retry} style={styles.retry}><Text style={styles.retryText}>Reintentar</Text></Pressable> : null}
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>Volver</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', backgroundColor: '#f5f6f2', flex: 1, justifyContent: 'center', padding: 30 },
  stateText: { color: '#66736c', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  retry: { backgroundColor: '#173c32', borderRadius: 12, marginTop: 18, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  back: { marginTop: 16, padding: 10 },
  backText: { color: '#315e45', fontSize: 13, fontWeight: '700' },
});
