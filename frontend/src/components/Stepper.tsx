import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, typography } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';

const LABELS = ['Type', 'Upload', 'Storage', 'Details', 'Review'];

export function Stepper({ step }: { step: number }) {
  const t = useTheme();
  return (
    <View style={styles.wrap} testID={`stepper-step-${step}`}>
      {LABELS.map((l, i) => {
        const active = i === step;
        const done = i < step;
        const filled = active || done;
        return (
          <React.Fragment key={l}>
            <View style={styles.item}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: filled ? t.accent : colors.elevated, borderColor: active ? t.accentDark : 'transparent' },
                  active && styles.dotActive,
                ]}
              >
                {done ? (
                  <Check color="#fff" size={14} strokeWidth={2.6} />
                ) : (
                  <Text style={[styles.num, { color: active ? '#fff' : colors.textTertiary }]}>{i + 1}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: filled ? colors.textPrimary : colors.textTertiary, fontWeight: filled ? '700' : '500' },
                ]}
              >
                {l}
              </Text>
            </View>
            {i < LABELS.length - 1 && (
              <View style={[styles.bar, { backgroundColor: done ? t.accent : colors.border }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  item: { alignItems: 'center', width: 58 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotActive: { borderWidth: 3 },
  num: { fontSize: 12, fontWeight: '800' },
  label: { ...typography.caption, marginTop: 6, letterSpacing: 0.2 },
  bar: { flex: 1, height: 2, marginHorizontal: 2, marginBottom: 22, borderRadius: 1 },
});
