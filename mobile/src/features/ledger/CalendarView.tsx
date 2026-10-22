import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Movement } from '../../api/contracts';
import { createThemedStyles } from '../../ui';
import { getCalendarWeeks } from './months';
import { getDailyTotals } from './selectors';

const weekdayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const compactAmount = new Intl.NumberFormat('es-EC', { notation: 'compact', maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const dateLabel = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

export function CalendarView({ month, movements, selectedDate, onSelectDate }: {
  month: string;
  movements: Movement[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const { colors, styles } = useStyles();
  const weeks = getCalendarWeeks(month);
  const totals = getDailyTotals(movements);

  return (
    <View style={styles.container}>
      <View style={styles.weekdays}>
        {weekdayNames.map((day, index) => <Text accessibilityLabel={['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][index]} key={day} style={styles.weekday}>{day}</Text>)}
      </View>
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={`${month}-week-${weekIndex}`} style={styles.week}>
            {week.map((date, dayIndex) => {
              if (!date) return <View key={`${month}-${weekIndex}-${dayIndex}`} style={styles.emptyDay} />;
              const dayTotals = totals[date] ?? { income: 0, expenses: 0, transfers: 0 };
              const selected = date === selectedDate;
              const label = dateLabel.format(new Date(`${date}T12:00:00`));
              const transferLabel = dayTotals.transfers ? `, ${dayTotals.transfers} ${dayTotals.transfers === 1 ? 'transferencia' : 'transferencias'}` : '';

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ingresos ${currency.format(dayTotals.income)}, gastos ${currency.format(dayTotals.expenses)}${transferLabel}`}
                  accessibilityState={{ selected }}
                  android_ripple={{ color: `${colors.primary}20` }}
                  key={date}
                  onPress={() => onSelectDate(date)}
                  style={({ pressed }) => [styles.day, selected && styles.selectedDay, pressed && styles.pressed]}
                >
                  <Text style={[styles.dayNumber, selected && styles.selectedText]}>{Number(date.slice(-2))}</Text>
                  {dayTotals.income > 0 ? <Text adjustsFontSizeToFit numberOfLines={1} style={styles.income}>+{compactAmount.format(dayTotals.income)}</Text> : null}
                  {dayTotals.expenses > 0 ? <Text adjustsFontSizeToFit numberOfLines={1} style={styles.expense}>−{compactAmount.format(dayTotals.expenses)}</Text> : null}
                  {dayTotals.transfers > 0 ? <Text style={[styles.transfer, selected && styles.selectedText]}>⇄</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={styles.legend}>USD · + ingresos · − gastos · ⇄ transferencias</Text>
    </View>
  );
}

const useStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  container: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 8, padding: 10 },
  weekdays: { flexDirection: 'row', gap: 4, marginBottom: 5 },
  weekday: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  grid: { gap: 4 },
  week: { flexDirection: 'row', gap: 4 },
  emptyDay: { flex: 1, minWidth: 0, aspectRatio: 0.58 },
  day: { alignItems: 'flex-start', backgroundColor: colors.surfaceSolid, borderColor: colors.border, borderRadius: 9, borderWidth: 1, flex: 1, minWidth: 0, aspectRatio: 0.58, overflow: 'hidden', paddingHorizontal: 3, paddingTop: 4 },
  selectedDay: { backgroundColor: colors.tint, borderColor: colors.primary, borderWidth: 2 },
  pressed: { opacity: 0.75 },
  dayNumber: { color: colors.ink, fontSize: 11, fontWeight: '700', alignSelf: 'center' },
  selectedText: { color: colors.primary },
  income: { color: colors.primary, fontSize: 8, fontWeight: '700', lineHeight: 11, maxWidth: '100%' },
  expense: { color: colors.expense, fontSize: 8, fontWeight: '700', lineHeight: 11, maxWidth: '100%' },
  transfer: { color: colors.muted, fontSize: 11, fontWeight: '700', lineHeight: 13, alignSelf: 'center' },
  legend: { color: colors.muted, fontSize: 10, marginTop: 9, textAlign: 'center' },
}));
