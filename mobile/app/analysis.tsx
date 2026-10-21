import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState } from '../src/api/client';
import type { FinanceState } from '../src/api/contracts';
import { getExpenseCategoryBreakdown, getMonthlyTrend } from '../src/features/analysis/selectors';
import { getCurrentMonth, formatMonth } from '../src/features/ledger/months';
import { MonthNavigator } from '../src/features/ledger/MonthNavigator';
import { Button, createThemedStyles, GlassPanel, ScreenHeader } from '../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const shortMonth = new Intl.DateTimeFormat('es-EC', { month: 'short' });

export default function AnalysisScreen() {
  const { colors, ui, styles } = useStyles();
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<FinanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadFinanceState()
      .then((nextData) => { if (active) setData(nextData); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los análisis.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]));

  const trend = useMemo(() => data ? getMonthlyTrend(data, getCurrentMonth()) : [], [data]);
  const categories = useMemo(() => data ? getExpenseCategoryBreakdown(data, month) : [], [data, month]);
  const maxTrend = Math.max(1, ...trend.flatMap((point) => [point.income, point.expenses]));
  const maxCategory = Math.max(1, ...categories.map((item) => item.amount));

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Análisis" subtitle="Ingresos y gastos, mes a mes" onBack={() => router.back()} showMenu />
        {error && data ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
        {loading && !data ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.helper}>Cargando movimientos…</Text></View>
        ) : error && !data ? (
          <View style={styles.state}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="Reintentar" onPress={() => setRetry((value) => value + 1)} /></View>
        ) : data ? (
          <>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Últimos 6 meses</Text>
            <GlassPanel style={styles.chartCard}>
              <View style={styles.legend}>
                <Legend color={colors.primary} label="Ingresos" />
                <Legend color={colors.expense} label="Gastos" />
              </View>
              <View accessibilityRole="image" accessibilityLabel={trend.map((point) => `${formatMonth(point.month)}: ingresos ${currency.format(point.income)}, gastos ${currency.format(point.expenses)}`).join('. ')} style={styles.chart}>
                {trend.map((point) => {
                  const incomeHeight = point.income / maxTrend * 100;
                  const expenseHeight = point.expenses / maxTrend * 100;
                  return (
                    <View key={point.month} style={styles.monthColumn}>
                      <View style={styles.barPair}>
                        <View style={[styles.bar, { backgroundColor: colors.primary, height: point.income ? `${Math.max(2, incomeHeight)}%` : 0 }]} />
                        <View style={[styles.bar, { backgroundColor: colors.expense, height: point.expenses ? `${Math.max(2, expenseHeight)}%` : 0 }]} />
                      </View>
                      <Text style={styles.monthLabel}>{shortMonth.format(new Date(`${point.month}-01T12:00:00`)).replace('.', '')}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.chartTotals}>
                <Text style={styles.helper}>Los datos comparan ingresos y gastos. Las transferencias no cuentan.</Text>
              </View>
            </GlassPanel>

            <Text accessibilityRole="header" style={styles.sectionTitle}>Gastos por rubro</Text>
            <MonthNavigator month={month} onChange={setMonth} />
            <Text style={styles.selectedMonth}>{formatMonth(month)}</Text>
            <GlassPanel style={styles.categoryCard}>
              {categories.length ? categories.map((item) => (
                <View key={item.categoryId} style={styles.categoryRow}>
                  <View style={styles.categoryHeading}>
                    <Text style={styles.categoryName}>{item.name}</Text>
                    <Text style={styles.categoryAmount}>{currency.format(item.amount)}</Text>
                  </View>
                  <View style={styles.categoryTrack}>
                    <View style={[styles.categoryFill, { backgroundColor: colors.expense, width: `${item.amount / maxCategory * 100}%` }]} />
                  </View>
                </View>
              )) : <Text style={styles.helper}>No hay gastos registrados en {formatMonth(month)}.</Text>}
            </GlassPanel>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { styles } = useStyles();
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendLabel}>{label}</Text></View>;
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  state: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  chartCard: { backgroundColor: colors.surface, padding: 16 },
  legend: { flexDirection: 'row', gap: 18 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  legendDot: { borderRadius: 4, height: 9, width: 9 },
  legendLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 185, justifyContent: 'space-between', marginTop: 20 },
  monthColumn: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  barPair: { alignItems: 'flex-end', flexDirection: 'row', gap: 4, height: 148, justifyContent: 'center', width: '100%' },
  bar: { borderTopLeftRadius: 5, borderTopRightRadius: 5, maxWidth: 18, minWidth: 9 },
  monthLabel: { color: colors.muted, fontSize: 10, marginTop: 8, textTransform: 'capitalize' },
  chartTotals: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 10, paddingTop: 12 },
  selectedMonth: { color: colors.muted, fontSize: 13, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  categoryCard: { backgroundColor: colors.surface, gap: 16, padding: 16 },
  categoryRow: { gap: 8 },
  categoryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  categoryName: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '600', paddingRight: 8 },
  categoryAmount: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  categoryTrack: { backgroundColor: colors.input, borderRadius: 5, height: 8, overflow: 'hidden' },
  categoryFill: { borderRadius: 5, height: '100%' },
}));
