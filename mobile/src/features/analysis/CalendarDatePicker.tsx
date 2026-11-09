import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles, GlassPanel, useUi } from '../../ui';
import { formatMonth, getCalendarWeeks, moveMonth } from '../ledger/months';

const dateLabel = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
export function CalendarDatePicker({ label, date, onChange }: { label: string; date: string; onChange: (date: string) => void }) {
  const { colors, ui, styles } = useStyles();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(date.slice(0, 7));
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${date}`} onPress={() => { setMonth(date.slice(0, 7)); setVisible(true); }} style={({ pressed }) => [styles.dateButton, pressed && ui.pressed]}>
      <Text style={styles.dateLabel}>{label}</Text><Text style={styles.dateValue}>{dateLabel.format(new Date(`${date}T12:00:00`))}</Text>
    </Pressable>
    <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
      <View style={styles.overlay}><Pressable accessibilityLabel="Cerrar calendario" onPress={() => setVisible(false)} style={StyleSheet.absoluteFill} /><GlassPanel style={styles.dialog}>
        <View style={styles.monthRow}><Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => setMonth(moveMonth(month, -1))} style={styles.arrow}><Text style={styles.arrowText}>‹</Text></Pressable><Text accessibilityRole="header" style={styles.month}>{formatMonth(month)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => setMonth(moveMonth(month, 1))} style={styles.arrow}><Text style={styles.arrowText}>›</Text></Pressable></View>
        <View style={styles.grid}>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}
          {getCalendarWeeks(month).flatMap((week, row) => week.map((value, column) => value ? <Pressable accessibilityRole="button" accessibilityLabel={dateLabel.format(new Date(`${value}T12:00:00`))} accessibilityState={{ selected: value === date }} key={value} onPress={() => { onChange(value); setVisible(false); }} style={[styles.day, value === date && styles.selectedDay]}><Text style={[styles.dayText, value === date && styles.selectedDayText]}>{Number(value.slice(-2))}</Text></Pressable> : <View key={`empty-${row}-${column}`} style={styles.day} />))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.close}><Text style={styles.closeText}>Listo</Text></Pressable>
      </GlassPanel></View>
    </Modal>
  </>;
}

const useStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  dateButton: { flex: 1, minWidth: 0, padding: 12, borderColor: colors.border, borderWidth: 1, borderRadius: 14, backgroundColor: colors.surface },
  dateLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  dateValue: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 4 },
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0008' },
  dialog: { backgroundColor: colors.surface, padding: 16 },
  monthRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  arrow: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.input },
  arrowText: { color: colors.ink, fontSize: 28, lineHeight: 32 },
  month: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', color: colors.muted, fontSize: 12, fontWeight: '700', paddingVertical: 8, textAlign: 'center' },
  day: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  dayText: { color: colors.ink, fontSize: 14 },
  selectedDay: { backgroundColor: colors.primary },
  selectedDayText: { color: colors.onPrimary, fontWeight: '800' },
  close: { alignSelf: 'flex-end', marginTop: 10, paddingHorizontal: 18, paddingVertical: 10 },
  closeText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
}));
