import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, CheckCircle2 } from 'lucide-react-native';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { useUpload } from '../../src/contexts/UploadContext';
import { useVault } from '../../src/contexts/VaultContext';
import { PrimaryButton, Card } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';
import { fmtDate } from '../../src/utils/date';

export default function ReviewStep() {
  const { draft, reset } = useUpload();
  const { addDoc, family } = useVault();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const owner = family.find((f) => f.id === draft.ownerId);

  const submit = async () => {
    if (!draft.fileBase64 || !draft.category) return;
    setLoading(true);
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
      reset();
      router.replace('/(tabs)/docs');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Review" />
      <Stepper step={3} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Almost done</Text>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.fileIcon}><Lock color={colors.primary} size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{draft.name}</Text>
            <Text style={styles.sub}>{draft.category} · {(draft.size! / 1024).toFixed(1)} KB</Text>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Row label="Owner" value={owner?.name || 'You'} />
          <Row label="Issued" value={fmtDate(draft.issueDate || undefined)} />
          <Row label="Expires" value={fmtDate(draft.expiryDate || undefined)} last />
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.remH}>Reminders</Text>
          {[
            ['days30', '30 days before'],
            ['days7', '7 days before'],
            ['days1', '1 day before'],
          ].map(([k, l]) => (
            <View key={k} style={styles.remRow}>
              <CheckCircle2 color={draft.reminder[k as keyof typeof draft.reminder] ? colors.primary : colors.border} size={18} />
              <Text style={[styles.remTxt, !draft.reminder[k as keyof typeof draft.reminder] && { color: colors.textTertiary }]}>{l}</Text>
            </View>
          ))}
        </Card>

        <View style={styles.assurance}>
          <Lock color={colors.primary} size={14} />
          <Text style={styles.assText}>Your file will be encrypted with AES‑256 before upload</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton title="Encrypt & Save" loading={loading} onPress={submit} testID="review-submit-btn" variant="dark" />
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  h1: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.lg },
  fileIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowL: { fontSize: 13, color: colors.textSecondary },
  rowV: { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
  remH: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  remTxt: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  assurance: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, borderRadius: radius.lg, backgroundColor: colors.primarySurface, marginTop: spacing.md },
  assText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  footer: { padding: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
