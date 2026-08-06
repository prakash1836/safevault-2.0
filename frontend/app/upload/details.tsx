import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, Check } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { useUpload } from '../../src/contexts/UploadContext';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { PrimaryButton, Chip } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { colors, radius, spacing, typography, shadow } from '../../src/constants/theme';
import { fmtDate } from '../../src/utils/date';
import { hapt } from '../../src/utils/haptics';

export default function DetailsStep() {
  const { draft, setDraft } = useUpload();
  const { family } = useVault();
  const t = useTheme();
  const router = useRouter();
  const [pickWhich, setPickWhich] = useState<null | 'issue' | 'expiry'>(null);

  const setDate = (_: any, d?: Date) => {
    if (d && pickWhich) {
      hapt.light();
      const iso = d.toISOString();
      if (pickWhich === 'issue') setDraft({ issueDate: iso });
      else setDraft({ expiryDate: iso });
    }
    if (Platform.OS !== 'ios') setPickWhich(null);
  };

  const canContinue = draft.name.trim().length > 0;

  const toggleReminder = (k: 'days30' | 'days7' | 'days1') => {
    hapt.selection();
    setDraft({ reminder: { ...draft.reminder, [k]: !draft.reminder[k] } });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Add to Vault" />
      <Stepper step={3} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(200)}>
          <Text style={styles.h1}>Document details</Text>
          <Text style={styles.h2}>Add metadata to help organize and remind</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(50).duration(200)}>
          <Label text="Document name" required />
          <TextInput
            value={draft.name}
            onChangeText={(t) => setDraft({ name: t })}
            placeholder="e.g. Passport, Insurance Policy"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            testID="upload-name-input"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(200)}>
          <Label text="Owner" />
          <View style={styles.owners}>
            {family.map((f) => (
              <Chip
                key={f.id}
                label={f.name}
                active={draft.ownerId === f.id}
                onPress={() => { hapt.selection(); setDraft({ ownerId: f.id }); }}
                testID={`upload-owner-${f.id}`}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(200)} style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Label text="Issued on" />
            <PressableScale onPress={() => setPickWhich('issue')} testID="pick-issue-date" haptic="light">
              <View style={[styles.dateBtn, { borderColor: t.accent + '30' }]}>
                <Calendar color={t.accent} size={16} />
                <Text style={styles.dateText}>{fmtDate(draft.issueDate || undefined)}</Text>
              </View>
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <Label text="Expires on" />
            <PressableScale onPress={() => setPickWhich('expiry')} testID="pick-expiry-date" haptic="light">
              <View style={[styles.dateBtn, draft.expiryDate && { borderColor: t.accent, backgroundColor: t.accentSurface }]}>
                <Calendar color={t.accent} size={16} />
                <Text style={[styles.dateText, draft.expiryDate && { color: t.accent, fontWeight: '700' }]}>{fmtDate(draft.expiryDate || undefined)}</Text>
              </View>
            </PressableScale>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(200)}>
          <Label text="Notes" />
          <TextInput
            value={draft.notes}
            onChangeText={(t) => setDraft({ notes: t })}
            placeholder="Add any additional details..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.textArea]}
            multiline
            testID="upload-notes-input"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(200)}>
          <Label text="Expiry reminders" />
          <View style={{ gap: spacing.sm }}>
            {([
              { key: 'days30', label: '30 days before', desc: 'Plenty of time to renew' },
              { key: 'days7', label: '7 days before', desc: 'Time to take action' },
              { key: 'days1', label: '1 day before', desc: 'Final reminder' },
            ] as const).map((item) => (
              <PressableScale key={item.key} onPress={() => toggleReminder(item.key)} testID={`reminder-${item.key}`} haptic="none">
                <View style={[styles.rem, draft.reminder[item.key] && { borderColor: t.accent, backgroundColor: t.accentSurface }]}>
                  <View style={[styles.checkbox, draft.reminder[item.key] && { backgroundColor: t.accent, borderColor: t.accent }]}>
                    {draft.reminder[item.key] && <Check color="#fff" size={14} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.remText, draft.reminder[item.key] && { color: t.accent }]}>{item.label}</Text>
                    <Text style={styles.remDesc}>{item.desc}</Text>
                  </View>
                </View>
              </PressableScale>
            ))}
          </View>
        </Animated.View>
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
        <PrimaryButton title="Continue" disabled={!canContinue} onPress={() => { hapt.light(); router.push('/upload/review'); }} testID="details-continue-btn" variant="dark" />
      </View>
    </SafeAreaView>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{text}</Text>
      {required && <Text style={styles.requiredStar}>*</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  h1: { ...typography.h1, color: colors.textPrimary, marginBottom: 4 },
  h2: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.xl },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: 8 },
  label: { ...typography.overline, color: colors.textSecondary },
  requiredStar: { color: colors.expired, marginLeft: 4, fontSize: 14, fontWeight: '700' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, ...typography.body, color: colors.textPrimary },
  textArea: { height: 88, textAlignVertical: 'top', paddingTop: spacing.md },
  owners: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  dateText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' },
  rem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  remText: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  remDesc: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
