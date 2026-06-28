import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '../constants/theme';
import { useUpload } from '../contexts/UploadContext';
import { IconButton } from './UI';

interface Props {
  title: string;
  canGoBack?: boolean;
}

export function UploadHeader({ title, canGoBack = true }: Props) {
  const router = useRouter();
  const { reset } = useUpload();

  const onBack = () => {
    if (router.canGoBack && router.canGoBack()) router.back();
    else {
      reset();
      router.replace('/(tabs)/home');
    }
  };

  const onClose = () => {
    reset();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.bar}>
      {canGoBack ? (
        <IconButton variant="elevated" size={40} onPress={onBack} testID="upload-back-btn" accessibilityLabel="Go back">
          <ChevronLeft color={colors.textPrimary} size={22} strokeWidth={1.6} />
        </IconButton>
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <IconButton variant="elevated" size={40} onPress={onClose} testID="upload-close-btn" accessibilityLabel="Close">
        <X color={colors.textPrimary} size={20} strokeWidth={1.8} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    color: colors.textPrimary,
    marginHorizontal: 8,
  },
});
