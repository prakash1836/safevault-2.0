// Recovery Restore screen — the NEW-DEVICE flow.
//
// Flow:
//   1. Look for `SafeVault/manifest/recovery.json` on the signed-in Google Drive.
//   2. If found: prompt for the Recovery Password.
//   3. Verify verifier hash BEFORE any AES call. Wrong -> friendly error.
//   4. Right -> unwrap DEK -> write to SecureStore.
//   5. Now the app's existing MetadataManager.load path will succeed and the
//      vault contents will populate on the next tab open.
//
// This screen never overwrites Drive; it only reads.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { ChevronLeft, Lock, Eye, EyeOff, Cloud, ShieldCheck, KeyRound, CheckCircle2, AlertTriangle, Info, RefreshCw, Timer } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { IconButton, PrimaryButton, ProgressBar } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { InfoSheet, SheetParagraph, SheetHeading } from '../../src/components/InfoSheet';
import { Recovery, type RecoveryEnvelope } from '../../src/services/recovery';
import { RecoveryRateLimit, type LockoutStatus } from '../../src/services/recoveryRateLimit';
import { RecoveryChangeWatcher } from '../../src/services/recoveryChangeWatcher';
import { MetadataManager } from '../../src/services/metadataManager';
import { getDeviceId, getAppVersion } from '../../src/services/device';
import { colors, radius, spacing, typography, shadow } from '../../src/constants/theme';
import { hapt } from '../../src/utils/haptics';

type Phase =
  | { kind: 'connecting' }
  | { kind: 'searching' }
  | { kind: 'not-found' }
  | { kind: 'no-drive' }
  | { kind: 'corrupted' }
  | { kind: 'locked'; status: LockoutStatus; envelope: RecoveryEnvelope }
  | { kind: 'found'; envelope: RecoveryEnvelope }
  | { kind: 'unlocking' }
  | { kind: 'restoring'; label: string; progress: number; docCount: number }
  | { kind: 'restored'; docCount: number };

