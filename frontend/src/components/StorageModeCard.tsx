import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Smartphone, Cloud, Sparkles, Check } from 'lucide-react-native';
import { colors, radius, spacing, typography, shadow } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { PressableScale } from './PressableScale';
import type { StorageMode } from '../services/storagePreference';

/**
 * Reusable storage-mode picker used in Onboarding step 4 AND in the Upload
 * wizard's "Storage Type" step. Keeping the shape identical everywhere so the
 * user learns the pattern once.
 */
export function StorageModeCard({
  mode,
  selected,
  onSelect,
  recommended,
  testID,
}: {
  mode: StorageMode;
  selected: boolean;
  onSelect: (m: StorageMode) => void;
  recommended?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const meta = COPY[mode];
  const Icon = meta.icon;
  return (
    <PressableScale onPress={() => onSelect(mode)} testID={testID} haptic="selection">
      <View
        style={[
          styles.card,
          selected && { borderColor: t.accent, backgroundColor: t.accentSurface },
        ]}
      >
        <View style={styles.headRow}>
          <View style={[styles.iconWrap, { backgroundColor: selected ? t.accent : t.accentSurface }]}>
            <Icon color={selected ? '#fff' : t.accent} size={22} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{meta.title}</Text>
              {recommended && (
                <View style={[styles.recBadge, { backgroundColor: t.accent }]}>
                  <Sparkles color="#fff" size={10} strokeWidth={2.4} />
                  <Text style={styles.recBadgeText}>Recommended</Text>
                </View>
              )}
            </View>
            <Text style={styles.subtitle}>{meta.subtitle}</Text>
          </View>
          {selected && (
            <View style={[styles.checkDot, { backgroundColor: t.accent }]}>
              <Check color="#fff" size={14} strokeWidth={3} />
            </View>
          )}
        </View>
        <View style={styles.bullets}>
          {meta.bullets.map((b, i) => (
            <View key={i} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: t.accent }]} />
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.cta, { borderColor: selected ? t.accent : colors.border }]}>
          <Text style={[styles.ctaText, { color: selected ? t.accent : colors.textSecondary }]}>
            {meta.cta}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const COPY: Record<StorageMode, {
  icon: any;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: string;
}> = {
  local: {
    icon: Smartphone,
    title: 'Local Vault',
    subtitle: 'Stored only on this device',
    bullets: [
      'Fast offline access',
      'Never uploaded to Google Drive',
      'Lost if this device is permanently lost',
    ],
    cta: 'Store Locally',
  },
  drive: {
    icon: Cloud,
    title: 'Secure Cloud Vault',
    subtitle: 'Stored inside YOUR Google Drive',
    bullets: [
      'Encrypted before upload',
      'Automatic backup',
      'Cannot be opened directly from Google Drive',
    ],
    cta: 'Upload Securely',
  },
  both: {
    icon: Sparkles,
    title: 'Local + Secure Cloud',
    subtitle: 'Instant access plus encrypted backup',
    bullets: [
      'Instant offline access',
      'Automatic encrypted backup',
      'Best protection against phone loss',
    ],
    cta: 'Use Both',
  },
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.xs,
    gap: spacing.md,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  recBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  checkDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bullets: { gap: 8, paddingLeft: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletDot: { width: 4, height: 4, borderRadius: 2 },
  bulletText: { ...typography.bodySm, color: colors.textPrimary, flex: 1, lineHeight: 20 },
  cta: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  ctaText: { ...typography.bodySm, fontWeight: '700', letterSpacing: 0.2 },
});
