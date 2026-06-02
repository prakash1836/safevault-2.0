import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { useUpload } from '../../src/contexts/UploadContext';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { PrimaryButton, Card } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { colors, radius, spacing, typography, shadow } from '../../src/constants/theme';
import { fmtDate } from '../../src/utils/date';
import { hapt } from '../../src/utils/haptics';

export default function ReviewStep() {
  const { draft, reset } = useUpload();
  const { addDoc, family, uploading, uploadProgress, uploadError, clearUploadError } = useVault();
  const t = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const owner = family.find((f) => f.id === draft.ownerId);

  const submit = async () => {
    if (!draft.fileBase64 || !draft.category) {
      Alert.alert('Missing data', 'Please go back and complete all required fields.');
      return;
    }
    hapt.light();
    setLoading(true);
    clearUploadError();
    
    try {
      await addDoc({
        name: draft.name,
        category: draft.category,
        ownerId: draft.ownerId,
        mimeType: draft.mimeType || 'application/octet-stream',
        size: draft.size || 0,
        issueDate: draft.issueDate || undefined,
        expiryDate: draft.expiryDate || undefined,
        notes: draft.notes,
        reminder: draft.reminder,
        fileBase64: draft.fileBase64,
      });
      
      hapt.success();
      setSuccess(true);
      
      // Show success briefly, then navigate
      setTimeout(() => {
        reset();
        router.replace('/(tabs)/docs');
      }, 1200);
      
    } catch (e: any) {
      hapt.error();
      const msg = e?.message || 'Please try again';
      // If save succeeded locally (network failure), it would not throw. Treat errors as critical.
      Alert.alert(
        'Upload failed',
        msg,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => submit() },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center' }}>
          <View style={[styles.successIcon, { backgroundColor: t.accentSurface }]}>
            <CheckCircle2 color={t.accent} size={48} strokeWidth={1.6} />
          </View>
          <Text style={styles.successTitle}>Encrypted & Saved!</Text>
          <Text style={styles.successSub}>Your document is now secure in your vault</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Review" />
      <Stepper step={3} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(200)}>
          <Text style={styles.h1}>Almost done</Text>
          <Text style={styles.h2}>Review your document details before encrypting</Text>
        </Animated.View>

        {/* Error banner */}
        {uploadError && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.errorBanner}>
            <AlertCircle color={colors.expired} size={18} />
            <Text style={styles.errorText}>{uploadError}</Text>
            <PressableScale onPress={clearUploadError} haptic="light">
              <Text style={[styles.errorDismiss, { color: t.accent }]}>Dismiss</Text>
            </PressableScale>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(50).duration(200)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} variant="elevated">
            <View style={[styles.fileIcon, { backgroundColor: t.accentSurface }]}>
              <Lock color={t.accent} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{draft.name || 'Untitled Document'}</Text>
              <Text style={styles.sub}>{draft.category} · {((draft.size || 0) / 1024).toFixed(1)} KB</Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(200)}>
          <Card style={{ marginTop: spacing.md }} variant="elevated">
            <Row label="Owner" value={owner?.name || 'You'} />
            <Row label="Issued" value={fmtDate(draft.issueDate || undefined)} />
            <Row label="Expires" value={fmtDate(draft.expiryDate || undefined)} last />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(200)}>
          <Card style={{ marginTop: spacing.md }} variant="elevated">
            <Text style={styles.remH}>Reminders</Text>
            {[
              ['days30', '30 days before'],
              ['days7', '7 days before'],
              ['days1', '1 day before'],
            ].map(([k, l]) => (
              <View key={k} style={styles.remRow}>
                <CheckCircle2 color={draft.reminder[k as keyof typeof draft.reminder] ? t.accent : colors.border} size={18} />
                <Text style={[styles.remTxt, !draft.reminder[k as keyof typeof draft.reminder] && { color: colors.textTertiary }]}>{l}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(200)} style={[styles.assurance, { backgroundColor: t.accentSurface }]}>
          <Lock color={t.accent} size={14} />
          <Text style={[styles.assText, { color: t.accent }]}>Your file will be encrypted with AES‑256 before upload</Text>
        </Animated.View>
      </ScrollView>
      
      <View style={styles.footer}>
        {uploading && uploadProgress > 0 && (
          <View style={styles.progressContainer} testID="upload-progress">
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%`, backgroundColor: t.accent }]} />
            </View>
            <Text style={styles.progressText}>
              {uploadProgress < 25 ? 'Preparing...' :
               uploadProgress < 50 ? 'Encrypting...' :
               uploadProgress < 75 ? 'Uploading...' :
               uploadProgress < 100 ? 'Finalizing...' : 'Done!'}
            </Text>
          </View>
        )}
        <PrimaryButton 
          title={loading ? "Encrypting..." : "Encrypt & Save"} 
          loading={loading || uploading} 
          onPress={submit} 
          testID="review-submit-btn" 
          variant="dark"
          disabled={!draft.fileBase64 || !draft.category}
        />
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowL}>{label}</Text>
      <Text style={styles.rowV}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  h1: { ...typography.h1, color: colors.textPrimary, marginBottom: 4 },
  h2: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.lg },
  
  // Error banner
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.expiredSurface, borderRadius: radius.lg, marginBottom: spacing.md },
  errorText: { flex: 1, ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  errorDismiss: { ...typography.bodySm, fontWeight: '700' },
  
  // File preview
  fileIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { ...typography.h3, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  
  // Details row
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowL: { ...typography.bodySm, color: colors.textSecondary },
  rowV: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '700' },
  
  // Reminders
  remH: { ...typography.bodySm, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  remTxt: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  
  // Assurance
  assurance: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.md },
  assText: { ...typography.caption, fontWeight: '600' },
  
  // Footer
  footer: { padding: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  
  // Upload progress
  progressContainer: { marginBottom: spacing.md },
  progressBar: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', fontWeight: '600' },
  
  // Success state
  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  successTitle: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  successSub: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
});
