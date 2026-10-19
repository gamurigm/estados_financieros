import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { Category, Movement } from '../../api/contracts';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const accountNames = { cash: 'Efectivo', bank: 'Débito' } as const;

type Props = {
  movements: Movement[];
  categories: Category[];
  header: ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
};

export function MovementList({ movements, categories, header, refreshing, onRefresh }: Props) {
  const recentFirst = [...movements].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={recentFirst}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={styles.empty}>No hay movimientos este mes.</Text>}
      ListHeaderComponent={header}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={({ item }) => <MovementRow movement={item} categories={categories} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function MovementRow({ movement, categories }: { movement: Movement; categories: Category[] }) {
  const category = categories.find((item) => item.id === movement.categoryId);
  const title = movement.kind === 'transfer' ? 'Transferencia' : category?.name ?? 'Movimiento';
  const detail = movement.kind === 'transfer'
    ? `${accountNames[movement.account ?? 'cash']} → ${accountNames[movement.toAccount ?? 'bank']}`
    : movement.kind === 'income'
      ? `A ${accountNames[movement.toAccount ?? 'cash']}`
      : `Desde ${accountNames[movement.account ?? 'cash']}`;
  const dateLabel = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short' })
    .format(new Date(`${movement.date}T12:00:00`));
  const sign = movement.kind === 'income' ? '+' : movement.kind === 'expense' ? '−' : '';
  const amountStyle = movement.kind === 'income' ? styles.income : movement.kind === 'expense' ? styles.expense : styles.transfer;

  return (
    <View style={styles.row}>
      <View style={[styles.kindDot, movement.kind === 'income' ? styles.incomeDot : movement.kind === 'expense' ? styles.expenseDot : styles.transferDot]} />
      <View style={styles.description}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.detail}>{dateLabel} · {detail}{movement.note ? ` · ${movement.note}` : ''}</Text>
      </View>
      <Text style={[styles.amount, amountStyle]}>{sign}{currency.format(movement.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 19, paddingTop: 12, paddingBottom: 28 },
  empty: { color: '#7a857e', fontSize: 14, paddingHorizontal: 8, paddingVertical: 26, textAlign: 'center' },
  row: { alignItems: 'center', backgroundColor: '#ffffff', borderColor: '#e8ece6', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginBottom: 9, minHeight: 73, paddingHorizontal: 14 },
  kindDot: { borderRadius: 7, height: 12, marginRight: 12, width: 12 },
  incomeDot: { backgroundColor: '#3c8a60' },
  expenseDot: { backgroundColor: '#c97563' },
  transferDot: { backgroundColor: '#82928a' },
  description: { flex: 1, paddingRight: 8 },
  title: { color: '#253b30', fontSize: 14, fontWeight: '700' },
  detail: { color: '#79847d', fontSize: 11, marginTop: 5 },
  amount: { fontSize: 13, fontWeight: '800' },
  income: { color: '#277347' },
  expense: { color: '#ae5147' },
  transfer: { color: '#566b60' },
});
