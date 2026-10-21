import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles } from '../../ui';
import { formatMonth, moveMonth } from './months';

export function MonthNavigator({ month, onChange, disabled = false }: { month: string; onChange: (month: string) => void; disabled?: boolean }) {
  const { ui, styles } = useStyles();
  return (
    <View style={styles.monthControl}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onChange(moveMonth(month, -1))} style={({ pressed }) => [styles.monthArrow, disabled && ui.disabled, pressed && ui.pressed]}>
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.monthText}>{formatMonth(month)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" accessibilityState={{ disabled }} disabled={disabled} onPress={() => onChange(moveMonth(month, 1))} style={({ pressed }) => [styles.monthArrow, disabled && ui.disabled, pressed && ui.pressed]}>
        <Text style={styles.arrowText}>›</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles(({ colors }) => StyleSheet.create({
  monthControl: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthArrow: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  arrowText: { color: colors.ink, fontSize: 32, lineHeight: 36, marginTop: -3 },
  monthText: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '700', paddingHorizontal: 8, textAlign: 'center' },
}));
