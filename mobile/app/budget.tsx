import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { deleteMonthlyBudget, loadFinanceState, loadMonthlyBudget, saveMonthlyBudget } from '../src/api/client';
import type { FinanceState, MonthlyBudget } from '../src/api/contracts';
import { parseBudgetAmount } from '../src/features/budget/validation';
import { getBudgetProgress } from '../src/features/analysis/selectors';
import { getCurrentMonth } from '../src/features/ledger/months';
import { getMonthlySummary } from '../src/features/ledger/selectors';
import { MonthNavigator } from '../src/features/ledger/MonthNavigator';
import { Button, createThemedStyles, GlassPanel, Input, ScreenHeader } from '../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

export default function BudgetScreen() {
  const { colors, ui, styles } = useStyles();
  const [month, setMonth] = useState(getCurrentMonth());
  const [financeState, setFinanceState] = useState<FinanceState | null>(null);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    setFinanceState(null);
    setBudget(null);
    setAmount('');
    void Promise.all([loadFinanceState(), loadMonthlyBudget(month)])
      .then(([nextState, nextBudget]) => {
        if (!active) return;
        setFinanceState(nextState);
        setBudget(nextBudget);
        setAmount(nextBudget ? String(nextBudget.amount) : '');
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el presupuesto.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, retry]));

  const summary = useMemo(() => financeState ? getMonthlySummary(financeState, month, 'all') : null, [financeState, month]);
  const progress = budget && summary ? getBudgetProgress(budget.amount, summary.expenses) : null;

  async function save() {
    const parsedAmount = parseBudgetAmount(amount);
    if (parsedAmount === null) {
      setError('Ingresa un monto mayor que cero, con hasta dos decimales.');
      setMessage('');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveMonthlyBudget(month, parsedAmount);
      setBudget(saved);
      setAmount(String(saved.amount));
      setMessage('Presupuesto guardado.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!budget) return;
    Alert.alert('Eliminar presupuesto', 'Se borrará el límite de este mes.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { void removeBudget(); } },
    ]);
  }

  async function removeBudget() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteMonthlyBudget(month);
      setBudget(null);
      setAmount('');
      setMessage('Presupuesto eliminado.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el presupuesto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Presupuesto" subtitle="Define un límite para cada mes" onBack={() => router.back()} showMenu />
        <MonthNavigator disabled={loading || saving} month={month} onChange={(nextMonth) => { setMonth(nextMonth); setMessage(''); }} />
        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.helper}>Cargando tus movimientos y presupuesto…</Text>
          </View>
        ) : error && !financeState ? (
          <View style={styles.state}>
            <Text accessibilityRole="alert" style={ui.error}>{error}</Text>
            <Button label="Reintentar" onPress={() => setRetry((value) => value + 1)} />
          </View>
        ) : (
          <>
            <GlassPanel style={styles.summaryCard}>
              <Text style={styles.cardEyebrow}>{budget ? 'LÍMITE DEL MES' : 'SIN PRESUPUESTO'}</Text>
              {budget ? (
                <>
                  <Text style={styles.budgetAmount}>{currency.format(budget.amount)}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { backgroundColor: progress && progress.remaining < 0 ? colors.expense : colors.primary, width: `${progress?.barPercent ?? 0}%` }]} />
                  </View>
                  <View style={styles.metrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Gastado</Text>
                      <Text style={styles.metricValue}>{currency.format(summary?.expenses ?? 0)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>{progress && progress.remaining < 0 ? 'Excedido' : 'Disponible'}</Text>
                      <Text style={[styles.metricValue, progress && progress.remaining < 0 && styles.negative]}>{currency.format(Math.abs(progress?.remaining ?? 0))}</Text>
                    </View>
                  </View>
                  <Text style={styles.progressHint}>{progress?.percent ?? 0}% del presupuesto utilizado</Text>
                </>
              ) : (
                <Text style={styles.helper}>Tus gastos del mes: {currency.format(summary?.expenses ?? 0)}. Crea un límite para compararlos.</Text>
              )}
            </GlassPanel>

            <Text accessibilityRole="header" style={styles.sectionTitle}>{budget ? 'Ajustar presupuesto' : 'Planear este mes'}</Text>
            <Text style={ui.label}>Presupuesto total · USD</Text>
            <Input
              accessibilityLabel="Presupuesto total del mes en dólares"
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="Ej. 450,00"
              value={amount}
            />
            {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
            {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
            <Button busy={saving} label={budget ? 'Guardar cambios' : 'Guardar presupuesto'} onPress={() => void save()} style={styles.saveButton} />
            {budget ? <Button disabled={saving} label="Eliminar presupuesto" onPress={confirmDelete} variant="danger" /> : null}
            <Text style={styles.note}>Cada mes conserva su propio límite. Los gastos incluyen todas las cuentas; las transferencias quedan fuera.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  state: { alignItems: 'center', gap: 18, paddingVertical: 38 },
  helper: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  summaryCard: { backgroundColor: colors.hero, borderColor: colors.heroBorder, marginTop: 18, padding: 20 },
  cardEyebrow: { color: colors.heroMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  budgetAmount: { color: colors.accent, fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 8 },
  progressTrack: { backgroundColor: colors.input, borderRadius: 8, height: 12, marginTop: 20, overflow: 'hidden' },
  progressFill: { borderRadius: 8, height: '100%' },
  metrics: { borderTopColor: colors.heroBorder, borderTopWidth: 1, flexDirection: 'row', gap: 12, marginTop: 18, paddingTop: 14 },
  metric: { flex: 1 },
  metricLabel: { color: colors.heroMuted, fontSize: 12 },
  metricValue: { color: colors.heroText, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 5 },
  negative: { color: colors.heroNegative },
  progressHint: { color: colors.heroMuted, fontSize: 12, marginTop: 10 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 25 },
  success: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: 14 },
  saveButton: { marginTop: 18 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
}));
