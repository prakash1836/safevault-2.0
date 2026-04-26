import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useVault } from '../src/contexts/VaultContext';
import { Card, PrimaryButton } from '../src/components/UI';
import { colors, radius, spacing } from '../src/constants/theme';

export default function FamilyScreen() {
  const { family, addFamily, removeFamily, docs } = useVault();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [dob, setDob] = useState('');

  const onAdd = async () => {
    if (!name.trim()) return;
    await addFamily({ name: name.trim(), relation: relation.trim() || 'Family', dob: dob.trim() || undefined });
    setName(''); setRelation(''); setDob(''); setOpen(false);
  };

  const onRemove = (id: string) => {
    if (id === 'me') return;
    Alert.alert('Remove member?', 'Their documents will remain in your vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFamily(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="family-back-btn"><ChevronLeft color={colors.textPrimary} size={22} /></TouchableOpacity>
        <Text style={styles.topTitle}>Family</Text>
        <TouchableOpacity style={styles.addSm} onPress={() => setOpen(true)} testID="family-add-btn"><Plus color={colors.primary} size={18} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 40, gap: spacing.md }}>
        {family.map((f) => {
          const count = docs.filter((d) => d.ownerId === f.id).length;
          return (
            <Card key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} testID={`family-row-${f.id}`}>
              {f.avatar ? (
                <Image source={{ uri: f.avatar }} style={styles.av} />
              ) : (
                <View style={[styles.av, { backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>{f.name[0]}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.fName}>{f.name}</Text>
                <Text style={styles.fSub}>{f.relation}{f.dob ? ` · DOB ${f.dob}` : ''}</Text>
                <Text style={styles.fDocs}>{count} documents</Text>
              </View>
              {f.id !== 'me' && (
                <TouchableOpacity onPress={() => onRemove(f.id)} style={styles.trash} testID={`family-remove-${f.id}`}>
                  <Trash2 color={colors.overdue} size={16} />
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
      </ScrollView>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Family Member</Text>
            <TextInput placeholder="Name" placeholderTextColor={colors.textTertiary} style={styles.input} value={name} onChangeText={setName} testID="family-input-name" />
            <TextInput placeholder="Relation (e.g. Spouse, Child)" placeholderTextColor={colors.textTertiary} style={styles.input} value={relation} onChangeText={setRelation} testID="family-input-relation" />
            <TextInput placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor={colors.textTertiary} style={styles.input} value={dob} onChangeText={setDob} testID="family-input-dob" />
            <PrimaryButton title="Add" onPress={onAdd} style={{ marginTop: spacing.md }} testID="family-save-btn" />
            <TouchableOpacity onPress={() => setOpen(false)} style={{ marginTop: 12 }}><Text style={{ textAlign: 'center', color: colors.textSecondary }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  addSm: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  av: { width: 56, height: 56, borderRadius: 28 },
  fName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  fSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  fDocs: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  trash: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDF4F1', alignItems: 'center', justifyContent: 'center' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(28,63,58,0.35)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xxl, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.sm },
});
