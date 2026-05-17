import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, TextStyle, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { colors, radius, shadow, spacing, typography } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import type { DocStatus } from '../utils/date';
import { hapt } from '../utils/haptics';

/* ============================================================
 *  PrimaryButton — premium button with subtle press animation
 * ============================================================ */
type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost';

export function PrimaryButton({
  title,
  onPress,
  loading,
  testID,
  icon,
  iconRight,
  style,
  variant = 'primary',
  disabled,
  size = 'lg',
  fullWidth = true,
  haptic = 'light',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
  disabled?: boolean;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  haptic?: 'none' | 'light' | 'medium' | 'selection';
}) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const palette = {
    primary: { bg: t.accent, fg: '#FFFFFF', border: 'transparent' },
    secondary: { bg: t.accentSurface, fg: t.accent, border: 'transparent' },
    dark: { bg: t.accentDark, fg: '#FFFFFF', border: 'transparent' },
    ghost: { bg: 'transparent', fg: t.accent, border: t.accent },
  }[variant];

  const handle = () => {
    if (disabled || loading) return;
    if (haptic !== 'none') hapt[haptic]();
    onPress();
  };

  return (
    <Animated.View style={[animStyle, fullWidth ? undefined : { alignSelf: 'flex-start' }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 260 }); }}
        onPress={handle}
        disabled={disabled || loading}
        style={[
          s.btn,
          size === 'md' ? s.btnMd : s.btnLg,
          {
            backgroundColor: palette.bg,
            borderWidth: variant === 'ghost' ? 1.5 : 0,
            borderColor: palette.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <View style={s.btnInner}>
            {icon}
            <Text style={[s.btnText, { color: palette.fg }]}>{title}</Text>
            {iconRight}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ============================================================
 *  IconButton — square pressable for top-bars/toolbars
 * ============================================================ */
export function IconButton({
  children,
  onPress,
  testID,
  variant = 'surface',
  size = 40,
  badge,
  badgeColor,
  style,
  accessibilityLabel,
  haptic = 'light',
}: {
  children: React.ReactNode;
  onPress: () => void;
  testID?: string;
  variant?: 'surface' | 'elevated' | 'accent' | 'transparent';
  size?: number;
  badge?: string | number;
  badgeColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  haptic?: 'none' | 'light' | 'medium' | 'selection';
}) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const palette = {
    surface: { bg: colors.surface, border: colors.border },
    elevated: { bg: colors.elevated, border: 'transparent' },
    accent: { bg: t.accentSurface, border: 'transparent' },
    transparent: { bg: 'transparent', border: 'transparent' },
  }[variant];

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => { scale.value = withTiming(0.92, { duration: 80 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 280 }); }}
        onPress={() => { if (haptic !== 'none') hapt[haptic](); onPress(); }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2.4,
            backgroundColor: palette.bg,
            borderWidth: variant === 'surface' ? 1 : 0,
            borderColor: palette.border,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        {children}
        {badge !== undefined && (
          <View style={[s.badge, { backgroundColor: badgeColor || colors.expired }]}>
            <Text style={s.badgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ============================================================
 *  Chip — filter/toggle pill
 * ============================================================ */
export function Chip({
  label,
  active,
  onPress,
  testID,
  icon,
  size = 'md',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const t = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => { hapt.selection(); onPress?.(); }}
      style={[
        s.chip,
        size === 'sm' && s.chipSm,
        active
          ? { backgroundColor: t.accentDark, borderColor: t.accentDark }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {icon}
      <Text style={[s.chipText, { color: active ? '#FFFFFF' : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ============================================================
 *  StatusBadge — dot + label (more modern than solid pill)
 * ============================================================ */
export function StatusBadge({ status, testID, compact }: { status: DocStatus | 'overdue'; testID?: string; compact?: boolean }) {
  const t = useTheme();
  const map: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
    valid: { bg: t.accentSurface, fg: t.accent, dot: t.accent, label: 'Valid' },
    expiring_soon: { bg: colors.expiringSurface, fg: '#8E6A20', dot: colors.expiringSoon, label: 'Expiring' },
    expired: { bg: colors.expiredSurface, fg: colors.expired, dot: colors.expired, label: 'Expired' },
    overdue: { bg: colors.overdueSurface, fg: colors.overdue, dot: colors.overdue, label: 'Overdue' },
    none: { bg: colors.elevated, fg: colors.textSecondary, dot: colors.textTertiary, label: 'No expiry' },
  };
  const v = map[status] || map.none;
  return (
    <View testID={testID} style={[s.badgePill, { backgroundColor: v.bg }, compact && { paddingHorizontal: 8, paddingVertical: 3 }]}>
      <View style={[s.dot, { backgroundColor: v.dot }]} />
      <Text style={[s.badgePillText, { color: v.fg }]}>{v.label}</Text>
    </View>
  );
}

/* ============================================================
 *  SectionHeader — title + optional subtitle + trailing action
 * ============================================================ */
export function SectionHeader({
  title,
  subtitle,
  action,
  testID,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={s.sectionHeader} testID={testID}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

/* ============================================================
 *  Card — variants for premium vault feel
 * ============================================================ */
export function Card({
  children,
  style,
  testID,
  variant = 'default',
  padding = spacing.lg,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: 'default' | 'flat' | 'elevated' | 'dark';
  padding?: number;
}) {
  const t = useTheme();
  let extra: ViewStyle = {};
  if (variant === 'flat') {
    extra = { backgroundColor: colors.surfaceAlt, borderWidth: 0 } as ViewStyle;
  } else if (variant === 'elevated') {
    extra = { ...shadow.md, borderColor: colors.borderSubtle } as ViewStyle;
  } else if (variant === 'dark') {
    extra = { backgroundColor: t.accentDark, borderWidth: 0, ...shadow.hero } as ViewStyle;
  }
  return (
    <View testID={testID} style={[s.card, { padding }, extra, style]}>
      {children}
    </View>
  );
}

/* ============================================================
 *  ProgressBar — with rounded fill and theme accent
 * ============================================================ */
export function ProgressBar({
  value,
  color,
  bg = colors.border,
  height = 8,
  style,
}: {
  value: number;
  color?: string;
  bg?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[{ height, backgroundColor: bg, borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color || t.accent, borderRadius: height / 2 }} />
    </View>
  );
}

/* ============================================================
 *  Divider
 * ============================================================ */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.divider }, style]} />;
}

/* ============================================================
 *  Styles
 * ============================================================ */
const s = StyleSheet.create({
  // Button
  btn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  btnLg: { paddingVertical: 15, paddingHorizontal: spacing.xl, minHeight: 52 },
  btnMd: { paddingVertical: 11, paddingHorizontal: spacing.lg, minHeight: 42 },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  // Badge on icon button
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Chip
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  chipSm: { paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },

  // Status pill (dot + text)
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgePillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, gap: 8 },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  sectionSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.xs,
  },
});
