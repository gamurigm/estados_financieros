import { forwardRef, useState, type ComponentRef, type PropsWithChildren } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type ViewStyle,
} from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { palettes, type ThemeColors } from './theme/palette';
import { useTheme } from './theme/ThemeProvider';
import { DrawerMenuButton } from './navigation/FinanceDrawer';

function createUi(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { padding: 20, paddingBottom: 40 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 20, boxShadow: `0px 8px 24px ${colors.glow}` },
    header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 26, marginHorizontal: 20, marginTop: 12 },
    headerCopy: { flex: 1 },
    title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
    subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
    back: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 48, justifyContent: 'center', overflow: 'hidden', width: 48 },
    backIcon: { color: colors.primary, fontSize: 34, lineHeight: 38, marginTop: -4 },
    label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 9, marginTop: 22 },
    helper: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    input: { backgroundColor: colors.input, borderColor: colors.border, borderRadius: 14, borderWidth: 2, color: colors.ink, fontSize: 16, minHeight: 54, paddingHorizontal: 14, paddingVertical: 12 },
    inputFocused: { backgroundColor: colors.surfaceSolid, borderColor: colors.primary },
    amount: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, minHeight: 78, fontVariant: ['tabular-nums'] },
    button: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.primary, borderWidth: 1, borderRadius: 15, flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 54, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 14 },
    buttonText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700', textAlign: 'center' },
    secondaryButton: { backgroundColor: colors.surface, borderColor: colors.border },
    secondaryText: { color: colors.ink },
    dangerButton: { backgroundColor: colors.expenseTint, borderColor: colors.expense },
    dangerText: { color: colors.expense },
    segmented: { backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 16, flexDirection: 'row', gap: 4, padding: 4 },
    segment: { alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'transparent', flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 8, paddingVertical: 10 },
    segmentActive: { backgroundColor: colors.tint, borderColor: colors.primary },
    segmentText: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
    segmentTextActive: { color: colors.primary, fontWeight: '800' },
    error: { backgroundColor: colors.expenseTint, borderLeftColor: colors.expense, borderLeftWidth: 3, borderRadius: 12, color: colors.expense, fontSize: 14, lineHeight: 21, marginVertical: 16, padding: 14 },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.5 },
    themeButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 48, minWidth: 76, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 10 },
    themeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
    themeIcon: { color: colors.primary, fontSize: 20 },
  });
}

const sharedStyles = { light: createUi(palettes.light), dark: createUi(palettes.dark) };
type UiTheme = { colors: ThemeColors; ui: ReturnType<typeof createUi> };

export function useUi() {
  const theme = useTheme();
  return { ...theme, ui: sharedStyles[theme.mode] };
}

export function createThemedStyles<T>(factory: (theme: UiTheme) => T) {
  const styles = {
    light: factory({ colors: palettes.light, ui: sharedStyles.light }),
    dark: factory({ colors: palettes.dark, ui: sharedStyles.dark }),
  };
  return function useThemedStyles() {
    const theme = useUi();
    return { ...theme, styles: styles[theme.mode] };
  };
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, busy = false, disabled, variant = 'primary', style, accessibilityState, ...props }: ButtonProps) {
  const { colors, ui } = useUi();
  const unavailable = disabled || busy;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: !!unavailable, busy }}
      android_ripple={{ color: `${colors.primary}20` }}
      disabled={unavailable}
      style={({ pressed }) => [
        ui.button, variant === 'secondary' && ui.secondaryButton,
        variant === 'danger' && ui.dangerButton, style,
        pressed && ui.pressed, unavailable && ui.disabled,
      ]}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} /> : null}
      <Text style={[ui.buttonText, variant === 'secondary' && ui.secondaryText, variant === 'danger' && ui.dangerText]}>{label}</Text>
    </Pressable>
  );
}

export const Input = forwardRef<ComponentRef<typeof TextInput>, TextInputProps>(function Input({ style, onFocus, onBlur, editable, ...props }, ref) {
  const { colors, ui, mode } = useUi();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.primary}
      keyboardAppearance={mode === 'dark' ? 'dark' : 'light'}
      {...props}
      editable={editable}
      onBlur={(event) => { setFocused(false); onBlur?.(event); }}
      onFocus={(event) => { setFocused(true); onFocus?.(event); }}
      ref={ref}
      style={[ui.input, style, focused && ui.inputFocused, editable === false && ui.disabled]}
    />
  );
});

export function ThemeToggle() {
  const { mode, selectTheme, ui } = useUi();
  const target = mode === 'dark' ? 'light' : 'dark';
  const label = target === 'light' ? 'Claro' : 'Oscuro';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Cambiar a tema ${label.toLowerCase()}`} accessibilityHint={`Tema actual: ${mode === 'dark' ? 'oscuro' : 'claro'}`} onPress={() => selectTheme(target)} style={({ pressed }) => [ui.themeButton, pressed && ui.pressed]}>
      <Text style={ui.themeIcon}>{target === 'light' ? '☼' : '☾'}</Text>
      <Text style={ui.themeText}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, onBack, showMenu = false }: { title: string; subtitle?: string; onBack: () => void; showMenu?: boolean }) {
  const { colors, ui } = useUi();
  return (
    <View style={ui.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver al libro" android_ripple={{ color: `${colors.primary}20` }} onPress={onBack} style={({ pressed }) => [ui.back, pressed && ui.pressed]}>
        <Text style={ui.backIcon}>‹</Text>
      </Pressable>
      <View style={ui.headerCopy}>
        <Text accessibilityRole="header" style={ui.title}>{title}</Text>
        {subtitle ? <Text style={ui.subtitle}>{subtitle}</Text> : null}
      </View>
      {showMenu ? <DrawerMenuButton /> : null}
      <ThemeToggle />
    </View>
  );
}

export function GlassPanel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors, mode, ui, blurTarget } = useUi();
  return (
    <View style={[ui.card, style, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
      <BlurView pointerEvents="none" blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" intensity={35} tint={mode === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: StyleSheet.flatten(style)?.backgroundColor ?? colors.surface }]} />
      {children}
    </View>
  );
}

export function CyberBackground() {
  const { colors, blurTarget } = useUi();
  return (
    <BlurTargetView pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" ref={blurTarget} style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <View style={[StyleSheet.absoluteFill, {
        backgroundImage: [
          { type: 'radial-gradient', shape: 'ellipse', size: 'farthest-corner', position: { left: '0%', top: '0%' }, colorStops: [{ color: colors.cyanGlow, positions: ['0%'] }, { color: 'transparent', positions: ['65%'] }] },
          { type: 'radial-gradient', shape: 'ellipse', size: 'farthest-corner', position: { right: '0%', top: '35%' }, colorStops: [{ color: colors.violetGlow, positions: ['0%'] }, { color: 'transparent', positions: ['65%'] }] },
        ],
      }]} />
      {Array.from({ length: 14 }, (_, index) => <View key={`column-${index}`} style={{ position: 'absolute', bottom: 0, top: 0, left: index * 36, borderLeftWidth: 1, borderLeftColor: colors.grid }} />)}
      {Array.from({ length: 30 }, (_, index) => <View key={`row-${index}`} style={{ position: 'absolute', left: 0, right: 0, top: index * 36, borderTopWidth: 1, borderTopColor: colors.grid }} />)}
    </BlurTargetView>
  );
}
