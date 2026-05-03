import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../constants/theme';
import { useUpload } from '../contexts/UploadContext';

interface Props {
  title: string;
  canGoBack?: boolean;
}

export function UploadHeader({ title, canGoBack = true }: Props) {
  const router = useRouter();
  const { reset } = useUpload();

  const onBack = () => {
    if (router.canGoBack && router.canGoBack()) router.back();
    else { reset(); router.replace('/(tabs)/home'); }
  };

  const onClose = () => {
    reset();
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.bar}>
      <TouchableOpacity onPress={onBack} style={styles.btn} testID="upload-back-btn" disabled={!canGoBack}>
        {canGoBack ? <ChevronLeft color={colors.textPrimary} size={22} /> : <View style={{ width: 22 }} />}
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={styles.btn} testID="upload-close-btn">
        <X color={colors.textPrimary} size={20} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
});