export default function RecoveryRestore() {
  const t = useTheme();
  const router = useRouter();
  const { user, loginGoogle, hasGoogleConfig } = useAuth();
  const { drive: driveConnected, setDriveConnected } = usePermissions();

  const [phase, setPhase] = useState<Phase>({ kind: 'connecting' });
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [learn, setLearn] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!driveConnected) {
      setPhase({ kind: 'connecting' });
      return;
    }
    void discover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, driveConnected]);

  const discover = async () => {
    if (!user) return;
    setPhase({ kind: 'searching' });
    try {
      const fetched = await Recovery.fetchEnvelope(user);
      if (!fetched) { setPhase({ kind: 'not-found' }); return; }
      // Check for a live lockout on this vault BEFORE letting the user try.
      const status = await RecoveryRateLimit.getStatus(fetched.envelope.vaultId);
      if (status.locked) {
        setPhase({ kind: 'locked', status, envelope: fetched.envelope });
        return;
      }
      setPhase({ kind: 'found', envelope: fetched.envelope });
    } catch (e: any) {
      if (e?.code === 'RecoveryEnvelopeCorruptedError') {
        setPhase({ kind: 'corrupted' });
      } else {
        setPhase({ kind: 'no-drive' });
      }
    }
  };

  const onConnectGoogle = async () => {
    hapt.light();
    setBusy(true);
    try {
      const r = await loginGoogle();
      if (r.ok) { setDriveConnected(true); hapt.success(); }
    } catch (e: any) {
      hapt.error();
      Alert.alert('Could not connect to Google', e?.message || 'Try again.');
    } finally { setBusy(false); }
  };

  const onUnlock = async () => {
    if (!user || phase.kind !== 'found') return;
    if (!password.trim()) return;
    hapt.light();
    const envelope = phase.envelope;

    // Pre-check: still locked? (Guards against manual clock manipulation
    // between screen mount and submit.)
    const preStatus = await RecoveryRateLimit.getStatus(envelope.vaultId);
    if (preStatus.locked) {
      setPhase({ kind: 'locked', status: preStatus, envelope });
      return;
    }

    setPhase({ kind: 'unlocking' });
    try {
      const r = await Recovery.restoreVault({ user, password, commit: true });
      if (!r.ok) {
        hapt.error();
        setWrongCount((c) => c + 1);
        if (r.reason === 'wrong-password') {
          const status = await RecoveryRateLimit.recordFailure(envelope.vaultId);
          if (status.locked) {
            setPhase({ kind: 'locked', status, envelope });
          } else {
            setPhase({ kind: 'found', envelope });
            Alert.alert(
              'Incorrect Recovery Password',
              `Your vault has not been changed. You have ${3 - status.attempts} attempt(s) remaining before a lockout begins.`,
            );
          }
        } else if (r.reason === 'tampered') {
          setPhase({ kind: 'corrupted' });
          Alert.alert(
            'Recovery envelope tampered',
            'The recovery envelope failed integrity verification (MAC mismatch). Your vault has not been changed. Please re-upload the envelope from a trusted device.',
          );
        } else if (r.reason === 'rollback') {
          setPhase({ kind: 'corrupted' });
          Alert.alert(
            'Recovery envelope is older than expected',
            'This device previously accepted a newer recovery envelope. Someone may have rolled it back. Your vault has not been changed.',
          );
        } else if (r.reason === 'corrupted' || r.reason === 'malformed') {
          setPhase({ kind: 'corrupted' });
        } else {
          setPhase({ kind: 'not-found' });
        }
        return;
      }

      // Success → clear the counter, then run the restore-progress phase.
      await RecoveryRateLimit.recordSuccess(envelope.vaultId);

      setPhase({ kind: 'restoring', label: 'Loading your vault index…', progress: 0.15, docCount: 0 });
      const deviceId = await getDeviceId();
      const appVersion = getAppVersion();

      let docCount = 0;
      try {
        setPhase({ kind: 'restoring', label: 'Downloading manifest…', progress: 0.35, docCount });
        const loaded = await MetadataManager.load(user, deviceId, appVersion);
        docCount = loaded.manifest.documents.filter((d: any) => !d.deleted).length;
        setPhase({
          kind: 'restoring',
          label: loaded.isEmpty
            ? 'Vault is empty — nothing to restore.'
            : loaded.recovered
              ? `Recovered from backup manifest · ${docCount} documents`
              : `Loaded ${docCount} documents from Drive`,
          progress: 0.85,
          docCount,
        });
        // Acknowledge the envelope revision — this is the anchor point for
        // the cross-device change watcher.
        await RecoveryChangeWatcher.acknowledgeRevision({
          vaultId: envelope.vaultId,
          revision: envelope.revision,
          updatedAt: envelope.updatedAt,
        });
      } catch (mfErr: any) {
        // Manifest failure is not fatal — the DEK is in place; documents will
        // populate on the next sync attempt. Surface a soft warning.
        // eslint-disable-next-line no-console
        console.warn('[recovery] manifest load failed:', mfErr?.message);
      }

      // Small settle so the "loaded X documents" line is readable.
      await new Promise((r2) => setTimeout(r2, 400));
      hapt.success();
      setPhase({ kind: 'restored', docCount });
    } catch (e: any) {
      hapt.error();
      Alert.alert('Recovery failed', e?.message || 'Please try again.');
      setPhase({ kind: 'found', envelope });
    }
  };

  const goHome = () => { hapt.light(); router.replace('/(tabs)/home'); };

  /* ---------------- render ---------------- */

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="recovery-restore-screen">
      <View style={styles.top}>
        <IconButton variant="surface" onPress={() => router.back()} testID="recovery-restore-back">
          <ChevronLeft color={colors.textPrimary} size={22} />
        </IconButton>
        <Text style={styles.topTitle}>Restore Vault</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Step 1 — connect Drive */}
        {phase.kind === 'connecting' && (
          <Animated.View entering={FadeIn.duration(220)}>
            <Hero
              accent={t.accent}
              accentSurface={t.accentSurface}
              icon={<Cloud color={t.accent} size={26} />}
              title="Connect your Google account"
              body="Sign in with the same Google account that stored your SafeVault backup."
            />
            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton
                title={hasGoogleConfig ? 'Connect Google Drive' : 'Google Sign-In not configured'}
                onPress={onConnectGoogle}
                loading={busy}
                disabled={!hasGoogleConfig}
                variant="dark"
                testID="recovery-connect-drive-btn"
                icon={<Cloud color="#fff" size={16} />}
              />
            </View>
          </Animated.View>
        )}

        {/* Step 2 — searching */}
        {phase.kind === 'searching' && (
          <Animated.View entering={FadeIn.duration(220)} style={styles.centerBig}>
            <ActivityIndicator size="large" color={t.accent} />
            <Text style={styles.centerBigTxt}>Looking for your vault on Google Drive…</Text>
          </Animated.View>
        )}

        {/* No envelope found */}
        {phase.kind === 'not-found' && (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Hero
              accent={colors.expired}
              accentSurface={colors.expiredSurface}
              icon={<AlertTriangle color={colors.expired} size={26} />}
              title="No vault backup found"
              body={
                "We couldn't find a SafeVault recovery envelope in this Google account. Either this account never had SafeVault, or Recovery was never configured on the original device."
              }
            />
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <PrimaryButton title="Try again" onPress={discover} variant="secondary" testID="recovery-retry-search" icon={<RefreshCw color={t.accent} size={16} />} />
              <PressableScale onPress={() => router.replace('/onboarding')} haptic="light" testID="recovery-start-fresh">
                <Text style={styles.link}>Start with a new vault instead</Text>
              </PressableScale>
            </View>
          </Animated.View>
        )}

        {phase.kind === 'no-drive' && (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Hero
              accent={colors.expired}
              accentSurface={colors.expiredSurface}
              icon={<AlertTriangle color={colors.expired} size={26} />}
              title="Drive unreachable"
              body="We couldn't reach Google Drive. Check your connection and try again — nothing was changed."
            />
            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton title="Retry" onPress={discover} variant="secondary" testID="recovery-retry-drive" icon={<RefreshCw color={t.accent} size={16} />} />
            </View>
          </Animated.View>
        )}

        {phase.kind === 'corrupted' && (
          <Animated.View entering={FadeInDown.duration(220)}>
            <Hero
              accent={colors.expired}
              accentSurface={colors.expiredSurface}
              icon={<AlertTriangle color={colors.expired} size={26} />}
              title="Recovery envelope is corrupted"
              body="Both the primary and backup envelopes failed to parse. Your original device (if still working) can re-upload a fresh envelope from Settings → Storage & Security → Change Recovery Password."
            />
          </Animated.View>
        )}

        {/* Envelope found — password entry */}
        {(phase.kind === 'found' || phase.kind === 'unlocking') && (
          <Animated.View entering={FadeIn.duration(220)}>
            <Hero
              accent={t.accent}
              accentSurface={t.accentSurface}
              icon={<CheckCircle2 color={t.accent} size={26} />}
              title="Vault found"
              body={`Envelope revision ${phase.kind === 'found' ? phase.envelope.revision : ''} · updated ${
                phase.kind === 'found' ? new Date(phase.envelope.updatedAt).toLocaleString() : ''
              }`}
            />

            <Text style={styles.body}>
              Enter the Recovery Password you set on your original device. SafeVault verifies it locally before any decryption.
            </Text>

            <Label>Recovery Password</Label>
            <View style={[styles.inputWrap, { borderColor: password ? t.accent : colors.border }]}>
              <Lock color={t.accent} size={16} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Your recovery password"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                testID="recovery-restore-password"
                editable={phase.kind !== 'unlocking'}
              />
              <PressableScale onPress={() => setShow((v) => !v)} haptic="none">
                {show ? <EyeOff color={colors.textTertiary} size={18} /> : <Eye color={colors.textTertiary} size={18} />}
              </PressableScale>
            </View>

            {wrongCount > 0 && phase.kind === 'found' && (
              <Text style={[styles.help, { color: colors.expired }]}>
                Incorrect Recovery Password. Your vault has not been changed. Attempts: {wrongCount}
              </Text>
            )}

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton
                title="Unlock and Restore"
                onPress={onUnlock}
                loading={phase.kind === 'unlocking'}
                disabled={!password.trim() || phase.kind === 'unlocking'}
                variant="dark"
                testID="recovery-unlock-btn"
                icon={<KeyRound color="#fff" size={16} />}
              />
            </View>

            <PressableScale onPress={() => setLearn(true)} haptic="light" testID="recovery-restore-learn">
              <View style={[styles.learnRow, { borderColor: t.accent }]}>
                <Info color={t.accent} size={16} />
                <Text style={[styles.learnTxt, { color: t.accent }]}>How does this work safely?</Text>
              </View>
            </PressableScale>
          </Animated.View>
        )}

        {/* Restoring — progress after unlock */}
        {phase.kind === 'restoring' && (
          <Animated.View entering={FadeIn.duration(220)} style={styles.centerBig} testID="recovery-restoring">
            <View style={[styles.doneIconWrap, { backgroundColor: t.accent }]}>
              <ActivityIndicator color="#fff" />
            </View>
            <Text style={[styles.doneTitle, { color: t.accent, textAlign: 'center' }]}>Restoring your vault…</Text>
            <Text style={styles.doneBody} testID="recovery-restoring-label">{phase.label}</Text>
            <View style={{ width: '100%', maxWidth: 300, marginTop: spacing.md }}>
              <ProgressBar value={phase.progress} height={6} color={t.accent} />
            </View>
            {phase.docCount > 0 && (
              <Text style={[styles.doneBody, { marginTop: 4 }]} testID="recovery-restoring-count">
                {phase.docCount} document{phase.docCount === 1 ? '' : 's'}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Locked — after too many wrong-password attempts */}
        {phase.kind === 'locked' && (
          <Animated.View entering={FadeInDown.duration(220)} testID="recovery-locked">
            <Hero
              accent={colors.expired}
              accentSurface={colors.expiredSurface}
              icon={<AlertTriangle color={colors.expired} size={26} />}
              title="Too many failed attempts"
              body="For safety, try again after the cooldown below. Your vault is not modified — this lockout is device-local."
            />
            <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
              <LockoutCountdown
                status={phase.status}
                onExpired={() => setPhase({ kind: 'found', envelope: phase.envelope })}
              />
            </View>
          </Animated.View>
        )}

        {/* Restored */}
        {phase.kind === 'restored' && (
          <Animated.View entering={FadeIn.duration(300)} testID="recovery-restored">
            <View style={[styles.done, { backgroundColor: t.accentSurface }]}>
              <View style={[styles.doneIconWrap, { backgroundColor: t.accent }]}>
                <CheckCircle2 color="#fff" size={30} strokeWidth={1.8} />
              </View>
              <Text style={[styles.doneTitle, { color: t.accent }]}>Vault Restored</Text>
              <Text style={styles.doneBody} testID="recovery-restored-count">
                {phase.docCount > 0
                  ? `Loaded ${phase.docCount} document${phase.docCount === 1 ? '' : 's'} from your Drive.`
                  : 'Your vault key has been unwrapped and stored securely on this device.'}
              </Text>
              <Text style={[styles.doneBody, { marginTop: spacing.sm }]}>
                Documents remain encrypted in Drive — they are downloaded and decrypted only when you open them.
              </Text>
              <View style={[styles.localNote, { backgroundColor: colors.expiringSurface }]}>
                <Info color="#8E6A20" size={14} />
                <Text style={styles.localNoteTxt}>
                  Documents your previous device stored in <Text style={styles.b}>Local Vault</Text> only were never uploaded and cannot be recovered from Drive.
                </Text>
              </View>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton title="Open my Vault" onPress={goHome} variant="dark" testID="recovery-open-vault" />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <InfoSheet visible={learn} title="How SafeVault verifies your password" onClose={() => setLearn(false)}>
        <SheetHeading>Verifier — before any decryption</SheetHeading>
        <SheetParagraph>
          Your Recovery Password is used to derive two independent keys with PBKDF2-SHA256 (210 000 iterations). One is the Key Encryption Key (KEK); the other is a public verifier tag.
        </SheetParagraph>
        <SheetHeading>Wrong password</SheetHeading>
        <SheetParagraph>
          A wrong password produces a different verifier tag. We compare the tag to the one in your envelope BEFORE any AES call. If they don't match, we tell you "Incorrect Recovery Password" — the encrypted key on Drive is not modified in any way.
        </SheetParagraph>
        <SheetHeading>Right password</SheetHeading>
        <SheetParagraph>
          The KEK unwraps the AES ciphertext into your original vault key. That key is written into your device's secure keystore. From that point on, opening documents works exactly as on your previous device.
        </SheetParagraph>
      </InfoSheet>
    </SafeAreaView>
  );
}

function Hero({ icon, title, body, accent, accentSurface }: any) {
  return (
    <View style={[styles.hero, { backgroundColor: accentSurface }]}>
      <View style={[styles.heroIcon, { backgroundColor: accent }]}>{icon}</View>
      <Text style={[styles.heroTitle, { color: accent }]}>{title}</Text>
      <Text style={styles.heroBody}>{body}</Text>
    </View>
  );
}

function LockoutCountdown({ status, onExpired }: { status: LockoutStatus; onExpired: () => void }) {
  const [remaining, setRemaining] = React.useState(status.remainingMs);
  React.useEffect(() => {
    setRemaining(status.remainingMs);
  }, [status.remainingMs]);
  React.useEffect(() => {
    if (remaining <= 0) { onExpired(); return; }
    const iv = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1000);
        if (next === 0) { clearInterval(iv); onExpired(); }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.remainingMs]);

  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rs = s % 60;
    if (m < 60) return `${m}m ${rs.toString().padStart(2, '0')}s`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm.toString().padStart(2, '0')}m`;
  };

  return (
    <View style={[styles.done, { backgroundColor: colors.expiredSurface, paddingVertical: spacing.lg }]}>
      <View style={[styles.doneIconWrap, { backgroundColor: colors.expired }]}>
        <Timer color="#fff" size={26} strokeWidth={1.8} />
      </View>
      <Text style={[styles.doneTitle, { color: colors.expired }]} testID="lockout-remaining">{fmt(remaining)}</Text>
      <Text style={styles.doneBody}>
        Attempt {status.attempts} of your recovery password was incorrect. Please wait before trying again.
      </Text>
    </View>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.xxl * 2 },

  centerBig: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl * 2 },
  centerBigTxt: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  hero: { padding: spacing.xl, borderRadius: radius.hero, alignItems: 'center', gap: spacing.md },
  heroIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...typography.h2, fontWeight: '800', textAlign: 'center' },
  heroBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  body: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginTop: spacing.lg },

  label: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  input: { flex: 1, ...typography.body, color: colors.textPrimary },
  help: { ...typography.caption, color: colors.textTertiary, marginTop: 6, lineHeight: 17 },

  learnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, justifyContent: 'center', marginTop: spacing.md },
  learnTxt: { ...typography.bodySm, fontWeight: '700' },

  link: { ...typography.bodySm, color: colors.textSecondary, textDecorationLine: 'underline', textAlign: 'center' },

  done: { padding: spacing.xl, borderRadius: radius.hero, alignItems: 'center', gap: spacing.sm, ...shadow.sm },
  doneIconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...shadow.md },
  doneTitle: { ...typography.h1, fontWeight: '800' },
  doneBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  localNote: { flexDirection: 'row', gap: 8, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md, alignItems: 'flex-start' },
  localNoteTxt: { flex: 1, ...typography.caption, color: colors.textPrimary, lineHeight: 18 },
  b: { fontWeight: '800' },
});
