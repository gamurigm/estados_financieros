import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState, saveCategories } from '../src/api/client';
import type { Category, FinanceState } from '../src/api/contracts';

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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
          <View style={styles.headerText}><Text style={styles.eyebrow}>PERSONALIZA TU HOJA</Text><Text style={styles.title}>Rubros</Text></View>
        </View>

        {loading && !data ? <View style={styles.state}><ActivityIndicator color="#173c32" /><Text style={styles.stateText}>Cargando rubros…</Text></View> : null}
        {!loading && !data ? (
          <View style={styles.state}><Text style={styles.stateText}>{error || 'No se pudieron cargar los rubros.'}</Text><Pressable onPress={() => void load()} style={styles.primary}><Text style={styles.primaryText}>Reintentar</Text></Pressable></View>
        ) : null}

        {data ? <>
          <View style={styles.kindSwitch}>
            <KindButton label="Gastos" active={kind === 'expense'} onPress={() => setKind('expense')} />
            <KindButton label="Ingresos" active={kind === 'income'} onPress={() => setKind('income')} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Nuevo rubro</Text>
            <View style={styles.addRow}>
              <TextInput accessibilityLabel="Nombre del nuevo rubro" onChangeText={setNewName} placeholder="Ej. Mascotas" placeholderTextColor="#98a29b" style={styles.addInput} value={newName} />
              <Pressable accessibilityRole="button" disabled={!newName.trim() || saving || loading} onPress={addCategory} style={[styles.addButton, (!newName.trim() || saving || loading) && styles.disabled]}><Text style={styles.primaryText}>Agregar</Text></Pressable>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{kind === 'income' ? 'INGRESOS' : 'GASTOS'} · {categories.length}</Text>
          {categories.length ? categories.map((category) => (
            <View key={category.id} style={[styles.categoryCard, !category.active && styles.inactiveCard]}>
              <TextInput
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
                accessibilityState={{ selected: category.active }}
                disabled={saving || loading}
                onPress={() => updateCategory(category.id, { active: !category.active })}
                style={[styles.statusButton, category.active ? styles.activeButton : styles.inactiveButton]}
              >
                <Text style={[styles.statusText, category.active ? styles.activeText : styles.inactiveText]}>{category.active ? 'Activo' : 'Inactivo'}</Text>
              </Pressable>
            </View>
          )) : <Text style={styles.empty}>Aún no hay rubros para esta sección.</Text>}

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={saving || loading || data.categories.some((category) => !category.name.trim())} onPress={() => void save()} style={[styles.primary, (saving || loading || data.categories.some((category) => !category.name.trim())) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Guardar cambios</Text>}
          </Pressable>
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function KindButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.kindButton, active && styles.kindButtonActive]}><Text style={[styles.kindText, active && styles.kindTextActive]}>{label}</Text></Pressable>;
}

function newCategoryId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f5f6f2', flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', marginBottom: 24 },
  back: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e0e6df', borderRadius: 13, borderWidth: 1, height: 43, justifyContent: 'center', marginRight: 13, width: 43 },
  backText: { color: '#315a45', fontSize: 31, lineHeight: 34, marginTop: -4 },
  headerText: { flex: 1 },
  eyebrow: { color: '#47725d', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#182a24', fontSize: 27, fontWeight: '800', marginTop: 4 },
  state: { alignItems: 'center', paddingVertical: 48 },
  stateText: { color: '#66736c', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  kindSwitch: { backgroundColor: '#e8ece6', borderRadius: 14, flexDirection: 'row', marginBottom: 16, padding: 4 },
  kindButton: { alignItems: 'center', borderRadius: 11, flex: 1, paddingVertical: 11 },
  kindButtonActive: { backgroundColor: '#ffffff' },
  kindText: { color: '#718078', fontSize: 13, fontWeight: '700' },
  kindTextActive: { color: '#24533d' },
  card: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 16, borderWidth: 1, marginBottom: 22, padding: 14 },
  label: { color: '#6d7a71', fontSize: 12, fontWeight: '700', marginBottom: 9 },
  addRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  addInput: { backgroundColor: '#f7f8f5', borderColor: '#e0e6df', borderRadius: 11, borderWidth: 1, color: '#233a2e', flex: 1, fontSize: 14, minHeight: 45, paddingHorizontal: 12 },
  addButton: { alignItems: 'center', backgroundColor: '#315e45', borderRadius: 11, justifyContent: 'center', minHeight: 45, paddingHorizontal: 14 },
  sectionLabel: { color: '#738078', fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 9 },
  categoryCard: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 9, marginBottom: 8, padding: 9 },
  inactiveCard: { backgroundColor: '#f0f1ed' },
  categoryInput: { color: '#253b30', flex: 1, fontSize: 14, fontWeight: '600', minHeight: 40, paddingHorizontal: 5 },
  statusButton: { alignItems: 'center', borderRadius: 10, minWidth: 74, paddingHorizontal: 9, paddingVertical: 9 },
  activeButton: { backgroundColor: '#e2eee5' },
  inactiveButton: { backgroundColor: '#e7e8e4' },
  statusText: { fontSize: 11, fontWeight: '800' },
  activeText: { color: '#24533d' },
  inactiveText: { color: '#788078' },
  empty: { color: '#78837b', fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  error: { backgroundColor: '#fff0ec', borderRadius: 11, color: '#a33d37', fontSize: 12, lineHeight: 18, marginBottom: 12, padding: 10 },
  primary: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 13, justifyContent: 'center', marginTop: 12, minHeight: 48, paddingHorizontal: 20, paddingVertical: 13 },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
