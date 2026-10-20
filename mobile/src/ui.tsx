import { forwardRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';

export const colors = {
  background: '#F3F6F8', surface: '#FFFFFF', ink: '#183246', muted: '#586F7D',
  primary: '#11776D', primaryPressed: '#0D655D', tint: '#E6F3EF', accent: '#D9ED9A',
  border: '#DCE5EA', expense: '#AD453C', expenseTint: '#FCEEEB',
};

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, busy = false, disabled, variant = 'primary', style, accessibilityState, ...props }: ButtonProps) {
  const unavailable = disabled || busy;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: !!unavailable, busy }}
      android_ripple={{ color: variant === 'primary' ? '#FFFFFF24' : '#18324612' }}
      disabled={unavailable}
      style={({ pressed }) => [
        ui.button, variant === 'secondary' && ui.secondaryButton,
        variant === 'danger' && ui.dangerButton, style,
        pressed && ui.pressed, unavailable && ui.disabled,
      ]}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? colors.surface : colors.primary} /> : null}
      <Text style={[ui.buttonText, variant === 'secondary' && ui.secondaryText, variant === 'danger' && ui.dangerText]}>{label}</Text>
    </Pressable>
  );
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, TextInputProps>(function Input({ style, onFocus, onBlur, editable, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.primary}
      {...props}
      editable={editable}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      ref={ref}
      style={[ui.input, style, focused && ui.inputFocused, editable === false && ui.disabled]}
    />
  );
});

export function ScreenHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  return (
    <View style={ui.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver al libro" android_ripple={{ color: '#18324612' }} onPress={onBack} style={({ pressed }) => [ui.back, pressed && ui.pressed]}>
        <Text style={ui.backIcon}>‹</Text>
      </Pressable>
      <View style={ui.headerCopy}>
        <Text accessibilityRole="header" style={ui.title}>{title}</Text>
        {subtitle ? <Text style={ui.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 26, marginHorizontal: 20, marginTop: 12 },
  headerCopy: { flex: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  back: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 48, justifyContent: 'center', overflow: 'hidden', width: 48 },
  backIcon: { color: colors.ink, fontSize: 34, lineHeight: 38, marginTop: -4 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 9, marginTop: 22 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 14, borderWidth: 2, color: colors.ink, fontSize: 16, minHeight: 54, paddingHorizontal: 14, paddingVertical: 12 },
  inputFocused: { backgroundColor: colors.surface, borderColor: colors.primary },
  amount: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, minHeight: 78, fontVariant: ['tabular-nums'] },
  button: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 15, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 14 },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  secondaryText: { color: colors.ink },
  dangerButton: { backgroundColor: colors.expenseTint },
  dangerText: { color: colors.expense },
  segmented: { backgroundColor: '#E5ECF0', borderRadius: 16, flexDirection: 'row', gap: 4, padding: 4 },
  segment: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 8, paddingVertical: 10 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  segmentTextActive: { color: colors.primary, fontWeight: '800' },
  error: { backgroundColor: colors.expenseTint, borderLeftColor: colors.expense, borderLeftWidth: 3, borderRadius: 12, color: colors.expense, fontSize: 14, lineHeight: 21, marginVertical: 16, padding: 14 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
