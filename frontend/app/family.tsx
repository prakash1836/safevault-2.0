import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, Trash2, Camera, Pencil, X, Lock, User, Users, Crown, ShieldCheck, FileText } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, FadeInRight } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useVault } from '../src/contexts/VaultContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Card, PrimaryButton, StatusBadge, IconButton, SectionHeader } from '../src/components/UI';
import { PressableScale } from '../src/components/PressableScale';
import { EmptyState } from '../src/components/EmptyState';
import { colors, radius, spacing, shadow, typography } from '../src/constants/theme';
import { fmtDate, getDocStatus } from '../src/utils/date';
import { hapt } from '../src/utils/haptics';
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
    hapt.success();
    if (editing) {
      await updateFamily(editing.id, { name: name.trim(), relation: relation.trim() || 'Family', dob: dob.trim() || undefined, avatar });
    } else {
      await addFamily({ name: name.trim(), relation: relation.trim() || 'Family', dob: dob.trim() || undefined, avatar });
    }
    setOpen(false); reset();
  };

  const openEdit = (m: FamilyMember) => {
    hapt.light();
    setEditing(m);
    setName(m.name); setRelation(m.relation); setDob(m.dob || ''); setAvatar(m.avatar);
    setOpen(true);
  };

  const onRemove = (id: string) => {
    if (id === 'me') return;
    hapt.warning();
    Alert.alert('Remove member?', 'Their documents stay in your vault but become unassigned.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { hapt.medium(); removeFamily(id); } },
    ]);
  };

  const focused = useMemo(() => family.find((f) => f.id === viewing), [family, viewing]);
  const focusedDocs = useMemo(() => docs.filter((d) => d.ownerId === viewing), [docs, viewing]);

  // Get hierarchy icon based on relation
  const getRelationIcon = (relation: string) => {
    const rel = relation.toLowerCase();
    if (rel === 'self' || rel === 'you') return Crown;
    if (rel.includes('spouse') || rel.includes('partner')) return Users;
    return User;
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(200)} style={styles.top}>
        <IconButton variant="surface" onPress={() => router.back()} testID="family-back-btn" accessibilityLabel="Go back">
          <ChevronLeft color={colors.textPrimary} size={22} />
        </IconButton>
        <Text style={styles.topTitle}>Family Vault</Text>
        <IconButton variant="accent" onPress={() => { hapt.light(); reset(); setOpen(true); }} testID="family-add-btn" accessibilityLabel="Add member">
          <Plus color={t.accent} size={18} />
        </IconButton>
      </Animated.View>

      {/* Family Stats Summary */}
      <Animated.View entering={FadeInDown.delay(100).duration(250)} style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: t.accentSurface }]}>
          <Users color={t.accent} size={18} />
          <Text style={[styles.statNum, { color: t.accent }]}>{family.length}</Text>
          <Text style={styles.statLabel}>Members</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <FileText color={colors.textSecondary} size={18} />
          <Text style={styles.statNum}>{docs.length}</Text>
          <Text style={styles.statLabel}>Documents</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <ShieldCheck color={colors.valid} size={18} />
          <Text style={[styles.statNum, { color: colors.valid }]}>100%</Text>
          <Text style={styles.statLabel}>Protected</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingTop: 0, paddingBottom: 40, gap: spacing.sm }}>
        {family.length === 0 ? (
          <EmptyState
            icon={<Users color={t.accent} size={32} />}
            title="No family members yet"
            subtitle="Add family members to organize documents by person"
            actionLabel="Add Member"
            onAction={() => { reset(); setOpen(true); }}
            testID="family-empty"
          />
        ) : family.map((f, idx) => {
          const count = docs.filter((d) => d.ownerId === f.id).length;
          const RelIcon = getRelationIcon(f.relation);
          const isSelf = f.id === 'me';
          
          return (
            <Animated.View key={f.id} entering={FadeInDown.delay(150 + idx * 50).duration(250)}>
              <PressableScale onPress={() => setViewing(f.id)} testID={`family-row-${f.id}`} haptic="light">
                <View style={[styles.memberCard, isSelf && { borderColor: t.accent, borderWidth: 1.5 }]}>
                  {/* Avatar with hierarchy badge */}
                  <View style={styles.avatarWrap}>
                    {f.avatar ? (
                      <Image source={{ uri: f.avatar }} style={styles.av} />
                    ) : (
                      <View style={[styles.av, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: t.accent, fontWeight: '800', fontSize: 20 }}>{f.name[0]}</Text>
                      </View>
                    )}
                    {isSelf && (
                      <View style={[styles.hierarchyBadge, { backgroundColor: t.accent }]}>
                        <Crown color="#fff" size={10} />
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.fName}>{f.name}</Text>
                      {isSelf && <View style={[styles.selfTag, { backgroundColor: t.accentSurface }]}><Text style={[styles.selfTagText, { color: t.accent }]}>You</Text></View>}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <RelIcon color={colors.textTertiary} size={12} />
                      <Text style={styles.fSub}>{f.relation}{f.dob ? ` · ${f.dob}` : ''}</Text>
                    </View>
                    <View style={styles.docCountRow}>
                      <Lock color={t.accent} size={12} />
                      <Text style={[styles.fDocs, { color: t.accent }]}>{count} protected document{count !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <PressableScale onPress={() => openEdit(f)} haptic="light" testID={`family-edit-${f.id}`}>
                      <View style={[styles.smBtn, { backgroundColor: t.accentSurface }]}>
                        <Pencil color={t.accent} size={14} />
                      </View>
                    </PressableScale>
                    {!isSelf && (
                      <PressableScale onPress={() => onRemove(f.id)} haptic="light" testID={`family-remove-${f.id}`}>
                        <View style={styles.trash}>
                          <Trash2 color={colors.overdue} size={14} />
                        </View>
                      </PressableScale>
                    )}
                  </View>
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => { setOpen(false); reset(); }}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.editHead}>
              <Text style={styles.modalTitle}>{editing ? 'Edit member' : 'Add family member'}</Text>
              <IconButton variant="transparent" size={36} onPress={() => { setOpen(false); reset(); }}>
                <X color={colors.textPrimary} size={22} />
              </IconButton>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
              {/* Avatar picker */}
              <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                <PressableScale onPress={onPickPhoto} testID="family-pick-photo" haptic="light">
                  <View style={{ position: 'relative' }}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.bigAv} />
                    ) : (
                      <View style={[styles.bigAv, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                        <Camera color={t.accent} size={32} />
                      </View>
                    )}
                    <View style={[styles.cameraBadge, { backgroundColor: t.accent }]}>
                      <Camera color="#fff" size={14} />
                    </View>
                  </View>
                </PressableScale>
                <Text style={styles.photoHint}>{avatar ? 'Tap to change photo' : 'Add a profile photo'}</Text>
              </View>

              {/* Form fields */}
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                placeholder="e.g. Maya"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={name}
                onChangeText={setName}
                testID="family-input-name"
              />

              <Text style={styles.inputLabel}>Relationship</Text>
              <TextInput
                placeholder="e.g. Spouse, Child, Parent"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={relation}
                onChangeText={setRelation}
                testID="family-input-relation"
              />

              <Text style={styles.inputLabel}>Date of Birth (optional)</Text>
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={dob}
                onChangeText={setDob}
                testID="family-input-dob"
              />

              <PrimaryButton
                title={editing ? 'Save changes' : 'Add to family'}
                onPress={onSubmit}
                style={{ marginTop: spacing.lg }}
                variant="dark"
                disabled={!name.trim()}
                testID="family-save-btn"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Member docs view */}
      <Modal visible={!!viewing} animationType="slide" onRequestClose={() => setViewing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <View style={styles.top}>
            <IconButton variant="surface" onPress={() => setViewing(null)} testID="member-view-close">
              <ChevronLeft color={colors.textPrimary} size={22} />
            </IconButton>
            <Text style={styles.topTitle} numberOfLines={1}>{focused?.name || 'Member'}</Text>
            <IconButton variant="accent" onPress={() => focused && (openEdit(focused), setViewing(null))} testID="member-view-edit">
              <Pencil color={t.accent} size={14} />
            </IconButton>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 40 }}>
            {/* Member hero card */}
            <View style={[styles.heroCard, { backgroundColor: t.accentDark }]}>
              {focused?.avatar ? (
                <Image source={{ uri: focused.avatar }} style={styles.heroAv} />
              ) : (
                <View style={[styles.heroAv, { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 36, fontWeight: '800' }}>{focused?.name?.[0] || '?'}</Text>
                </View>
              )}
              <Text style={styles.heroName}>{focused?.name}</Text>
              <Text style={styles.heroSub}>{focused?.relation}{focused?.dob ? ` · Born ${focused.dob}` : ''}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNum}>{focusedDocs.length}</Text>
                  <Text style={styles.heroStatLabel}>Documents</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatNum}>{focusedDocs.filter(d => getDocStatus(d.expiryDate) === 'valid').length}</Text>
                  <Text style={styles.heroStatLabel}>Valid</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatNum, focusedDocs.filter(d => getDocStatus(d.expiryDate) === 'expired').length > 0 && { color: colors.expiringSoon }]}>
                    {focusedDocs.filter(d => getDocStatus(d.expiryDate) === 'expiring_soon' || getDocStatus(d.expiryDate) === 'expired').length}
                  </Text>
                  <Text style={styles.heroStatLabel}>Attention</Text>
                </View>
              </View>
            </View>

            <SectionHeader title="Documents" subtitle={`${focusedDocs.length} item${focusedDocs.length !== 1 ? 's' : ''}`} />

            {focusedDocs.length === 0 ? (
              <EmptyState
                icon={<FileText color={t.accent} size={28} />}
                title="No documents yet"
                subtitle={`Add documents for ${focused?.name}`}
                actionLabel="Add Document"
                onAction={() => { setViewing(null); router.push('/upload/type'); }}
                compact
              />
            ) : (
              <View style={{ gap: spacing.sm }}>
                {focusedDocs.map((d, idx) => (
                  <Animated.View key={d.id} entering={FadeInRight.delay(idx * 40).duration(200)}>
                    <PressableScale onPress={() => { setViewing(null); router.push(`/document/${d.id}`); }} testID={`member-doc-${d.id}`} haptic="light">
                      <View style={styles.docRow}>
                        <View style={[styles.docThumb, { backgroundColor: t.accentSurface }]}>
                          <Lock color={t.accent} size={16} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docName}>{d.name}</Text>
                          <Text style={styles.docSub}>{d.category} · Expires {fmtDate(d.expiryDate)}</Text>
                        </View>
                        <StatusBadge status={getDocStatus(d.expiryDate)} compact />
                      </View>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  topTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: colors.textPrimary, marginHorizontal: spacing.sm },
  
  // Stats row
  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxl, marginBottom: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, gap: 4 },
  statNum: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },

  // Member card
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.xs },
  avatarWrap: { position: 'relative' },
  av: { width: 56, height: 56, borderRadius: 28 },
  hierarchyBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface },
  selfTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  selfTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  fName: { ...typography.h3, color: colors.textPrimary },
  fSub: { ...typography.caption, color: colors.textSecondary },
  docCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  fDocs: { ...typography.caption, fontWeight: '600' },
  smBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  trash: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.expiredSurface, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalWrap: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, maxHeight: '90%' },
  editHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  bigAv: { width: 100, height: 100, borderRadius: 50 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg },
  photoHint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.sm },
  inputLabel: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.textPrimary },

  // Hero card in member view
  heroCard: { borderRadius: radius.hero, padding: spacing.xl, alignItems: 'center', ...shadow.hero },
  heroAv: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.md },
  heroName: { ...typography.h1, color: '#fff' },
  heroSub: { ...typography.bodySm, color: colors.textOnDarkMuted, marginTop: 4 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatNum: { ...typography.h2, color: '#fff' },
  heroStatLabel: { ...typography.caption, color: colors.textOnDarkSubtle, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },

  // Document row
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, ...shadow.xs },
  docThumb: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docName: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  docSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
