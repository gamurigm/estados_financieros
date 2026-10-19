import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest } from '../../src/api/client';
import type { AccountId, FinanceState } from '../../src/api/contracts';
import { sessionManager } from '../../src/auth/session';
import { MovementList } from '../../src/features/ledger/MovementList';
import { getMonthlySummary } from '../../src/features/ledger/selectors';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const accountOptions: Array<{ id: 'all' | AccountId; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'cash', label: 'Efectivo' },
  { id: 'bank', label: 'Débito' },
];

export default function MonthlyLedgerScreen() {
  const [data, setData] = useState<FinanceState | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<'all' | AccountId>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (pullToRefresh = false) => {
    if (pullToRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setData(await apiRequest<FinanceState>('/api/state'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el libro.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    return undefined;
  }, [load]));

  const summary = useMemo(() => data ? getMonthlySummary(data, month, filter) : null, [data, month, filter]);

  async function logout() {
    try {
      await sessionManager.logout();
    } catch {
      Alert.alert('Sesión cerrada en este teléfono', 'No se pudo confirmar el cierre de sesión con el servidor.');
    } finally {
      router.replace('/login');
    }
  }

  const header = (
    <View>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>ESTADOS FINANCIEROS</Text>
          <Text style={styles.heading}>Tu mes, claro.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void logout()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.monthControl}>
        <Pressable accessibilityLabel="Mes anterior" onPress={() => setMonth((value) => moveMonth(value, -1))} style={styles.monthArrow}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.monthText}>{monthLabel(month)}</Text>
        <Pressable accessibilityLabel="Mes siguiente" onPress={() => setMonth((value) => moveMonth(value, 1))} style={styles.monthArrow}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {summary ? (
        <>
          <View style={styles.metricsRow}>
            <MetricCard label="Ingresos" amount={summary.income} tone="income" />
            <MetricCard label="Gastos" amount={summary.expenses} tone="expense" />
          </View>
          <View style={styles.netCard}>
            <View><Text style={styles.netLabel}>Balance del mes</Text><Text style={styles.netHint}>Ingresos menos gastos</Text></View>
            <Text style={[styles.netAmount, summary.net < 0 && styles.negative]}>{currency.format(summary.net)}</Text>
          </View>
          <Text style={styles.sectionLabel}>SALDOS AL CIERRE DEL MES</Text>
          <View style={styles.balancesRow}>
            <BalanceCard label="Efectivo" amount={summary.balances.cash} />
            <BalanceCard label="Débito" amount={summary.balances.bank} />
          </View>
          <View style={styles.actionsRow}>
            <ActionButton label="Ingreso" onPress={() => router.push({ pathname: '/movements/new', params: { kind: 'income' } })} />
            <ActionButton label="Gasto" onPress={() => router.push({ pathname: '/movements/new', params: { kind: 'expense' } })} />
            <ActionButton label="Transferir" onPress={() => router.push('/transfers/new')} />
          </View>
        </>
      ) : null}

      <View style={styles.filterHeader}>
        <Text style={styles.sectionLabel}>MOVIMIENTOS</Text>
        {refreshing ? <ActivityIndicator color="#47725d" size="small" /> : null}
      </View>
      <View style={styles.filters}>
        {accountOptions.map((option) => {
          const active = filter === option.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => setFilter(option.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );

  if (loading && !data) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.stateContainer}><ActivityIndicator color="#173c32" size="large" /><Text style={styles.stateText}>Cargando tu libro…</Text></View></SafeAreaView>;
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No se pudo cargar el libro</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>Reintentar</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <MovementList
        categories={data.categories}
        header={header}
        movements={summary?.movements ?? []}
        onEditMovement={(movement) => router.push({ pathname: '/movements/[id]', params: { id: movement.id } })}
        onRefresh={() => { void load(true); }}
        refreshing={refreshing}
      />
    </SafeAreaView>
  );
}

function MetricCard({ label, amount, tone }: { label: string; amount: number; tone: 'income' | 'expense' }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeading}>
        <View style={[styles.metricDot, tone === 'income' ? styles.incomeDot : styles.expenseDot]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricAmount}>{currency.format(amount)}</Text>
    </View>
  );
}

function BalanceCard({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={styles.balanceAmount}>{currency.format(amount)}</Text>
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
      <Text style={styles.actionPlus}>+</Text>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function moveMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const label = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f6f2' },
  stateContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  stateTitle: { color: '#182a24', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  stateText: { color: '#66736c', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  retryButton: { backgroundColor: '#173c32', borderRadius: 13, marginTop: 21, paddingHorizontal: 22, paddingVertical: 13 },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 19, paddingHorizontal: 3 },
  eyebrow: { color: '#47725d', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: '#182a24', fontSize: 27, fontWeight: '800', letterSpacing: -0.5, marginTop: 6 },
  logoutButton: { borderColor: '#dce4dc', borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 9 },
  logoutText: { color: '#466354', fontSize: 13, fontWeight: '700' },
  monthControl: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 10, paddingVertical: 5 },
  monthArrow: { alignItems: 'center', borderRadius: 11, height: 38, justifyContent: 'center', width: 42 },
  arrowText: { color: '#315a45', fontSize: 29, lineHeight: 32 },
  monthText: { color: '#233a2e', fontSize: 15, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricCard: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 16, borderWidth: 1, flex: 1, minHeight: 85, paddingHorizontal: 13, paddingVertical: 12 },
  metricHeading: { alignItems: 'center', flexDirection: 'row' },
  metricDot: { borderRadius: 5, height: 9, marginRight: 7, width: 9 },
  incomeDot: { backgroundColor: '#3c8a60' },
  expenseDot: { backgroundColor: '#c97563' },
  metricLabel: { color: '#6d7a71', fontSize: 11, fontWeight: '600' },
  metricAmount: { color: '#253b30', fontSize: 15, fontWeight: '800', marginTop: 10 },
  netCard: { alignItems: 'center', backgroundColor: '#173c32', borderRadius: 17, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 16, paddingVertical: 15 },
  netLabel: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  netHint: { color: '#c5d8cc', fontSize: 10, marginTop: 4 },
  netAmount: { color: '#e0f2c6', fontSize: 17, fontWeight: '800' },
  negative: { color: '#ffc2b8' },
  sectionLabel: { color: '#738078', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  balancesRow: { flexDirection: 'row', gap: 10, marginTop: 9 },
  balanceCard: { backgroundColor: '#ffffff', borderColor: '#e4e9e2', borderRadius: 15, borderWidth: 1, flex: 1, paddingHorizontal: 13, paddingVertical: 12 },
  balanceLabel: { color: '#738078', fontSize: 11, fontWeight: '600' },
  balanceAmount: { color: '#253b30', fontSize: 14, fontWeight: '800', marginTop: 7 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  actionButton: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#dce4dc', borderRadius: 13, borderWidth: 1, flex: 1, flexDirection: 'row', justifyContent: 'center', minHeight: 43, paddingHorizontal: 4 },
  actionPlus: { color: '#315e45', fontSize: 18, fontWeight: '600', marginRight: 4 },
  actionText: { color: '#315e45', fontSize: 10, fontWeight: '800' },
  filterHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterPill: { backgroundColor: '#ffffff', borderColor: '#dce4dc', borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  filterPillActive: { backgroundColor: '#e2eee5', borderColor: '#b5d0bd' },
  filterText: { color: '#6b786f', fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#24533d', fontWeight: '800' },
  error: { backgroundColor: '#fff0ec', borderRadius: 11, color: '#a33d37', fontSize: 12, lineHeight: 18, marginTop: 11, padding: 10 },
});
