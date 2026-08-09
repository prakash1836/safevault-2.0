// Change Recovery Password — re-wrap the SAME DEK with a new KEK.
// The DEK itself never changes; existing encrypted documents remain readable.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { IconButton, PrimaryButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { Recovery } from '../../src/services/recovery';
import { RecoveryChangeWatcher } from '../../src/services/recoveryChangeWatcher';
import { RecoveryPassword, evaluatePasswordStrength, MIN_PASSWORD_LENGTH } from '../../src/services/recoveryPassword';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { hapt } from '../../src/utils/haptics';

export default function RecoveryChange() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => evaluatePasswordStrength(next), [next]);
  const match = next.length > 0 && next === confirm;
  const strong = next.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = current.length > 0 && strong && match && !busy && next !== current;

  const onSubmit = async () => {
    if (!user) { Alert.alert('Not signed in', 'Please sign in first.'); return; }
    hapt.light();
    setBusy(true);
    try {
      const r = await Recovery.changeRecoveryPassword({
        user,
        currentPassword: current,
        newPassword: next,
      });
      if (!r.ok) {
        hapt.error();
        if (r.reason === 'wrong-password') {
          Alert.alert('Incorrect current password', 'Your recovery envelope has not been changed.');
        } else if (r.reason === 'tampered') {
          Alert.alert('Recovery envelope tampered', 'The envelope in Drive failed integrity verification. Please restore from a trusted device first.');
        } else if (r.reason === 'no-envelope') {
          Alert.alert(
            'Recovery not configured',
            'There is no existing recovery envelope in Drive. Use "Set Up Recovery" instead.',
            [{ text: 'Set Up Recovery', onPress: () => router.replace('/recovery/setup') }, { text: 'Cancel', style: 'cancel' }],
          );
        } else {
          Alert.alert('No vault key on this device', 'This device has never held the vault key. Restore first, then change the password.');
        }
        return;
      }
      // Update the on-device password hash too (Sprint 3 mechanism)
      try { await RecoveryPassword.change(current, next); } catch { await RecoveryPassword.set(next); }
      // Re-anchor the change-watcher baseline now that revision has bumped.
      try {
        const meta = await Recovery.fetchEnvelopeMetadata(user);
        if (meta) {
          await RecoveryChangeWatcher.acknowledgeRevision({
            vaultId: meta.vaultId,
            revision: meta.revision,
            updatedAt: meta.updatedAt,
          });
        }
      } catch {}
      hapt.success();
      Alert.alert(
        'Recovery Password changed',
        'Your key envelope has been re-wrapped with the new password. Other devices will need the new password to restore this vault.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (e: any) {
      hapt.error();
      Alert.alert('Change failed', e?.message || 'Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="recovery-change-screen">
      <View style={styles.top}>
        <IconButton variant="surface" onPress={() => router.back()} testID="recovery-change-back">
          <ChevronLeft color={colors.textPrimary} size={22} />
        </IconButton>
        <Text style={styles.topTitle}>Change Recovery Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(220)}>
          <View style={[styles.hero, { backgroundColor: t.accentSurface }]}>
            <KeyRound color={t.accent} size={22} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: t.accent }]}>The vault key stays the same</Text>
              <Text style={[styles.heroSub, { color: t.accent }]}>
                Only the wrapping password changes. Existing encrypted documents remain readable on this device and on any other device that already restored the vault.
              </Text>
            </View>
          </View>
        </Animated.View>

        <Label>Current Recovery Password</Label>
        <Input value={current} onChangeText={setCurrent} secureTextEntry={!show} testID="recovery-change-current" accent={t.accent} onToggle={() => setShow((v) => !v)} show={show} placeholder="Current password" />

        <Label>New Recovery Password</Label>
        <Input value={next} onChangeText={setNext} secureTextEntry={!show} testID="recovery-change-new" accent={t.accent} onToggle={() => setShow((v) => !v)} show={show} placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`} />
        {next.length > 0 && (
          <View style={styles.strengthRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.strengthBar, { backgroundColor: i < strength.score ? (strength.score >= 3 ? t.accent : strength.score === 2 ? colors.expiringSoon : colors.expired) : colors.border }]} />
            ))}
            <Text style={[styles.strengthLabel, { color: strength.score >= 3 ? t.accent : colors.textSecondary }]}>{strength.label}</Text>
          </View>
        )}

        <Label>Confirm new password</Label>
        <Input value={confirm} onChangeText={setConfirm} secureTextEntry={!show} testID="recovery-change-confirm" accent={t.accent} onToggle={() => setShow((v) => !v)} show={show} placeholder="Type it again" />
        {confirm.length > 0 && !match && <Text style={[styles.help, { color: colors.expired }]}>Passwords do not match</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Change Password" onPress={onSubmit} loading={busy} disabled={!canSubmit} variant="dark" testID="recovery-change-submit" icon={<Check color="#fff" size={16} />} />
      </View>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) { return <Text style={styles.label}>{children}</Text>; }

function Input({ value, onChangeText, secureTextEntry, testID, accent, onToggle, show, placeholder }: any) {
  return (
    <View style={[styles.inputWrap, { borderColor: value ? accent : colors.border }]}>
      <Lock color={accent} size={16} />
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textTertiary} style={styles.input} secureTextEntry={secureTextEntry} autoCapitalize="none" autoCorrect={false} testID={testID} />
      <PressableScale onPress={onToggle} haptic="none">
        {show ? <EyeOff color={colors.textTertiary} size={18} /> : <Eye color={colors.textTertiary} size={18} />}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.xxl },
  hero: { flexDirection: 'row', gap: 10, padding: spacing.md, borderRadius: radius.lg },
  heroTitle: { ...typography.h3, fontWeight: '800' },
  heroSub: { ...typography.bodySm, marginTop: 4, lineHeight: 19 },
  label: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  input: { flex: 1, ...typography.body, color: colors.textPrimary },
  help: { ...typography.caption, color: colors.textTertiary, marginTop: 6, lineHeight: 17 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { marginLeft: 6, ...typography.caption, fontWeight: '800' },
  footer: { padding: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
