import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2, Lock, Calendar, User, Bell, ShieldCheck } from 'lucide-react-native';
import { useVault } from '../../src/contexts/VaultContext';
import { Card, StatusBadge } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';
import { fmtDate, getDocStatus } from '../../src/utils/date';

export default function DocDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { docs, family, deleteDoc } = useVault();
  const router = useRouter();
  const doc = docs.find((d) => d.id === id);

  if (!doc) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={{ padding: spacing.xxl }}>
          <Text>Document not found</Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color: colors.primary, marginTop: 12 }}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const owner = family.find((f) => f.id === doc.ownerId);

  const onDelete = () => {
    Alert.alert('Delete document?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="doc-back-btn"><ChevronLeft color={colors.textPrimary} size={22} /></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{doc.name}</Text>
        <TouchableOpacity style={styles.back} onPress={onDelete} testID="doc-delete-btn"><Trash2 color={colors.overdue} size={20} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 60 }}>
        <Card style={styles.hero}>
          <View style={styles.lockBig}><Lock color="#fff" size={28} /></View>
          <Text style={styles.heroName}>{doc.name}</Text>
          <Text style={styles.heroSub}>{doc.category} · AES‑256 encrypted</Text>
          <View style={{ marginTop: 12 }}>
            <StatusBadge status={getDocStatus(doc.expiryDate)} />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Field icon={<User color={colors.primary} size={16} />} label="Owner" value={owner?.name || 'You'} />
          <Field icon={<Calendar color={colors.primary} size={16} />} label="Issued on" value={fmtDate(doc.issueDate)} />
          <Field icon={<Calendar color={colors.primary} size={16} />} label="Expires on" value={fmtDate(doc.expiryDate)} />
          <Field icon={<ShieldCheck color={colors.primary} size={16} />} label="File ID" value={(doc.fileId || '—').slice(0, 20) + '…'} last />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Bell color={colors.primary} size={16} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>Reminders</Text>
          </View>
          {doc.reminder.days30 && <Text style={styles.remLine}>· 30 days before expiry</Text>}
          {doc.reminder.days7 && <Text style={styles.remLine}>· 7 days before expiry</Text>}
          {doc.reminder.days1 && <Text style={styles.remLine}>· 1 day before expiry</Text>}
          {!doc.reminder.days30 && !doc.reminder.days7 && !doc.reminder.days1 && <Text style={styles.remLine}>No reminders set</Text>}
        </Card>

        {doc.notes ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>Notes</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>{doc.notes}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ icon, label, value, last }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={styles.fieldIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginHorizontal: 8 },
  hero: { backgroundColor: colors.dark, alignItems: 'center', paddingVertical: spacing.xxl, borderWidth: 0 },
  lockBig: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  fieldIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, color: colors.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '700' },
  fieldValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  remLine: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
