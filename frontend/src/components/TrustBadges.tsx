import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Cloud, Lock, ShieldCheck, ServerOff, Wifi, EyeOff } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const ICONS: Record<string, any> = {
  drive: Cloud,
  lock: Lock,
  shield: ShieldCheck,
  server: ServerOff,
  offline: Wifi,
  eyeoff: EyeOff,
};

export interface TrustBadge {
  icon: keyof typeof ICONS;
  text: string;
}

/** Chips used across onboarding + settings to reinforce the privacy story. */
export function TrustBadges({
  items,
  compact = false,
  testID,
}: {
  items: TrustBadge[];
  compact?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, compact && { gap: 6 }]} testID={testID}>
      {items.map((it, i) => {
        const Ic = ICONS[it.icon] || ShieldCheck;
        return (
          <View
            key={i}
            style={[
              styles.chip,
              { backgroundColor: t.accentSurface, borderColor: t.accent + '25' },
              compact && styles.chipSm,
            ]}
          >
            <Ic color={t.accent} size={compact ? 12 : 14} strokeWidth={1.8} />
            <Text style={[styles.txt, { color: t.accent }, compact && { fontSize: 11 }]} numberOfLines={1}>
              {it.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const DEFAULT_TRUST: TrustBadge[] = [
  { icon: 'lock', text: 'End-to-End Encryption' },
  { icon: 'drive', text: 'Your Google Drive' },
  { icon: 'server', text: 'No SafeVault Servers' },
  { icon: 'offline', text: 'Offline Ready' },
];

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipSm: { paddingHorizontal: 8, paddingVertical: 4 },
  txt: { ...typography.caption, fontWeight: '700', letterSpacing: 0.2 },
});
