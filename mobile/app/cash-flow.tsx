import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState } from '../src/api/client';
import type { FinanceState } from '../src/api/contracts';
import { getCashFlow } from '../src/features/analysis/selectors';
import { getCurrentMonth } from '../src/features/ledger/months';
import { Button, createThemedStyles, GlassPanel, Input, ScreenHeader } from '../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const formatDate = (date: string) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`));
const todayDate = () => `${getCurrentMonth()}-${String(new Date().getDate()).padStart(2, '0')}`;

export default function CashFlowScreen() {
  const { colors, ui, styles } = useStyles();
  const today = todayDate();
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState<FinanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const report = useMemo(() => data ? getCashFlow(data, startDate, endDate) : null, [data, startDate, endDate]);
  const categories = useMemo(() => new Map((data?.categories ?? []).map((category) => [category.id, category.name])), [data]);
  const accounts = useMemo(() => new Map((data?.accounts ?? []).map((account) => [account.id, account.name])), [data]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadFinanceState()
      .then((nextData) => { if (active) setData(nextData); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el flujo de caja.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]));

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Flujo de caja" subtitle="Ingresos y gastos en cualquier período" onBack={() => router.back()} showMenu />
        {error && data ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
        {loading && !data ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.helper}>Cargando movimientos…</Text></View>
        ) : error && !data ? (
          <View style={styles.state}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="Reintentar" onPress={() => setRetry((value) => value + 1)} /></View>
        ) : data ? (
          <>
            <View style={styles.rangeRow}>
              <View style={styles.dateField}><Text style={ui.label}>Desde · AAAA-MM-DD</Text><Input accessibilityLabel="Fecha inicial, formato año mes día" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setStartDate} placeholder="AAAA-MM-DD" value={startDate} /></View>
              <View style={styles.dateField}><Text style={ui.label}>Hasta · AAAA-MM-DD</Text><Input accessibilityLabel="Fecha final, formato año mes día" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setEndDate} placeholder="AAAA-MM-DD" value={endDate} /></View>
            </View>
            {!report ? <Text accessibilityRole="alert" style={ui.error}>Revisa las fechas. Usa AAAA-MM-DD y el inicio debe ser igual o anterior al final.</Text> : <>
              <GlassPanel style={[styles.flowHero, report.netFlow < 0 && styles.flowHeroNegative]}>
                <View style={styles.flowHeroCopy}>
                  <Text style={styles.flowHeroKicker}>Flujo neto del período</Text>
                  <Text accessibilityRole="header" adjustsFontSizeToFit numberOfLines={1} style={[styles.flowHeroAmount, report.netFlow < 0 && styles.negative]}>{currency.format(report.netFlow)}</Text>
                  <Text style={styles.flowHeroHint}>Ingresos menos gastos registrados</Text>
                </View>
                <Text style={[styles.flowHeroSymbol, report.netFlow < 0 && styles.negative]}>{report.netFlow < 0 ? '↘' : '↗'}</Text>
              </GlassPanel>

              <View style={styles.summaryGrid}>
                <Metric label="Saldo inicial" value={currency.format(report.openingBalance)} hint={`Antes del ${formatDate(report.startDate)}`} />
                <Metric label="Ingresos" value={currency.format(report.income)} hint="Entradas registradas" income />
                <Metric label="Gastos" value={currency.format(report.expenses)} hint="Salidas registradas" expense />
                <Metric label="Saldo al cierre" value={currency.format(report.closingBalance)} hint={`Al ${formatDate(report.endDate)}`} hero />
              </View>

              <Text accessibilityRole="header" style={styles.sectionTitle}>Movimientos del período</Text>
              <GlassPanel style={styles.movementPanel}>
                {report.movements.length ? report.movements.map((movement, index) => {
                  const income = movement.kind === 'income';
                  const category = movement.categoryId ? categories.get(movement.categoryId) : undefined;
                  const accountId = income ? movement.toAccount : movement.account;
                  return (
                    <View key={movement.id} style={[styles.movementRow, index > 0 && styles.movementDivider]}>
                      <View style={[styles.movementMark, { backgroundColor: income ? colors.tint : colors.expenseTint }]}><Text style={{ color: income ? colors.primary : colors.expense }}>{income ? '↙' : '↗'}</Text></View>
                      <View style={styles.movementCopy}>
                        <Text numberOfLines={1} style={styles.movementName}>{category ?? (income ? 'Ingreso' : 'Gasto')}</Text>
                        <Text numberOfLines={2} style={styles.helper}>{movement.note || accounts.get(accountId ?? '') || 'Sin descripción'} · {formatDate(movement.date)}</Text>
                      </View>
                      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.movementAmount, { color: income ? colors.primary : colors.expense }]}>{income ? '+' : '−'}{currency.format(movement.amount)}</Text>
                    </View>
                  );
                }) : <Text style={styles.helper}>No hay ingresos ni gastos en este período. Las transferencias quedan fuera.</Text>}
              </GlassPanel>

              <GlassPanel style={styles.notePanel}>
                <Text style={styles.noteSymbol}>⇄</Text>
                <View style={styles.noteCopy}>
                  <Text style={styles.noteTitle}>Transferencias excluidas</Text>
                  <Text style={styles.helper}>Los traslados entre cuentas no cuentan como ingreso ni gasto. El saldo final puede incluir saldos iniciales de cuentas creadas dentro del período. Las fechas futuras no son proyecciones.</Text>
                </View>
              </GlassPanel>
            </>}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value, hint, income, expense, hero }: { label: string; value: string; hint: string; income?: boolean; expense?: boolean; hero?: boolean }) {
  const { colors, styles } = useStyles();
  return (
    <GlassPanel style={[styles.metric, hero && styles.metricHero, income && styles.metricIncome, expense && styles.metricExpense]}>
      <Text style={[styles.metricLabel, hero && styles.metricHeroLabel]}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.metricValue, income && { color: colors.primary }, expense && { color: colors.expense }, hero && styles.metricHeroValue]}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </GlassPanel>
  );
}


const useStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  state: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  rangeRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1, minWidth: 0 },
  flowHero: { alignItems: 'center', backgroundColor: colors.hero, borderColor: colors.heroBorder, flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, minHeight: 160, padding: 20 },
  flowHeroNegative: { borderColor: colors.expense },
  flowHeroCopy: { flex: 1, minWidth: 0 },
  flowHeroKicker: { color: colors.heroMuted, fontSize: 13, fontWeight: '700' },
  flowHeroAmount: { color: colors.primary, fontSize: 34, fontVariant: ['tabular-nums'], fontWeight: '900', letterSpacing: -1, marginTop: 11 },
  negative: { color: colors.heroNegative },
  flowHeroHint: { color: colors.heroMuted, fontSize: 11, marginTop: 7 },
  flowHeroSymbol: { color: colors.primary, fontSize: 45, fontWeight: '800', marginLeft: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metric: { flexBasis: '47%', flexGrow: 1, minHeight: 118, padding: 14 },
  metricHero: { backgroundColor: colors.hero, borderColor: colors.heroBorder },
  metricIncome: { borderTopColor: colors.primary, borderTopWidth: 2 },
  metricExpense: { borderTopColor: colors.expense, borderTopWidth: 2 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  metricHeroLabel: { color: colors.heroMuted },
  metricValue: { color: colors.ink, fontSize: 17, fontVariant: ['tabular-nums'], fontWeight: '800', marginTop: 8 },
  metricHeroValue: { color: colors.heroText },
  metricHint: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 12, marginTop: 25 },
  movementPanel: { backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 4 },
  movementRow: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingVertical: 13 },
  movementDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  movementMark: { alignItems: 'center', borderRadius: 13, height: 36, justifyContent: 'center', width: 36 },
  movementCopy: { flex: 1, minWidth: 0 },
  movementName: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  movementAmount: { fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '800', maxWidth: '33%' },
  notePanel: { alignItems: 'flex-start', backgroundColor: colors.tint, flexDirection: 'row', gap: 11, marginTop: 16, padding: 15 },
  noteSymbol: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  noteCopy: { flex: 1, gap: 5 },
  noteTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
}));
