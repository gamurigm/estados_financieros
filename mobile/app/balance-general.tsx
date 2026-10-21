import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { loadFinanceState } from '../src/api/client';
import type { FinanceState } from '../src/api/contracts';
import { getBalanceSheet } from '../src/features/analysis/selectors';
import { getCurrentMonth } from '../src/features/ledger/months';
import { Button, createThemedStyles, GlassPanel, Input, ScreenHeader } from '../src/ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const formatDate = (date: string) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`));
const todayDate = () => `${getCurrentMonth()}-${String(new Date().getDate()).padStart(2, '0')}`;

export default function BalanceSheetScreen() {
  const { colors, ui, styles } = useStyles();
  const [asOfDate, setAsOfDate] = useState(todayDate);
  const [data, setData] = useState<FinanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const report = useMemo(() => data ? getBalanceSheet(data, asOfDate) : null, [data, asOfDate]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadFinanceState()
      .then((nextData) => { if (active) setData(nextData); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el balance.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]));

  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Balance general" subtitle="Saldos registrados por fecha" onBack={() => router.back()} showMenu />
        {error && data ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
        {loading && !data ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.helper}>Cargando cuentas…</Text></View>
        ) : error && !data ? (
          <View style={styles.state}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><Button label="Reintentar" onPress={() => setRetry((value) => value + 1)} /></View>
        ) : data ? (
          <>
            <Text style={ui.label}>Fecha de corte · AAAA-MM-DD</Text>
            <Input accessibilityLabel="Fecha de corte del balance general, formato año mes día" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={setAsOfDate} placeholder="AAAA-MM-DD" value={asOfDate} />
            {!report ? <Text accessibilityRole="alert" style={ui.error}>Ingresa una fecha válida con formato AAAA-MM-DD.</Text> : <>
              <GlassPanel style={styles.hero}>
                <Text style={styles.heroKicker}>Activos líquidos registrados</Text>
                <Text accessibilityRole="header" adjustsFontSizeToFit numberOfLines={1} style={styles.heroAmount}>{currency.format(report.total)}</Text>
                <Text style={styles.heroDate}>Al {formatDate(report.asOfDate)}</Text>
              </GlassPanel>

              <Text accessibilityRole="header" style={styles.sectionTitle}>Efectivo y bancos</Text>
              <GlassPanel style={styles.accountPanel}>
                {report.accounts.length ? report.accounts.map((account) => (
                  <View key={account.id} style={styles.accountRow}>
                    <View style={[styles.accountMark, { backgroundColor: account.kind === 'cash' ? colors.tint : colors.expenseTint }]}>
                      <Text style={[styles.accountMarkText, { color: account.kind === 'cash' ? colors.primary : colors.expense }]}>{account.kind === 'cash' ? 'E' : 'B'}</Text>
                    </View>
                    <View style={styles.accountCopy}>
                      <Text numberOfLines={1} style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountKind}>{account.kind === 'cash' ? 'Efectivo' : 'Cuenta bancaria'}</Text>
                    </View>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.accountAmount, account.amount < 0 && styles.negative]}>{currency.format(account.amount)}</Text>
                  </View>
                )) : <Text style={styles.helper}>No hay cuentas registradas en esta fecha.</Text>}
              </GlassPanel>

              <GlassPanel style={styles.disclosure}>
                <Text style={styles.disclosureMark}>i</Text>
                <View style={styles.disclosureCopy}>
                  <Text style={styles.disclosureTitle}>Pasivos y patrimonio no calculados</Text>
                  <Text style={styles.helper}>La app no registra deudas ni otras obligaciones. Este balance usa solo saldos registrados y no proyecta fechas futuras.</Text>
                </View>
              </GlassPanel>
            </>}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  content: { padding: 20, paddingBottom: 44 },
  state: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  hero: { backgroundColor: colors.hero, borderColor: colors.heroBorder, justifyContent: 'center', marginTop: 20, minHeight: 188, padding: 22 },
  heroKicker: { color: colors.heroMuted, fontSize: 13, fontWeight: '700' },
  heroAmount: { color: colors.accent, fontSize: 39, fontVariant: ['tabular-nums'], fontWeight: '800', letterSpacing: -1, marginTop: 12 },
  heroDate: { color: colors.heroMuted, fontSize: 12, marginTop: 8 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 12, marginTop: 25 },
  accountPanel: { backgroundColor: colors.surface, gap: 14, padding: 16 },
  accountRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  accountMark: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  accountMarkText: { fontSize: 15, fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  accountKind: { color: colors.muted, fontSize: 11, marginTop: 3 },
  accountAmount: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '800', maxWidth: '39%' },
  negative: { color: colors.expense },
  disclosure: { alignItems: 'flex-start', backgroundColor: colors.tint, flexDirection: 'row', gap: 11, marginTop: 18, padding: 15 },
  disclosureMark: { alignItems: 'center', borderColor: colors.primary, borderRadius: 9, borderWidth: 1, color: colors.primary, fontSize: 14, fontWeight: '800', height: 22, lineHeight: 20, textAlign: 'center', width: 22 },
  disclosureCopy: { flex: 1, gap: 5 },
  disclosureTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
}));
