import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stepper } from '../../src/components/Stepper';
import { useUpload } from '../../src/contexts/UploadContext';
import { useVault } from '../../src/contexts/VaultContext';
import { PrimaryButton } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';
import { fmtDate } from '../../src/utils/date';

export default function DetailsStep() {
  const { draft, setDraft } = useUpload();
  const { family } = useVault();
  const router = useRouter();
  const [pickWhich, setPickWhich] = useState<null | 'issue' | 'expiry'>(null);

  const setDate = (_: any, d?: Date) => {
    if (d && pickWhich) {
      const iso = d.toISOString();
      if (pickWhich === 'issue') setDraft({ issueDate: iso });
      else setDraft({ expiryDate: iso });
    }
    if (Platform.OS !== 'ios') setPickWhich(null);
  };

  const canContinue = draft.name.trim().length > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Add to Vault" />
      <Stepper step={2} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Document details</Text>

        <Label text="Name" />
        <TextInput
          value={draft.name}
          onChangeText={(t) => setDraft({ name: t })}
          placeholder="e.g. Passport"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          testID="upload-name-input"
        />

        <Label text="Owner" />
        <View style={styles.owners}>
          {family.map((f) => (
            <TouchableOpacity key={f.id} onPress={() => setDraft({ ownerId: f.id })} style={[styles.ownerPill, draft.ownerId === f.id && styles.ownerPillActive]} testID={`upload-owner-${f.id}`}>
              <Text style={[styles.ownerText, draft.ownerId === f.id && { color: '#fff' }]}>{f.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Label text="Issued on" />
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('issue')} testID="pick-issue-date">
              <Calendar color={colors.primary} size={16} />
              <Text style={styles.dateText}>{fmtDate(draft.issueDate || undefined)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Expires on" />
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('expiry')} testID="pick-expiry-date">
              <Calendar color={colors.primary} size={16} />
              <Text style={styles.dateText}>{fmtDate(draft.expiryDate || undefined)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Label text="Notes" />
        <TextInput
          value={draft.notes}
          onChangeText={(t) => setDraft({ notes: t })}
          placeholder="Optional"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { height: 84, textAlignVertical: 'top' }]}
          multiline
          testID="upload-notes-input"
        />

        <Label text="Reminders" />
        <View style={{ gap: 8 }}>
          {(['days30', 'days7', 'days1'] as const).map((k) => (
            <TouchableOpacity
              key={k}
              style={[styles.rem, draft.reminder[k] && styles.remActive]}
              onPress={() => setDraft({ reminder: { ...draft.reminder, [k]: !draft.reminder[k] } })}
              testID={`reminder-${k}`}
            >
              <View style={[styles.checkbox, draft.reminder[k] && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {draft.reminder[k] && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
              </View>
              <Text style={styles.remText}>{k === 'days30' ? '30 days before' : k === 'days7' ? '7 days before' : '1 day before'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {pickWhich && (
        <DateTimePicker
          value={new Date((pickWhich === 'issue' ? draft.issueDate : draft.expiryDate) || Date.now())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={setDate}
        />
      )}
      <View style={styles.footer}>
        <PrimaryButton title="Continue" disabled={!canContinue} onPress={() => router.push('/upload/review')} testID="details-continue-btn" />
      </View>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  h1: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.lg },
  label: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  owners: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  ownerPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ownerPillActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  ownerText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14 },
  dateText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  rem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  remActive: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  remText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
