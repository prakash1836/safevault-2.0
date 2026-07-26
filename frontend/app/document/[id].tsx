import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Modal, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2, Lock, Calendar, User, Bell, ShieldCheck, Pencil, Download, X, Check, Clock, FileText, AlertCircle } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { useVault } from '../../src/contexts/VaultContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card, StatusBadge, PrimaryButton, IconButton, Chip } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { EncryptedImagePreview } from '../../src/components/EncryptedImagePreview';
import { SkeletonHero, SkeletonRow } from '../../src/components/Skeleton';
import { colors, radius, spacing, typography, shadow } from '../../src/constants/theme';
import { fmtDate, getDocStatus, daysUntil } from '../../src/utils/date';
import { getDocumentContent } from '../../src/services/documentContent';
import { hapt } from '../../src/utils/haptics';

export default function DocDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { docs, family, deleteDoc, updateDoc, loading } = useVault();
  const { user } = useAuth();
  const t = useTheme();
  const router = useRouter();
  const doc = docs.find((d) => d.id === id);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(doc?.name || '');
  const [ownerId, setOwnerId] = useState(doc?.ownerId || 'me');
  const [notes, setNotes] = useState(doc?.notes || '');
  const [issueDate, setIssueDate] = useState<string | undefined>(doc?.issueDate);
  const [expiryDate, setExpiryDate] = useState<string | undefined>(doc?.expiryDate);
  const [reminder, setReminder] = useState(doc?.reminder || { days30: true, days7: true, days1: true });
  const [pickWhich, setPickWhich] = useState<null | 'issue' | 'expiry'>(null);
  const [downloading, setDownloading] = useState(false);

  if (!doc) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={{ padding: spacing.xxl, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <FileText color={colors.textTertiary} size={48} strokeWidth={1.2} />
          <Text style={{ ...typography.h2, color: colors.textPrimary, marginTop: spacing.lg }}>Document not found</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 4 }}>It may have been deleted</Text>
          <PressableScale onPress={() => router.back()} haptic="light" style={{ marginTop: spacing.xl }}>
            <Text style={{ color: t.accent, ...typography.body, fontWeight: '700' }}>← Go back</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  const owner = family.find((f) => f.id === doc.ownerId);
  const status = getDocStatus(doc.expiryDate);
  const days = daysUntil(doc.expiryDate);
  const isExpiring = status === 'expiring_soon';
  const isExpired = status === 'expired';

  const onDelete = () => {
    hapt.warning();
    Alert.alert('Delete document?', 'This cannot be undone. The encrypted file will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { hapt.medium(); await deleteDoc(doc.id); router.back(); } },
    ]);
  };

  const onSaveEdit = async () => {
    hapt.success();
    await updateDoc(doc.id, { name, ownerId, notes, issueDate, expiryDate, reminder });
    setEditOpen(false);
  };

  const onDownload = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web preview', 'File download is supported on the mobile app. On web, the encrypted file remains available in your local cache.');
      return;
    }
    if (!doc.localUri && !doc.fileId) { Alert.alert('Unavailable', 'No file is attached to this document.'); return; }
    hapt.light();
    setDownloading(true);
    try {
      // Cache-first, integrity-verified. Downloads from Drive only when the
      // local cache is missing or unreadable.
      const result = await getDocumentContent(user!, doc);
      const ext = doc.mimeType?.includes('pdf') ? 'pdf' : doc.mimeType?.includes('png') ? 'png' : doc.mimeType?.includes('jpeg') ? 'jpg' : 'bin';
      const out = (FileSystem.documentDirectory || '') + `safevault_export_${doc.id}.${ext}`;
      await FileSystem.writeAsStringAsync(out, result.base64, { encoding: FileSystem.EncodingType.Base64 });
      hapt.success();
      if (result.integrityWarning) {
        Alert.alert('Integrity warning', `${result.integrityWarning}\n\nThe file has been decrypted, but its contents may have changed since it was saved.`);
      }
      await Share.share({ url: out, message: doc.name });
    } catch (e: any) {
      hapt.error();
      Alert.alert('Download failed', e.message || 'Could not decrypt the file.');
    } finally { setDownloading(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.top}>
        <IconButton variant="surface" onPress={() => router.back()} testID="doc-back-btn" accessibilityLabel="Go back">
          <ChevronLeft color={colors.textPrimary} size={22} />
        </IconButton>
        <Text style={styles.topTitle} numberOfLines={1}>{doc.name}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton variant="surface" onPress={() => { hapt.light(); setEditOpen(true); }} testID="doc-edit-btn" accessibilityLabel="Edit document">
            <Pencil color={colors.textPrimary} size={18} />
          </IconButton>
          <IconButton variant="danger" onPress={onDelete} testID="doc-delete-btn" accessibilityLabel="Delete document">
            <Trash2 color={colors.overdue} size={18} />
          </IconButton>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <Animated.View entering={FadeInDown.duration(250)}>
          <Card style={[styles.hero, { backgroundColor: t.accentDark }]} variant="elevated">
            <View style={styles.lockBig}><Lock color="#fff" size={28} strokeWidth={1.6} /></View>
            <Text style={styles.heroName}>{doc.name}</Text>
            <Text style={styles.heroSub}>{doc.category} · AES‑256 encrypted</Text>
            <View style={{ marginTop: spacing.md }}><StatusBadge status={status} /></View>
            
            {/* Expiry countdown chip */}
            {doc.expiryDate && (
              <View style={[styles.countdownChip, { backgroundColor: isExpired ? colors.expiredSurface : isExpiring ? colors.expiringSurface : 'rgba(255,255,255,0.15)' }]}>
                {isExpired ? <AlertCircle color={colors.expired} size={14} /> : <Clock color={isExpiring ? '#8E6A20' : 'rgba(255,255,255,0.7)'} size={14} />}
                <Text style={[styles.countdownText, { color: isExpired ? colors.expired : isExpiring ? '#8E6A20' : 'rgba(255,255,255,0.9)' }]}>
                  {isExpired ? `Expired ${Math.abs(days || 0)} days ago` : days === 0 ? 'Expires today' : `${days} days until expiry`}
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.delay(50).duration(250)} style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="Edit" onPress={() => { hapt.light(); setEditOpen(true); }} icon={<Pencil color="#fff" size={16} />} testID="doc-edit-action" variant="dark" />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="Download" onPress={onDownload} loading={downloading} variant="secondary" icon={<Download color={t.accent} size={16} />} testID="doc-download-action" />
          </View>
        </Animated.View>

        {/* Encrypted preview */}
        <Animated.View entering={FadeInDown.delay(100).duration(250)} style={{ marginTop: spacing.lg }}>
          <EncryptedImagePreview doc={{ id: doc.id, mimeType: doc.mimeType, localUri: doc.localUri, fileId: doc.fileId }} />
        </Animated.View>

        {/* Document details card */}
        <Animated.View entering={FadeInDown.delay(150).duration(250)}>
          <Card style={{ marginTop: spacing.lg }} variant="elevated">
            <Field icon={<User color={t.accent} size={16} />} label="Owner" value={owner?.name || 'You'} accent={t.accentSurface} />
            <Field icon={<Calendar color={t.accent} size={16} />} label="Issued on" value={fmtDate(doc.issueDate)} accent={t.accentSurface} />
            <Field icon={<Calendar color={t.accent} size={16} />} label="Expires on" value={fmtDate(doc.expiryDate)} accent={t.accentSurface} highlight={isExpired || isExpiring} highlightColor={isExpired ? colors.expired : '#8E6A20'} />
            <Field icon={<ShieldCheck color={t.accent} size={16} />} label="File ID" value={(doc.fileId || '—').slice(0, 24) + '…'} accent={t.accentSurface} last />
          </Card>
        </Animated.View>

        {/* Reminders card */}
        <Animated.View entering={FadeInDown.delay(200).duration(250)}>
          <Card style={{ marginTop: spacing.lg }} variant="elevated">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
              <Bell color={t.accent} size={16} />
              <Text style={{ ...typography.body, fontWeight: '700', color: colors.textPrimary }}>Reminders</Text>
            </View>
            {doc.reminder.days30 && <Text style={styles.remLine}>· 30 days before expiry</Text>}
            {doc.reminder.days7 && <Text style={styles.remLine}>· 7 days before expiry</Text>}
            {doc.reminder.days1 && <Text style={styles.remLine}>· 1 day before expiry</Text>}
            {!doc.reminder.days30 && !doc.reminder.days7 && !doc.reminder.days1 && <Text style={[styles.remLine, { color: colors.textTertiary }]}>No reminders set</Text>}
          </Card>
        </Animated.View>

        {/* Notes card */}
        {doc.notes ? (
          <Animated.View entering={FadeInDown.delay(250).duration(250)}>
            <Card style={{ marginTop: spacing.lg }} variant="elevated">
              <Text style={{ ...typography.bodySm, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>Notes</Text>
              <Text style={{ ...typography.body, color: colors.textSecondary, lineHeight: 22 }}>{doc.notes}</Text>
            </Card>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.editSheet}>
            <View style={styles.editHead}>
              <Text style={styles.editTitle}>Edit document</Text>
              <IconButton variant="transparent" size={36} onPress={() => setEditOpen(false)} testID="edit-close-btn">
                <X color={colors.textPrimary} size={22} />
              </IconButton>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Label text="Name" />
              <TextInput value={name} onChangeText={setName} style={styles.input} testID="edit-name" />
              
              <Label text="Owner" />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {family.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.name}
                    active={ownerId === f.id}
                    onPress={() => { hapt.selection(); setOwnerId(f.id); }}
                    testID={`edit-owner-${f.id}`}
                  />
                ))}
              </View>
              
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Label text="Issued" />
                  <PressableScale onPress={() => setPickWhich('issue')} testID="edit-issue-date" haptic="light">
                    <View style={styles.dateBtn}>
                      <Calendar color={t.accent} size={14} />
                      <Text style={styles.dateText}>{fmtDate(issueDate)}</Text>
                    </View>
                  </PressableScale>
                </View>
                <View style={{ flex: 1 }}>
                  <Label text="Expires" />
                  <PressableScale onPress={() => setPickWhich('expiry')} testID="edit-expiry-date" haptic="light">
                    <View style={[styles.dateBtn, expiryDate && { borderColor: t.accent, backgroundColor: t.accentSurface }]}>
                      <Calendar color={t.accent} size={14} />
                      <Text style={[styles.dateText, expiryDate && { color: t.accent, fontWeight: '700' }]}>{fmtDate(expiryDate)}</Text>
                    </View>
                  </PressableScale>
                </View>
              </View>
              
              <Label text="Notes" />
              <TextInput value={notes} onChangeText={setNotes} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline testID="edit-notes" />
              
              <Label text="Reminders" />
              {([
                { key: 'days30', label: '30 days before' },
                { key: 'days7', label: '7 days before' },
                { key: 'days1', label: '1 day before' },
              ] as const).map((item) => (
                <PressableScale key={item.key} onPress={() => { hapt.selection(); setReminder({ ...reminder, [item.key]: !reminder[item.key] }); }} testID={`edit-rem-${item.key}`} haptic="none">
                  <View style={[styles.rem, reminder[item.key] && { borderColor: t.accent, backgroundColor: t.accentSurface }]}>
                    <View style={[styles.cb, reminder[item.key] && { backgroundColor: t.accent, borderColor: t.accent }]}>
                      {reminder[item.key] && <Check color="#fff" size={12} strokeWidth={3} />}
                    </View>
                    <Text style={[styles.remTxt, reminder[item.key] && { color: t.accent }]}>{item.label}</Text>
                  </View>
                </PressableScale>
              ))}
              
              <PrimaryButton title="Save changes" onPress={onSaveEdit} variant="dark" testID="edit-save-btn" style={{ marginTop: spacing.lg }} />
            </ScrollView>
            {pickWhich && (
              <DateTimePicker
                value={new Date((pickWhich === 'issue' ? issueDate : expiryDate) || Date.now())}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (d) {
                    hapt.light();
                    if (pickWhich === 'issue') setIssueDate(d.toISOString());
                    else setExpiryDate(d.toISOString());
                  }
                  if (Platform.OS !== 'ios') setPickWhich(null);
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) { 
  return <Text style={styles.label}>{text}</Text>; 
}

function Field({ icon, label, value, last, accent, highlight, highlightColor }: { icon: React.ReactNode; label: string; value: string; last?: boolean; accent: string; highlight?: boolean; highlightColor?: string }) {
  return (
    <View style={[styles.field, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.fieldIcon, { backgroundColor: accent }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={[styles.fieldValue, highlight && highlightColor && { color: highlightColor }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: colors.textPrimary, marginHorizontal: 8 },
  
  // Hero card
  hero: { alignItems: 'center', paddingVertical: spacing.xxl, borderWidth: 0, ...shadow.hero },
  lockBig: { width: 68, height: 68, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroName: { color: '#fff', ...typography.h1, textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.7)', ...typography.bodySm, marginTop: 4 },
  countdownChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  countdownText: { ...typography.bodySm, fontWeight: '700' },
  
  // Details fields
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  fieldIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...typography.caption, color: colors.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '700' },
  fieldValue: { ...typography.body, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  
  // Reminders
  remLine: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  
  // Modal
  modalScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  editSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, maxHeight: '90%' },
  editHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  editTitle: { ...typography.h2, color: colors.textPrimary },
  label: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.textPrimary },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dateText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  rem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 6 },
  remTxt: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  cb: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
