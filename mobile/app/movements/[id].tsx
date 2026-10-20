import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { apiRequest, deleteMovement, saveMovement } from '../../src/api/client';
import type { Category, FinanceState, Movement } from '../../src/api/contracts';
import { MovementForm } from '../../src/features/movements/MovementForm';
import { parseAmount, type MovementDraft } from '../../src/features/movements/validation';
import { Button, colors } from '../../src/ui';

export default function EditMovementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [movement, setMovement] = useState<Movement | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<MovementDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const loadMovement = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const state = await apiRequest<FinanceState>('/api/state');
      const current = state.movements.find((item) => item.id === id);
      if (!current || current.kind === 'transfer') {
        setMovement(null);
        setDraft(null);
        setError(current ? 'Las transferencias se pueden consultar desde el libro.' : 'Movimiento no encontrado.');
        return;
      }
      setMovement(current);
      setCategories(state.categories);
      setDraft({
        id: current.id,
        date: current.date,
        kind: current.kind,
        amount: String(current.amount),
        categoryId: current.categoryId ?? '',
        account: current.kind === 'income' ? current.toAccount ?? 'cash' : current.account ?? 'cash',
        note: current.note,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el movimiento.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void loadMovement(); }, [loadMovement]);

  async function submit(nextDraft: MovementDraft) {
    if (!movement) return;
    setSaving(true);
    setError('');
    let confirmed = saveConfirmed;
    try {
      if (!confirmed) {
        await saveMovement(toPayload(nextDraft), movement.id);
        confirmed = true;
        setSaveConfirmed(true);
      }
      const latest = await apiRequest<FinanceState>('/api/state');
      const saved = latest.movements.find((item) => item.id === movement.id);
      if (!saved || saved.date !== nextDraft.date || saved.amount !== parseAmount(nextDraft.amount) || saved.kind !== nextDraft.kind) {
        throw new Error('El servidor guardó los cambios, pero el libro no refleja la edición.');
      }
      Alert.alert('Movimiento actualizado', 'El libro ya muestra el cambio.', [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (submitError) {
      setError(confirmed
        ? 'El servidor guardó los cambios, pero no se pudo actualizar el libro. Reintenta; no volverán a guardarse.'
        : submitError instanceof Error ? submitError.message : 'No se pudo guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (deleteConfirmed) {
      void removeMovement();
      return;
    }
    Alert.alert('Eliminar movimiento', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { void removeMovement(); } },
    ]);
  }

  async function removeMovement() {
    if (!movement) return;
    setDeleting(true);
    setError('');
    let confirmed = deleteConfirmed;
    try {
      if (!confirmed) {
        await deleteMovement(movement.id);
        confirmed = true;
        setDeleteConfirmed(true);
      }
      const latest = await apiRequest<FinanceState>('/api/state');
      if (latest.movements.some((item) => item.id === movement.id)) {
        throw new Error('El servidor eliminó el movimiento, pero el libro todavía lo muestra.');
      }
      Alert.alert('Movimiento eliminado', 'El libro ya está actualizado.', [{ text: 'Listo', onPress: () => router.back() }]);
    } catch (deleteError) {
      setError(confirmed
        ? 'El servidor eliminó el movimiento, pero no se pudo actualizar el libro. Reintenta la actualización.'
        : deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el movimiento.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <StateScreen message="Cargando movimiento…" />;
  if (!movement || !draft) return <StateScreen message={error || 'Movimiento no encontrado.'} retry={() => { void loadMovement(); }} />;

  return (
    <MovementForm
      categories={categories}
      deleteLabel={deleteConfirmed ? 'Actualizar libro' : 'Eliminar movimiento'}
      deleting={deleting}
      error={error}
      initialDraft={draft}
      key={movement.id}
      locked={saveConfirmed || deleteConfirmed}
      onBack={() => router.back()}
      onDelete={confirmDelete}
      onSubmit={(value) => { void submit(value); }}
      submitLabel={saveConfirmed ? 'Actualizar libro' : 'Guardar cambios'}
      submitting={saving}
      title="Editar movimiento"
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

function StateScreen({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <View style={styles.state}>
      {retry ? null : <ActivityIndicator color={colors.primary} />}
      <Text style={styles.stateText}>{message}</Text>
      {retry ? <Button label="Reintentar" onPress={retry} style={styles.retry} /> : null}
      <Button label="Volver al libro" onPress={() => router.back()} style={styles.back} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center', padding: 30 },
  stateText: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14, textAlign: 'center' },
  retry: { marginTop: 24 },
  back: { marginTop: 12 },
});
