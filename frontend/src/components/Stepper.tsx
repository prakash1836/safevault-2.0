import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../constants/theme';

const LABELS = ['Type', 'Upload', 'Details', 'Review'];

export function Stepper({ step }: { step: number }) {
  return (
    <View style={styles.wrap} testID={`stepper-step-${step}`}>
      {LABELS.map((l, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <React.Fragment key={l}>
            <View style={styles.item}>
              <View style={[styles.dot, active && styles.dotActive, done && styles.dotDone]}>
                <Text style={[styles.num, (active || done) && { color: '#fff' }]}>{done ? '✓' : i + 1}</Text>
              </View>
              <Text style={[styles.label, active && { color: colors.textPrimary, fontWeight: '700' }]}>{l}</Text>
            </View>
            {i < LABELS.length - 1 && <View style={[styles.bar, done && { backgroundColor: colors.primary }]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg },
  item: { alignItems: 'center', width: 56 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: colors.primary },
  dotDone: { backgroundColor: colors.primary },
  num: { fontSize: 13, fontWeight: '700', color: colors.textTertiary },
  label: { fontSize: 10, color: colors.textTertiary, marginTop: 4, letterSpacing: 0.3 },
  bar: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4, marginBottom: 16 },
});
