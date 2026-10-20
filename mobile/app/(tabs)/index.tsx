import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { apiRequest } from '../../src/api/client';
import type { AccountId, FinanceState } from '../../src/api/contracts';
import { sessionManager } from '../../src/auth/session';
import { MovementList } from '../../src/features/ledger/MovementList';
import { getMonthlySummary } from '../../src/features/ledger/selectors';
import { Button, createThemedStyles, GlassPanel, ThemeToggle } from '../../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
export default function MonthlyLedgerScreen() {
  const { colors, ui, styles } = useStyles();
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
        <View style={styles.topCopy}>
          <Text style={styles.welcome}>Tus finanzas, a la vista</Text>
          <Text accessibilityRole="header" style={styles.heading}>Mi libro</Text>
        </View>
        <View style={styles.headerActions}>
          <ThemeToggle />
          <Button label="Salir" onPress={() => void logout()} variant="secondary" style={styles.logout} />
        </View>
      </View>

      <View style={styles.monthControl}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => setMonth((value) => moveMonth(value, -1))} style={({ pressed }) => [styles.monthArrow, pressed && ui.pressed]}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.monthText}>{monthLabel(month)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => setMonth((value) => moveMonth(value, 1))} style={({ pressed }) => [styles.monthArrow, pressed && ui.pressed]}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
      <View style={[ui.segmented, styles.filters]}>
        {[{ id: 'all', label: 'Todas' }, ...(data?.accounts ?? []).map((account) => ({ id: account.id, label: account.name }))].map((option) => {
          const active = filter === option.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={option.id === 'all' ? 'Todas las cuentas' : option.label}
              accessibilityHint="Filtra el resumen y los movimientos de esta cuenta"
              accessibilityState={{ selected: active }}
              key={option.id}
              onPress={() => setFilter(option.id)}
              style={({ pressed }) => [ui.segment, active && ui.segmentActive, pressed && ui.pressed]}
            >
              <Text style={[ui.segmentText, active && ui.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {summary ? (
        <>
          <GlassPanel style={styles.netCard}>
            <View style={styles.heroHeading}>
              <Text style={styles.netLabel}>Balance del mes</Text>
              <Text style={styles.currencyTag}>USD</Text>
            </View>
            <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={[styles.netAmount, summary.net < 0 && styles.negative]}>{currency.format(summary.net)}</Text>
            <Text style={styles.netHint}>Ingresos menos gastos{filter !== 'all' ? ` en ${data?.accounts.find((account) => account.id === filter)?.name ?? 'esta cuenta'}` : ''}</Text>
            <View style={styles.metricsRow}>
              <Metric label="Ingresos" amount={summary.income} symbol="↙" />
              <View style={styles.metricDivider} />
              <Metric label="Gastos" amount={summary.expenses} symbol="↗" />
            </View>
          </GlassPanel>

          <View style={styles.actionsRow}>
            <ActionButton label="Ingreso" symbol="↙" onPress={() => router.push({ pathname: '/movements/new', params: { kind: 'income' } })} />
            <ActionButton label="Gasto" symbol="↗" primary onPress={() => router.push({ pathname: '/movements/new', params: { kind: 'expense' } })} />
            <ActionButton label="Retirar" symbol="↓" onPress={() => router.push({ pathname: '/transfers/new', params: { mode: 'withdrawal' } })} />
            <ActionButton label="Transferir" symbol="⇄" onPress={() => router.push('/transfers/new')} />
          </View>

          <GlassPanel style={styles.accounts}>
            {(data?.accounts ?? []).filter((account) => account.kind === 'cash').map((account) => <Balance key={account.id} label={`${account.name} al cierre`} amount={summary.balances[account.id] ?? 0} />)}
            <View style={styles.accountDivider} />
            {(data?.accounts ?? []).filter((account) => account.kind === 'bank').map((account) => <Balance key={account.id} label={`${account.name} al cierre`} amount={summary.balances[account.id] ?? 0} />)}
            <View style={styles.accountDivider} />
            <Balance label="Total Débito" amount={summary.debitTotal} />
          </GlassPanel>
          <View style={styles.settingsRow}>
            <Button label="Rubros" onPress={() => router.push('/categories')} style={styles.settingsButton} variant="secondary" />
            <Button label="Saldos iniciales" onPress={() => router.push('/balances')} style={styles.settingsButton} variant="secondary" />
            <Button label="Cambiar contraseña" onPress={() => router.push('/password')} style={styles.settingsButton} variant="secondary" />
          </View>
        </>
      ) : null}

      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Movimientos</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{summary?.movements.length ?? 0}</Text></View>
        {refreshing ? <ActivityIndicator color={colors.primary} size="small" /> : null}
      </View>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.error}>{error}</Text> : null}
    </View>
  );

  if (loading && !data) {
    return <SafeAreaView style={ui.screen}><View style={styles.stateContainer}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.stateText}>Cargando tu libro…</Text></View></SafeAreaView>;
  }

  if (!data) {
    return (
      <SafeAreaView style={ui.screen}>
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>No se pudo cargar el libro</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Button label="Reintentar" onPress={() => void load()} style={styles.retry} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ui.screen}>
      <MovementList
        accounts={data.accounts}
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

function Metric({ label, amount, symbol }: { label: string; amount: number; symbol: string }) {
  const { styles } = useStyles();
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{symbol} {label}</Text>
      <Text style={styles.metricAmount}>{currency.format(amount)}</Text>
    </View>
  );
}

function Balance({ label, amount }: { label: string; amount: number }) {
  const { styles } = useStyles();
  return <View style={styles.balance}><Text style={styles.balanceLabel}>{label}</Text><Text style={styles.balanceAmount}>{currency.format(amount)}</Text></View>;
}

function ActionButton({ label, symbol, primary, onPress }: { label: string; symbol: string; primary?: boolean; onPress: () => void }) {
  const { ui, styles } = useStyles();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label === 'Transferir' ? 'Transferir entre cuentas' : `Registrar ${label.toLowerCase()}`} android_ripple={{ color: '#147D7320' }} onPress={onPress} style={({ pressed }) => [styles.actionButton, primary && styles.actionPrimary, pressed && ui.pressed]}>
      <Text style={[styles.actionSymbol, primary && styles.actionLight]}>{symbol}</Text>
      <Text style={[styles.actionText, primary && styles.actionLight]}>{label}</Text>
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

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  stateContainer: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 30 },
  stateTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  stateText: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 14, textAlign: 'center' },
  retry: { marginTop: 24 },
  topRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 },
  topCopy: { flexGrow: 1 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  welcome: { color: colors.muted, fontSize: 13 },
  heading: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -1, marginTop: 3 },
  logout: { minHeight: 48, paddingVertical: 10 },
  monthControl: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthArrow: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  arrowText: { color: colors.ink, fontSize: 32, lineHeight: 36, marginTop: -3 },
  monthText: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '700', paddingHorizontal: 8, textAlign: 'center' },
  filters: { marginTop: 8, marginBottom: 12, flexWrap: 'wrap' },
  netCard: { backgroundColor: colors.hero, borderColor: colors.heroBorder, borderRadius: 24, padding: 18 },
  heroHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  netLabel: { color: colors.heroText, fontSize: 14, fontWeight: '600' },
  currencyTag: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  netAmount: { color: colors.accent, fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1.2, marginTop: 6 },
  negative: { color: colors.heroNegative },
  netHint: { color: colors.heroMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  metricsRow: { alignItems: 'stretch', borderTopColor: colors.heroBorder, borderTopWidth: 1, flexDirection: 'row', gap: 16, marginTop: 14, paddingTop: 12 },
  metric: { flex: 1, minWidth: 0 },
  metricDivider: { backgroundColor: colors.heroBorder, width: 1 },
  metricLabel: { color: colors.heroMuted, fontSize: 12 },
  metricAmount: { color: colors.heroText, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 5 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  actionButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexGrow: 1, gap: 4, justifyContent: 'center', minHeight: 72, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 10, width: '47%', boxShadow: `0px 3px 12px ${colors.glow}` },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionSymbol: { color: colors.primary, fontSize: 21, fontWeight: '600', lineHeight: 26 },
  actionText: { color: colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  actionLight: { color: colors.onPrimary },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 9, marginBottom: 12, marginTop: 24 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  accounts: { backgroundColor: colors.surface, borderRadius: 18, marginTop: 16, padding: 16 },
  balance: { justifyContent: 'space-between', minWidth: 0, paddingVertical: 9 },
  accountDivider: { backgroundColor: colors.border, height: 1, marginVertical: 5 },
  balanceLabel: { color: colors.muted, fontSize: 13 },
  balanceAmount: { color: colors.ink, fontSize: 19, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 7 },
  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  settingsButton: { flexGrow: 1, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, width: '47%' },
  countBadge: { backgroundColor: colors.input, borderRadius: 9, minWidth: 26, paddingHorizontal: 8, paddingVertical: 4 },
  countText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
}));
