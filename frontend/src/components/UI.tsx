import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import type { DocStatus } from '../utils/date';

export function PrimaryButton({ title, onPress, loading, testID, icon, style, variant = 'primary', disabled }: {
  title: string; onPress: () => void; loading?: boolean; testID?: string; icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>; variant?: 'primary' | 'secondary' | 'dark'; disabled?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : variant === 'dark' ? t.accentDark : t.accentSurface;
  const fg = variant === 'secondary' ? t.accent : '#FFFFFF';
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.85} onPress={onPress} disabled={disabled || loading}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon}<Text style={[s.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  const t = useTheme();
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.8}
      style={[
        s.chip,
        active ? { backgroundColor: t.accentDark, borderColor: t.accentDark } : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <Text style={[s.chipText, { color: active ? '#FFFFFF' : colors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StatusBadge({ status, testID }: { status: DocStatus | 'overdue'; testID?: string }) {
  const t = useTheme();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    valid: { bg: t.accentSurface, fg: t.accent, label: 'Valid' },
    expiring_soon: { bg: '#FBF1DE', fg: '#8E6A20', label: 'Expiring' },
    expired: { bg: '#F8E3DC', fg: colors.expired, label: 'Expired' },
    overdue: { bg: '#F3D8D0', fg: colors.overdue, label: 'Overdue' },
    none: { bg: colors.elevated, fg: colors.textSecondary, label: 'No expiry' },
  };
  const v = map[status] || map.none;
  return (
    <View testID={testID} style={[s.badge, { backgroundColor: v.bg }]}>
      <Text style={[s.badgeText, { color: v.fg }]}>{v.label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View testID={testID} style={[s.card, style]}>{children}</View>;
}

export function ProgressBar({ value, color, bg = colors.border, height = 8 }: { value: number; color?: string; bg?: string; height?: number }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, backgroundColor: bg, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color || t.accent }} />
    </View>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  btnText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start', flexShrink: 0 },
  chipText: { fontSize: 13, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadow.sm },
});
