// Recovery Setup screen — turns the on-device DEK into a Drive-recoverable envelope.
// Reused for BOTH the "existing user" migration AND the "first-time set-up" case.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Lock, Eye, EyeOff, ShieldCheck, KeyRound, Info, Cloud, Check } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { IconButton, PrimaryButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { InfoSheet, SheetParagraph, SheetHeading } from '../../src/components/InfoSheet';
import { Recovery } from '../../src/services/recovery';
import { RecoveryPassword, evaluatePasswordStrength, MIN_PASSWORD_LENGTH } from '../../src/services/recoveryPassword';
import { colors, radius, spacing, shadow, typography } from '../../src/constants/theme';
import { hapt } from '../../src/utils/haptics';

export default function RecoverySetup() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { drive: driveConnected } = usePermissions();

  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ack, setAck] = useState(false);
  const [show, setShow] = useState(false);
  const [learn, setLearn] = useState(false);
  const [hasLegacy, setHasLegacy] = useState(false);

  useEffect(() => {
    (async () => {
      const has = await RecoveryPassword.has();
      setHasLegacy(has);
    })();
  }, []);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const match = password.length > 0 && password === confirm;
  const strong = password.length >= MIN_PASSWORD_LENGTH;
  const canContinue = strong && match && ack && !busy;

  const onSave = async () => {
    if (!user) { Alert.alert('Not signed in', 'Please sign in first.'); return; }
    if (!driveConnected) {
      Alert.alert(
        'Google Drive not connected',
        'Recovery requires Google Drive so the encrypted key envelope can be stored in your account. Please connect Drive from Settings and try again.',
      );
      return;
    }
    hapt.light();
    setBusy(true);
    try {
      // Store the recovery password hash locally too (Sprint 3 mechanism) so
      // future "verify current password" flows can operate offline.
      await RecoveryPassword.set(password);
      const r = await Recovery.setupRecovery({ user, password });
      hapt.success();
      Alert.alert(
        r.alreadySetUp ? 'Recovery already configured' : 'Recovery configured',
        r.alreadySetUp
          ? 'Your Google Drive already holds a recovery envelope for this vault. Your password is verified.'
          : 'An encrypted key envelope has been placed inside your Google Drive. You can now restore this vault on a new device using the same Google account + recovery password.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (e: any) {
      hapt.error();
      if (e?.code === 'RecoveryEnvelopeConflictError') {
        Alert.alert(
          'Different recovery already exists',
          'Google Drive already contains a recovery envelope wrapping a different key or password. Use "Change Recovery Password" to re-wrap.',
        );
      } else {
        Alert.alert('Could not set up recovery', e?.message || 'Please try again.');
      }
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="recovery-setup-screen">
      <View style={styles.top}>
        <IconButton variant="surface" onPress={() => router.back()} testID="recovery-setup-back">
          <ChevronLeft color={colors.textPrimary} size={22} />
        </IconButton>
        <Text style={styles.topTitle}>Set Up Recovery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(220)}>
          <View style={[styles.hero, { backgroundColor: t.accentSurface }]}>
            <KeyRound color={t.accent} size={22} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: t.accent }]}>Recovery Password wraps your vault key</Text>
              <Text style={[styles.heroSub, { color: t.accent }]}>
                The wrapped key lands in your Google Drive. Only your Recovery Password can unwrap it. SafeVault never sees the password.
              </Text>
            </View>
          </View>
        </Animated.View>

        <Text style={styles.body}>
          Choose a strong password. If forgotten, SafeVault{' '}
          <Text style={styles.b}>cannot recover it for you</Text> — this is by design and is what keeps your vault safe.
        </Text>

        <Label>Recovery Password</Label>
        <View style={[styles.inputWrap, { borderColor: password ? t.accent : colors.border }]}>
          <Lock color={t.accent} size={16} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            testID="recovery-setup-password"
          />
          <PressableScale onPress={() => setShow((v) => !v)} haptic="none" testID="recovery-setup-toggle-show">
            {show ? <EyeOff color={colors.textTertiary} size={18} /> : <Eye color={colors.textTertiary} size={18} />}
          </PressableScale>
        </View>
        {password.length > 0 && (
          <View style={styles.strengthRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.strengthBar, {
                  backgroundColor: i < strength.score
                    ? strength.score >= 3 ? t.accent : strength.score === 2 ? colors.expiringSoon : colors.expired
                    : colors.border,
                }]}
              />
            ))}
            <Text style={[styles.strengthLabel, { color: strength.score >= 3 ? t.accent : colors.textSecondary }]}>{strength.label}</Text>
          </View>
        )}

        <Label>Confirm password</Label>
        <View style={[styles.inputWrap, { borderColor: match ? t.accent : confirm ? colors.expired : colors.border }]}>
          <Lock color={t.accent} size={16} />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            testID="recovery-setup-confirm"
          />
        </View>
        {confirm.length > 0 && !match && (
          <Text style={[styles.help, { color: colors.expired }]}>Passwords do not match</Text>
        )}

        <PressableScale onPress={() => { hapt.selection(); setAck((v) => !v); }} testID="recovery-setup-ack" haptic="none">
          <View style={styles.ackRow}>
            <View style={[styles.ackBox, ack && { backgroundColor: t.accent, borderColor: t.accent }]}>
              {ack && <Check color="#fff" size={14} strokeWidth={3} />}
            </View>
            <Text style={styles.ackText}>
              I understand that SafeVault cannot recover this password. If lost, my encrypted documents cannot be decrypted from Google Drive.
            </Text>
          </View>
        </PressableScale>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <PressableScale onPress={() => setLearn(true)} haptic="light" testID="recovery-setup-learn-more">
            <View style={[styles.learnRow, { borderColor: t.accent }]}>
              <Info color={t.accent} size={16} />
              <Text style={[styles.learnTxt, { color: t.accent }]}>What exactly gets stored in Drive?</Text>
            </View>
          </PressableScale>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="Save & Upload Envelope"
          onPress={onSave}
          loading={busy}
          disabled={!canContinue}
          variant="dark"
          testID="recovery-setup-save-btn"
          icon={<Cloud color="#fff" size={16} />}
        />
      </View>

      <InfoSheet
        visible={learn}
        title="What is stored in your Drive"
        onClose={() => setLearn(false)}
      >
        <SheetHeading>The envelope</SheetHeading>
        <SheetParagraph>
          A small file at <Text style={styles.mono}>SafeVault/manifest/recovery.json</Text> containing: KDF parameters (salt, iteration count), an AES-256-CBC ciphertext of your vault key wrapped by a key derived from your password, and a public verifier tag used to detect wrong passwords without decrypting.
        </SheetParagraph>
        <SheetHeading>What is NOT stored</SheetHeading>
        <SheetParagraph>
          Your Recovery Password itself is never uploaded, never logged, and never sent anywhere. Neither is the plain vault key. SafeVault has no servers; nothing about your password ever leaves your device.
        </SheetParagraph>
        <SheetHeading>Wrong-password safety</SheetHeading>
        <SheetParagraph>
          If someone tries the wrong password on a new device, the check fails on the verifier before any decryption is attempted. Your vault is not modified in any way.
        </SheetParagraph>
      </InfoSheet>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.xxl },

  hero: { flexDirection: 'row', gap: 10, padding: spacing.md, borderRadius: radius.lg },
  heroTitle: { ...typography.h3, fontWeight: '800' },
  heroSub: { ...typography.bodySm, marginTop: 4, lineHeight: 19 },

  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginTop: spacing.lg },
  b: { fontWeight: '800', color: colors.textPrimary },

  label: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  input: { flex: 1, ...typography.body, color: colors.textPrimary },
  help: { ...typography.caption, color: colors.textTertiary, marginTop: 6, lineHeight: 17 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { marginLeft: 6, ...typography.caption, fontWeight: '800' },

  ackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ackBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ackText: { flex: 1, ...typography.bodySm, color: colors.textPrimary, lineHeight: 20 },

  learnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, justifyContent: 'center' },
  learnTxt: { ...typography.bodySm, fontWeight: '700' },

  footer: { padding: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  mono: { fontFamily: 'monospace' as any, backgroundColor: colors.elevated, paddingHorizontal: 4, borderRadius: 3 },
});
