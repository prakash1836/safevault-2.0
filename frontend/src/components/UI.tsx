import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../constants/theme';
import type { DocStatus } from '../utils/date';

export function PrimaryButton({ title, onPress, loading, testID, icon, style, variant = 'primary', disabled }: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'dark';
  disabled?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'dark' ? colors.dark : colors.primarySurface;
  const fg = variant === 'secondary' ? colors.primary : colors.textInverse;
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
    >
      <Text style={[styles.chipText, { color: active ? colors.textInverse : colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatusBadge({ status, testID }: { status: DocStatus | 'overdue'; testID?: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    valid: { bg: '#E5EFEA', fg: colors.valid, label: 'Valid' },
    expiring_soon: { bg: '#FBF1DE', fg: '#8E6A20', label: 'Expiring' },
    expired: { bg: '#F8E3DC', fg: colors.expired, label: 'Expired' },
    overdue: { bg: '#F3D8D0', fg: colors.overdue, label: 'Overdue' },
    none: { bg: colors.elevated, fg: colors.textSecondary, label: 'No expiry' },
  };
  const s = map[status] || map.none;
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, style }: { title: string; action?: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
      <Text style={[styles.sectionTitle, style]}>{title}</Text>
      {action}
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ value, color = colors.primary, bg = colors.border, height = 8 }: { value: number; color?: string; bg?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, backgroundColor: bg, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  btnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  chipInactive: { backgroundColor: colors.surface, borderColor: colors.border },
  chipText: { fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.sm,
  },
});
