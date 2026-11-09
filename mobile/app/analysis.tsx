import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState } from '../src/api/client';
import type { FinanceState } from '../src/api/contracts';
import { getCashFlow, getExpenseCategoryBreakdownForRange, getMonthlyTrend, getPreviousRange } from '../src/features/analysis/selectors';
import { getCurrentMonth, formatMonth } from '../src/features/ledger/months';
import { CalendarDatePicker } from '../src/features/analysis/CalendarDatePicker';
import { Button, createThemedStyles, GlassPanel, ScreenHeader } from '../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const shortMonth = new Intl.DateTimeFormat('es-EC', { month: 'short' });
const dateLabel = (date: string) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));
const todayDate = () => `${getCurrentMonth()}-${String(new Date().getDate()).padStart(2, '0')}`;

export default function AnalysisScreen() {
  const { colors, ui, styles } = useStyles();
  const today = todayDate();
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);
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

  const report = useMemo(() => data ? getCashFlow(data, startDate, endDate) : null, [data, startDate, endDate]);
  const previousRange = useMemo(() => getPreviousRange(startDate, endDate), [startDate, endDate]);
  const previous = data && previousRange ? getCashFlow(data, previousRange.startDate, previousRange.endDate) : null;
  const categories = useMemo(() => data ? getExpenseCategoryBreakdownForRange(data, startDate, endDate) : [], [data, startDate, endDate]);
  const previousCategories = data && previousRange ? getExpenseCategoryBreakdownForRange(data, previousRange.startDate, previousRange.endDate) : [];
  const trend = useMemo(() => data ? getMonthlyTrend(data, endDate.slice(0, 7)) : [], [data, endDate]);
  const maxTrend = Math.max(1, ...trend.flatMap((point) => [point.income, point.expenses]));
  const maxCategory = Math.max(1, ...categories.map((item) => item.amount));
  const days = report ? dayDistance(report.startDate, report.endDate) + 1 : 1;
  const averageMonthly = report ? report.expenses / days * 30.4375 : 0;
  const expenseDelta = previous && previous.expenses > 0 ? (report!.expenses - previous.expenses) / previous.expenses * 100 : null;
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthDays = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
  const paceProjection = report && startDate === monthStart && endDate === today ? report.expenses / Number(today.slice(8, 10)) * monthDays : null;

  function chooseRange(preset: 'week' | 'month' | 'quarter') {
    const end = todayDate();
    const start = preset === 'month' ? `${end.slice(0, 7)}-01` : shiftDays(end, preset === 'week' ? -6 : -89);
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Análisis" subtitle="Compara tus finanzas en cualquier período" onBack={() => router.back()} showMenu />
        {error && data ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
        {loading && !data ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.helper}>Cargando movimientos…</Text></View>
        ) : error && !data ? (
          <View style={styles.state}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="Reintentar" onPress={() => setRetry((value) => value + 1)} /></View>
        ) : data ? (
          <>
            <View style={styles.dateRange}>
              <CalendarDatePicker label="Desde" date={startDate} onChange={setStartDate} />
              <CalendarDatePicker label="Hasta" date={endDate} onChange={setEndDate} />
            </View>
            <View style={styles.presets}>{([['week', '7 días'], ['month', 'Este mes'], ['quarter', '90 días']] as const).map(([id, label]) => <Pressable key={id} onPress={() => chooseRange(id)} style={({ pressed }) => [styles.preset, pressed && ui.pressed]}><Text style={styles.presetText}>{label}</Text></Pressable>)}</View>
            {!report ? <Text accessibilityRole="alert" style={ui.error}>Revisa las fechas. La fecha inicial debe ser igual o anterior a la final.</Text> : <>
            <View style={styles.summaryGrid}>
              <Metric label="Ingresos" value={currency.format(report.income)} hint={`${dateLabel(startDate)} – ${dateLabel(endDate)}`} income />
              <Metric label="Gastos" value={currency.format(report.expenses)} hint="Transferencias excluidas" expense />
              <Metric label="Disponible después de gastos" value={currency.format(report.netFlow)} hint="Ingresos menos gastos" />
            </View>
            <View style={styles.insightsGrid}>
              <Insight label="Promedio mensual equivalente" value={currency.format(averageMonthly)} hint="Al ritmo diario del período" />
              <Insight label="Gastos vs. período anterior" value={expenseDelta === null ? 'Sin base previa' : `${expenseDelta > 0 ? '+' : ''}${expenseDelta.toFixed(1)}%`} hint={previousRange ? `${dateLabel(previousRange.startDate)} – ${dateLabel(previousRange.endDate)}` : 'Rango inválido'} negative={expenseDelta !== null && expenseDelta > 0} />
              <Insight label="Ahorro sobre ingresos" value={report.income > 0 ? `${(report.netFlow / report.income * 100).toFixed(1)}%` : '—'} hint="Ingresos menos gastos" />
              {paceProjection !== null ? <Insight label="Proyección al cierre del mes" value={currency.format(paceProjection)} hint="Si mantienes este ritmo" /> : null}
            </View>

            <Text accessibilityRole="header" style={styles.sectionTitle}>Tendencia mensual</Text>
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
            <GlassPanel style={styles.categoryCard}>
              {categories.length ? categories.map((item) => {
                const previousAmount = previousCategories.find((old) => old.categoryId === item.categoryId)?.amount ?? 0;
                const change = previousAmount ? (item.amount - previousAmount) / previousAmount * 100 : null;
                return (
                <View key={item.categoryId} style={styles.categoryRow}>
                  <View style={styles.categoryHeading}>
                    <Text style={styles.categoryName}>{item.name}</Text>
                    <Text style={styles.categoryAmount}>{currency.format(item.amount)}</Text>
                  </View>
                  <View style={styles.categoryTrack}>
                    <View style={[styles.categoryFill, { backgroundColor: colors.expense, width: `${item.amount / maxCategory * 100}%` }]} />
                  </View>
                  <Text style={styles.categoryChange}>{change === null ? 'Nuevo en este período' : `${change > 0 ? '+' : ''}${change.toFixed(0)}% vs. período anterior`}</Text>
                </View>
                );
              }) : <Text style={styles.helper}>No hay gastos registrados en estas fechas.</Text>}
            </GlassPanel>
            </>}
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

function Metric({ label, value, hint, income, expense }: { label: string; value: string; hint: string; income?: boolean; expense?: boolean }) {
  const { colors, styles } = useStyles();
  return <GlassPanel style={[styles.metric, income && styles.metricIncome, expense && styles.metricExpense]}><Text style={styles.metricLabel}>{label}</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.metricValue, income && { color: colors.primary }, expense && { color: colors.expense }]}>{value}</Text><Text style={styles.metricHint}>{hint}</Text></GlassPanel>;
}
function Insight({ label, value, hint, negative }: { label: string; value: string; hint: string; negative?: boolean }) {
  const { colors, styles } = useStyles();
  return <GlassPanel style={styles.insight}><Text style={styles.insightLabel}>{label}</Text><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.insightValue, negative && { color: colors.expense }]}>{value}</Text><Text numberOfLines={1} style={styles.insightHint}>{hint}</Text></GlassPanel>;
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  state: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  dateRange: { flexDirection: 'row', gap: 9 },
  presets: { flexDirection: 'row', gap: 7, justifyContent: 'flex-end', marginTop: 9 },
  preset: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  presetText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 },
  metric: { flexBasis: '47%', flexGrow: 1, minHeight: 112, padding: 14 },
  metricIncome: { borderTopColor: colors.primary, borderTopWidth: 2 },
  metricExpense: { borderTopColor: colors.expense, borderTopWidth: 2 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  metricValue: { color: colors.ink, fontSize: 18, fontVariant: ['tabular-nums'], fontWeight: '800', marginTop: 8 },
  metricHint: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  insightsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  insight: { flexBasis: '47%', flexGrow: 1, gap: 5, padding: 12 },
  insightLabel: { color: colors.muted, fontSize: 10 },
  insightValue: { color: colors.ink, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  insightHint: { color: colors.muted, fontSize: 9 },
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
  categoryCard: { backgroundColor: colors.surface, gap: 16, padding: 16 },
  categoryRow: { gap: 8 },
  categoryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  categoryName: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '600', paddingRight: 8 },
  categoryAmount: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  categoryTrack: { backgroundColor: colors.input, borderRadius: 5, height: 8, overflow: 'hidden' },
  categoryFill: { borderRadius: 5, height: '100%' },
  categoryChange: { color: colors.muted, fontSize: 10, marginTop: 4 },
}));

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function shiftDays(date: string, offset: number) { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + offset); return localDate(value); }
function dayDistance(start: string, end: string) { return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000); }
