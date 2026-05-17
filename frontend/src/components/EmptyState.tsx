import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { PrimaryButton } from './UI';

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

/** Reusable empty state with optional CTA. Centered, themed icon disc. */
export function EmptyState({ icon, title, subtitle, actionLabel, onAction, testID, style, compact = false }: Props) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.compact, style]} testID={testID}>
      {icon && (
        <View style={[styles.iconDisc, { backgroundColor: t.accentSurface }]}>
          {icon}
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View style={{ marginTop: spacing.lg, minWidth: 180 }}>
          <PrimaryButton title={actionLabel} onPress={onAction} variant="dark" testID={testID ? `${testID}-action` : undefined} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
  },
  compact: {
    paddingVertical: spacing.xl,
  },
  iconDisc: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
});
