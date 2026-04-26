import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Trash2, Lock, Calendar, User, Bell, ShieldCheck, Pencil, Download, X, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card, StatusBadge, PrimaryButton } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';
import { fmtDate, getDocStatus } from '../../src/utils/date';
import { getKey, decryptToBase64 } from '../../src/services/encryption';
import { readEncryptedLocal } from '../../src/services/drive';

export default function DocDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { docs, family, deleteDoc, updateDoc } = useVault();
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
        <View style={{ padding: spacing.xxl }}>
          <Text>Document not found</Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color: t.accent, marginTop: 12 }}>Go back</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const owner = family.find((f) => f.id === doc.ownerId);

  const onDelete = () => Alert.alert('Delete document?', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDoc(doc.id); router.back(); } },
  ]);

  const onSaveEdit = async () => {
    await updateDoc(doc.id, { name, ownerId, notes, issueDate, expiryDate, reminder });
    setEditOpen(false);
  };

  const onDownload = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Web preview', 'File download is supported on the mobile app. On web, the encrypted file remains available in your local cache.');
      return;
    }
    if (!doc.localUri && !doc.fileId) { Alert.alert('Unavailable', 'No file is attached to this document.'); return; }
    setDownloading(true);
    try {
      const key = await getKey();
      if (!key) throw new Error('Missing encryption key');
      let cipher = '';
      if (doc.localUri) cipher = await readEncryptedLocal(doc.localUri);
      const b64 = decryptToBase64(cipher, key);
      const ext = doc.mimeType?.includes('pdf') ? 'pdf' : doc.mimeType?.includes('png') ? 'png' : doc.mimeType?.includes('jpeg') ? 'jpg' : 'bin';
      const out = (FileSystem.documentDirectory || '') + `safevault_export_${doc.id}.${ext}`;
      await FileSystem.writeAsStringAsync(out, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Share.share({ url: out, message: doc.name });
    } catch (e: any) {
      Alert.alert('Download failed', e.message || 'Could not decrypt the file.');
    } finally { setDownloading(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="doc-back-btn"><ChevronLeft color={colors.textPrimary} size={22} /></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{doc.name}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.back} onPress={() => setEditOpen(true)} testID="doc-edit-btn"><Pencil color={colors.textPrimary} size={18} /></TouchableOpacity>
          <TouchableOpacity style={styles.back} onPress={onDelete} testID="doc-delete-btn"><Trash2 color={colors.overdue} size={18} /></TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 60 }}>
        <Card style={[styles.hero, { backgroundColor: t.accentDark }]}>
          <View style={styles.lockBig}><Lock color="#fff" size={28} /></View>
          <Text style={styles.heroName}>{doc.name}</Text>
          <Text style={styles.heroSub}>{doc.category} · AES‑256 encrypted</Text>
          <View style={{ marginTop: 12 }}><StatusBadge status={getDocStatus(doc.expiryDate)} /></View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="Edit" onPress={() => setEditOpen(true)} icon={<Pencil color="#fff" size={16} />} testID="doc-edit-action" />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="Download" onPress={onDownload} loading={downloading} variant="secondary" icon={<Download color={t.accent} size={16} />} testID="doc-download-action" />
          </View>
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <Field icon={<User color={t.accent} size={16} />} label="Owner" value={owner?.name || 'You'} accent={t.accentSurface} />
          <Field icon={<Calendar color={t.accent} size={16} />} label="Issued on" value={fmtDate(doc.issueDate)} accent={t.accentSurface} />
          <Field icon={<Calendar color={t.accent} size={16} />} label="Expires on" value={fmtDate(doc.expiryDate)} accent={t.accentSurface} />
          <Field icon={<ShieldCheck color={t.accent} size={16} />} label="File ID" value={(doc.fileId || '—').slice(0, 24) + '…'} accent={t.accentSurface} last />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Bell color={t.accent} size={16} />
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

      {/* Edit Modal */}
      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.editSheet}>
            <View style={styles.editHead}>
              <Text style={styles.editTitle}>Edit document</Text>
              <TouchableOpacity onPress={() => setEditOpen(false)} testID="edit-close-btn"><X color={colors.textPrimary} size={22} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Label text="Name" />
              <TextInput value={name} onChangeText={setName} style={styles.input} testID="edit-name" />
              <Label text="Owner" />
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {family.map((f) => (
                  <TouchableOpacity key={f.id} onPress={() => setOwnerId(f.id)} style={[styles.pill, ownerId === f.id && { backgroundColor: t.accentDark, borderColor: t.accentDark }]} testID={`edit-owner-${f.id}`}>
                    <Text style={[styles.pillTxt, { color: ownerId === f.id ? '#fff' : colors.textSecondary }]}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Label text="Issued" />
                  <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('issue')} testID="edit-issue-date">
                    <Calendar color={t.accent} size={14} /><Text style={styles.dateText}>{fmtDate(issueDate)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Label text="Expires" />
                  <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('expiry')} testID="edit-expiry-date">
                    <Calendar color={t.accent} size={14} /><Text style={styles.dateText}>{fmtDate(expiryDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Label text="Notes" />
              <TextInput value={notes} onChangeText={setNotes} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline testID="edit-notes" />
              <Label text="Reminders" />
              {(['days30', 'days7', 'days1'] as const).map((k) => (
                <TouchableOpacity key={k} style={[styles.rem, reminder[k] && { borderColor: t.accent, backgroundColor: t.accentSurface }]} onPress={() => setReminder({ ...reminder, [k]: !reminder[k] })} testID={`edit-rem-${k}`}>
                  <View style={[styles.cb, reminder[k] && { backgroundColor: t.accent, borderColor: t.accent }]}>{reminder[k] && <Check color="#fff" size={12} />}</View>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '500' }}>{k === 'days30' ? '30 days before' : k === 'days7' ? '7 days before' : '1 day before'}</Text>
                </TouchableOpacity>
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

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }

function Field({ icon, label, value, last, accent }: { icon: React.ReactNode; label: string; value: string; last?: boolean; accent: string }) {
  return (
    <View style={[styles.field, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={[styles.fieldIcon, { backgroundColor: accent }]}>{icon}</View>
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
  hero: { alignItems: 'center', paddingVertical: spacing.xxl, borderWidth: 0 },
  lockBig: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroName: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  fieldIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, color: colors.textTertiary, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '700' },
  fieldValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  remLine: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(28,63,58,0.35)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  editHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  editTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  label: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillTxt: { fontSize: 12, fontWeight: '700' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10 },
  dateText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  rem: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 6 },
  cb: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
