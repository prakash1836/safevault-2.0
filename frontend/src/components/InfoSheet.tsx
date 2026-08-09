import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { IconButton } from './UI';

/** Simple bottom-sheet used for "Learn more" explanations. */
export function InfoSheet({
  visible,
  title,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet} testID={testID}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <IconButton variant="transparent" size={36} onPress={onClose} testID="info-sheet-close">
              <X color={colors.textPrimary} size={22} />
            </IconButton>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SheetParagraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.p}>{children}</Text>;
}
export function SheetHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h}>{children}</Text>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15, 31, 82, 0.28)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, maxHeight: '85%' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  body: { padding: spacing.xl, paddingBottom: spacing.xxl },
  h: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm },
  p: { ...typography.body, color: colors.textSecondary, lineHeight: 24, marginBottom: spacing.sm },
});
