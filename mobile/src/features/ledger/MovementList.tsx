import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactElement } from 'react';
import type { Category, Movement } from '../../api/contracts';
import { createThemedStyles } from '../../ui';

const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const accountNames = { cash: 'Efectivo', bank: 'Débito' } as const;

type Props = {
  movements: Movement[];
  categories: Category[];
  header: ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
  onEditMovement: (movement: Movement) => void;
};

export function MovementList({ movements, categories, header, refreshing, onRefresh, onEditMovement }: Props) {
  const { styles } = useStyles();
  const recentFirst = [...movements].sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={recentFirst}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Sin movimientos en esta selección</Text><Text style={styles.emptyText}>Registra un ingreso o gasto, o elige otra cuenta o mes.</Text></View>}
      ListHeaderComponent={header}
      onRefresh={onRefresh}
      refreshing={refreshing}
      renderItem={({ item }) => <MovementRow movement={item} categories={categories} onPress={() => onEditMovement(item)} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

function MovementRow({ movement, categories, onPress }: { movement: Movement; categories: Category[]; onPress: () => void }) {
  const { ui, styles } = useStyles();
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
  const canEdit = movement.kind !== 'transfer';
  const symbol = movement.kind === 'income' ? '↙' : movement.kind === 'expense' ? '↗' : '⇄';

  return (
    <Pressable
      accessibilityRole={canEdit ? 'button' : undefined}
      accessibilityLabel={`${title}, ${dateLabel}, ${detail}, ${sign}${currency.format(movement.amount)}${movement.note ? ', ' + movement.note : ''}`}
      accessibilityHint={canEdit ? 'Abre el movimiento para editarlo o eliminarlo' : undefined}
      android_ripple={{ color: '#147D7312' }}
      disabled={!canEdit}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && ui.pressed]}
    >
      <View style={[styles.kindBadge, movement.kind === 'expense' && styles.expenseBadge]}><Text style={[styles.kindSymbol, amountStyle]}>{symbol}</Text></View>
      <View style={styles.description}>
        <Text numberOfLines={2} style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{dateLabel} · {detail}</Text>
        {movement.note ? <Text numberOfLines={2} style={styles.note}>{movement.note}</Text> : null}
      </View>
      <View style={styles.amountColumn}>
        <Text style={[styles.amount, amountStyle]}>{sign}{currency.format(movement.amount)}</Text>
        {canEdit ? <Text style={styles.editHint}>Editar ›</Text> : null}
      </View>
    </Pressable>
  );
}

const useStyles = createThemedStyles(({ colors, ui }) => StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 },
  empty: { backgroundColor: colors.surface, borderRadius: 18, padding: 24 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  row: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 88, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 16 },
  kindBadge: { alignItems: 'center', backgroundColor: colors.tint, borderRadius: 13, height: 38, justifyContent: 'center', marginRight: 11, width: 38 },
  expenseBadge: { backgroundColor: colors.expenseTint },
  kindSymbol: { fontSize: 21, fontWeight: '600' },
  description: { flex: 1, minWidth: 0, paddingRight: 8 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  amountColumn: { alignItems: 'flex-end', flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  editHint: { color: colors.muted, fontSize: 11, marginTop: 6 },
  income: { color: colors.primary },
  expense: { color: colors.expense },
  transfer: { color: colors.muted },
}));
