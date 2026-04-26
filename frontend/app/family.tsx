import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, Trash2, Camera, Pencil, X, Lock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVault } from '../src/contexts/VaultContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Card, PrimaryButton, StatusBadge } from '../src/components/UI';
import { colors, radius, spacing } from '../src/constants/theme';
import { fmtDate, getDocStatus } from '../src/utils/date';
import type { FamilyMember } from '../src/types';

export default function FamilyScreen() {
  const { family, addFamily, removeFamily, updateFamily, docs } = useVault();
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [dob, setDob] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();

  useEffect(() => {
    if (params.focus) setViewing(String(params.focus));
  }, [params.focus]);

  const reset = () => { setEditing(null); setName(''); setRelation(''); setDob(''); setAvatar(undefined); };

  const onPickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (r.canceled) return;
    const a = r.assets[0];
    const dataUri = a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri;
    setAvatar(dataUri);
  };

  const onSubmit = async () => {
    if (!name.trim()) return;
    if (editing) {
      await updateFamily(editing.id, { name: name.trim(), relation: relation.trim() || 'Family', dob: dob.trim() || undefined, avatar });
    } else {
      await addFamily({ name: name.trim(), relation: relation.trim() || 'Family', dob: dob.trim() || undefined, avatar });
    }
    setOpen(false); reset();
  };

  const openEdit = (m: FamilyMember) => {
    setEditing(m);
    setName(m.name); setRelation(m.relation); setDob(m.dob || ''); setAvatar(m.avatar);
    setOpen(true);
  };

  const onRemove = (id: string) => {
    if (id === 'me') return;
    Alert.alert('Remove member?', 'Their documents stay in your vault but become unassigned.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFamily(id) },
    ]);
  };

  const focused = useMemo(() => family.find((f) => f.id === viewing), [family, viewing]);
  const focusedDocs = useMemo(() => docs.filter((d) => d.ownerId === viewing), [docs, viewing]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="family-back-btn"><ChevronLeft color={colors.textPrimary} size={22} /></TouchableOpacity>
        <Text style={styles.topTitle}>Family</Text>
        <TouchableOpacity style={[styles.addSm, { backgroundColor: t.accentSurface }]} onPress={() => { reset(); setOpen(true); }} testID="family-add-btn">
          <Plus color={t.accent} size={18} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 40, gap: spacing.md }}>
        {family.map((f) => {
          const count = docs.filter((d) => d.ownerId === f.id).length;
          return (
            <TouchableOpacity key={f.id} activeOpacity={0.85} onPress={() => setViewing(f.id)} testID={`family-row-${f.id}`}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {f.avatar ? <Image source={{ uri: f.avatar }} style={styles.av} /> :
                  <View style={[styles.av, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: t.accent, fontWeight: '800', fontSize: 18 }}>{f.name[0]}</Text>
                  </View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.fName}>{f.name}</Text>
                  <Text style={styles.fSub}>{f.relation}{f.dob ? ` · DOB ${f.dob}` : ''}</Text>
                  <Text style={styles.fDocs}>{count} documents</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => openEdit(f)} style={[styles.smBtn, { backgroundColor: t.accentSurface }]} testID={`family-edit-${f.id}`}>
                    <Pencil color={t.accent} size={14} />
                  </TouchableOpacity>
                  {f.id !== 'me' && (
                    <TouchableOpacity onPress={() => onRemove(f.id)} style={styles.trash} testID={`family-remove-${f.id}`}>
                      <Trash2 color={colors.overdue} size={14} />
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => { setOpen(false); reset(); }}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.editHead}>
              <Text style={styles.modalTitle}>{editing ? 'Edit member' : 'Add member'}</Text>
              <TouchableOpacity onPress={() => { setOpen(false); reset(); }}><X color={colors.textPrimary} size={22} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
              <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                <TouchableOpacity onPress={onPickPhoto} testID="family-pick-photo" activeOpacity={0.8}>
                  {avatar ? <Image source={{ uri: avatar }} style={styles.bigAv} /> : (
                    <View style={[styles.bigAv, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Camera color={t.accent} size={28} />
                    </View>
                  )}
                  <View style={[styles.cameraBadge, { backgroundColor: t.accent }]}><Camera color="#fff" size={12} /></View>
                </TouchableOpacity>
                <Text style={styles.photoHint}>{avatar ? 'Tap to change photo' : 'Tap to add photo (or use initials)'}</Text>
              </View>
              <TextInput placeholder="Name" placeholderTextColor={colors.textTertiary} style={styles.input} value={name} onChangeText={setName} testID="family-input-name" />
              <TextInput placeholder="Relation (e.g. Spouse, Child)" placeholderTextColor={colors.textTertiary} style={styles.input} value={relation} onChangeText={setRelation} testID="family-input-relation" />
              <TextInput placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor={colors.textTertiary} style={styles.input} value={dob} onChangeText={setDob} testID="family-input-dob" />
              <PrimaryButton title={editing ? 'Save changes' : 'Add member'} onPress={onSubmit} style={{ marginTop: spacing.md }} variant="dark" testID="family-save-btn" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Member docs view */}
      <Modal visible={!!viewing} animationType="slide" onRequestClose={() => setViewing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.top}>
            <TouchableOpacity style={styles.back} onPress={() => setViewing(null)} testID="member-view-close"><ChevronLeft color={colors.textPrimary} size={22} /></TouchableOpacity>
            <Text style={styles.topTitle} numberOfLines={1}>{focused?.name || 'Member'}</Text>
            <TouchableOpacity style={[styles.smBtn, { backgroundColor: t.accentSurface }]} onPress={() => focused && (openEdit(focused), setViewing(null))} testID="member-view-edit"><Pencil color={t.accent} size={14} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 40 }}>
            <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl, backgroundColor: t.accentDark }}>
              {focused?.avatar ? <Image source={{ uri: focused.avatar }} style={[styles.bigAv, { width: 96, height: 96, borderRadius: 48 }]} /> :
                <View style={[styles.bigAv, { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800' }}>{focused?.name?.[0] || '?'}</Text>
                </View>}
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: spacing.md }}>{focused?.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>{focused?.relation}{focused?.dob ? ` · DOB ${focused.dob}` : ''}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>{focusedDocs.length} documents</Text>
            </Card>
            <Text style={{ marginTop: spacing.xl, marginBottom: spacing.md, fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>Documents</Text>
            {focusedDocs.length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>No documents yet for {focused?.name}</Text>
            ) : focusedDocs.map((d) => (
              <TouchableOpacity key={d.id} style={styles.docRow} onPress={() => { setViewing(null); router.push(`/document/${d.id}`); }} testID={`member-doc-${d.id}`}>
                <View style={[styles.docThumb, { backgroundColor: t.accentSurface }]}><Lock color={t.accent} size={16} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{d.name}</Text>
                  <Text style={styles.docSub}>{d.category} · Expires {fmtDate(d.expiryDate)}</Text>
                </View>
                <StatusBadge status={getDocStatus(d.expiryDate)} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  addSm: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginHorizontal: 8 },
  av: { width: 56, height: 56, borderRadius: 28 },
  bigAv: { width: 84, height: 84, borderRadius: 42 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg },
  photoHint: { fontSize: 12, color: colors.textTertiary, marginTop: 8 },
  fName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  fSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  fDocs: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  smBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trash: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FDF4F1', alignItems: 'center', justifyContent: 'center' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(28,63,58,0.35)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  editHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.sm },
  docThumb: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  docSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
