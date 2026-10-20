import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState, saveCategories } from '../src/api/client';
import type { Category, FinanceState } from '../src/api/contracts';
import { Button, colors, Input, ScreenHeader, ui } from '../src/ui';

type CategoryKind = Category['kind'];

export default function CategoriesScreen() {
  const [data, setData] = useState<FinanceState | null>(null);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loadFinanceState());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los rubros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const categories = data?.categories.filter((category) => category.kind === kind) ?? [];

  function addCategory() {
    const name = newName.trim();
    if (!name || !data || saving || loading) return;
    setData({ ...data, categories: [...data.categories, { id: newCategoryId(), name, kind, active: true }] });
    setNewName('');
  }

  function updateCategory(id: string, update: Partial<Pick<Category, 'name' | 'active'>>) {
    setData((current) => current ? {
      ...current,
      categories: current.categories.map((category) => category.id === id ? { ...category, ...update } : category),
    } : current);
  }

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    setError('');
    let saved = false;
    try {
      await saveCategories(data.categories);
      saved = true;
      setData(await loadFinanceState());
      setNewName('');
      Alert.alert('Rubros guardados', 'El libro ya muestra los cambios.');
    } catch (saveError) {
      setError(saved
        ? 'Los rubros se guardaron, pero no se pudo actualizar la pantalla. Reintenta guardar.'
        : saveError instanceof Error ? saveError.message : 'No se pudieron guardar los rubros.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScreenHeader title="Rubros" subtitle="Organiza tus ingresos y gastos" onBack={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>

          {loading && !data ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Cargando rubros…</Text></View> : null}
          {!loading && !data ? (
            <View style={styles.state}><Text style={styles.stateText}>{error || 'No se pudieron cargar los rubros.'}</Text><Button label="Reintentar" onPress={() => void load()} style={styles.primary} /></View>
          ) : null}

          {data ? <>
            <View style={styles.kindSwitch}>
              <KindButton label="Gastos" active={kind === 'expense'} onPress={() => setKind('expense')} />
              <KindButton label="Ingresos" active={kind === 'income'} onPress={() => setKind('income')} />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Nuevo rubro</Text>
              <View style={styles.addRow}>
                <Input accessibilityLabel="Nombre del nuevo rubro" editable={!saving && !loading} onChangeText={setNewName} onSubmitEditing={addCategory} placeholder="Ej. Mascotas" returnKeyType="done" style={styles.addInput} value={newName} />
                <Button disabled={!newName.trim() || saving || loading} label="Añadir" onPress={addCategory} />
              </View>
              <Text style={styles.saveHint}>Añade o edita rubros y guarda los cambios al terminar.</Text>
            </View>

            <Text style={styles.sectionLabel}>{kind === 'income' ? 'Ingresos' : 'Gastos'} ({categories.length})</Text>
            {categories.length ? categories.map((category) => (
              <View key={category.id} style={[styles.categoryCard, !category.active && styles.inactiveCard]}>
                <Input
                  accessibilityLabel={`Nombre de ${category.name}`}
                  editable={!saving && !loading}
                  onChangeText={(name) => updateCategory(category.id, { name })}
                  selectTextOnFocus
                  style={styles.categoryInput}
                  value={category.name}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${category.active ? 'Desactivar' : 'Activar'} ${category.name}`}
                  accessibilityState={{ selected: category.active, disabled: saving || loading }}
                  disabled={saving || loading}
                  onPress={() => updateCategory(category.id, { active: !category.active })}
                  style={({ pressed }) => [styles.statusButton, category.active ? styles.activeButton : styles.inactiveButton, pressed && ui.pressed, (saving || loading) && ui.disabled]}
                >
                  <Text style={[styles.statusText, category.active ? styles.activeText : styles.inactiveText]}>{category.active ? '✓ Activo' : 'Inactivo'}</Text>
                </Pressable>
              </View>
            )) : <Text style={styles.empty}>Aún no hay rubros para esta sección.</Text>}

            {data.categories.some((category) => !category.name.trim()) ? <Text style={ui.error}>Todos los rubros deben tener un nombre para guardar.</Text> : null}
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
            <Button busy={saving} disabled={loading || data.categories.some((category) => !category.name.trim())} label={saving ? 'Guardando…' : 'Guardar cambios'} onPress={() => void save()} style={styles.primary} />
          </> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function KindButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.kindButton, active && styles.kindButtonActive, pressed && ui.pressed]}><Text style={[styles.kindText, active && styles.kindTextActive]}>{label}</Text></Pressable>;
}

function newCategoryId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const styles = StyleSheet.create({
  safeArea: ui.screen,
  content: { ...ui.content, paddingTop: 0 },
  state: { alignItems: 'center', paddingVertical: 48 },
  stateText: { ...ui.helper, marginTop: 12, textAlign: 'center' },
  kindSwitch: { ...ui.segmented, marginBottom: 18 },
  kindButton: ui.segment,
  kindButtonActive: ui.segmentActive,
  kindText: ui.segmentText,
  kindTextActive: ui.segmentTextActive,
  card: { ...ui.card, marginBottom: 24 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  addRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  addInput: { flex: 1, minWidth: 0 },
  saveHint: { ...ui.helper, marginTop: 12 },
  sectionLabel: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 12 },
  categoryCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, flexDirection: 'row', gap: 8, marginBottom: 10, padding: 10 },
  inactiveCard: { backgroundColor: '#E9EEF1' },
  categoryInput: { backgroundColor: 'transparent', borderColor: 'transparent', flex: 1, fontSize: 15, fontWeight: '600', minWidth: 0, paddingHorizontal: 8 },
  statusButton: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 48, minWidth: 82, paddingHorizontal: 10, paddingVertical: 10 },
  activeButton: { backgroundColor: colors.tint },
  inactiveButton: { backgroundColor: '#DEE6EB' },
  statusText: { fontSize: 12, fontWeight: '700' },
  activeText: { color: colors.primary },
  inactiveText: { color: colors.muted },
  empty: { ...ui.helper, paddingVertical: 20, textAlign: 'center' },
  primary: { marginTop: 14 },
});
