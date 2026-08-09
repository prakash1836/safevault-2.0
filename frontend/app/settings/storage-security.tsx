// Storage & Security settings page.
//
// Everything here is UX today — no architecture rewrite. Toggles persist to
// AsyncStorage via services/settings.ts. Biometric / auto-lock / recovery-kit
// / emergency-recovery are labelled as "Coming soon" placeholders per the
// current sprint scope.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Smartphone,
  RefreshCw,
  Wifi,
  Lock,
  Fingerprint,
  Timer,
  KeyRound,
  LifeBuoy,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { Card, IconButton, PrimaryButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { InfoSheet, SheetParagraph, SheetHeading } from '../../src/components/InfoSheet';
import { StoragePreference, type StorageMode } from '../../src/services/storagePreference';
import { Settings, type SettingsState } from '../../src/services/settings';
import { RecoveryPassword } from '../../src/services/recoveryPassword';
import { Recovery } from '../../src/services/recovery';
import { colors, radius, spacing, typography, shadow } from '../../src/constants/theme';
import { hapt } from '../../src/utils/haptics';

export default function StorageSecuritySettings() {
  const t = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { docs, drive: driveUsage, refreshDrive } = useVault();
  const { drive: driveConnected, setDriveConnected } = usePermissions();

  const [defaultMode, setDefaultMode] = useState<StorageMode>('both');
  const [settings, setSettings] = useState<SettingsState>(Settings.DEFAULT_SETTINGS);
  const [busy, setBusy] = useState<string | null>(null);
  const [showPlaceholder, setShowPlaceholder] = useState<null | { title: string; body: string }>(null);
  const [recoveryLocal, setRecoveryLocal] = useState<boolean>(false);
  const [recoveryDrive, setRecoveryDrive] = useState<null | { revision: number; updatedAt: string }>(null);
  const [checkingRecovery, setCheckingRecovery] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const [mode, s, hasLocal] = await Promise.all([
          StoragePreference.getMode(),
          Settings.get(),
          Recovery.isRecoveryConfiguredLocally(),
        ]);
        setDefaultMode(mode);
        setSettings(s);
        setRecoveryLocal(hasLocal);
      } catch {}
    })();
  }, []);

  // Best-effort Drive check for recovery envelope (only when connected)
  useEffect(() => {
    if (!user || !driveConnected) return;
    let cancelled = false;
    (async () => {
      setCheckingRecovery(true);
      try {
        const found = await Recovery.fetchEnvelope(user);
        if (!cancelled) setRecoveryDrive(found ? { revision: found.envelope.revision, updatedAt: found.envelope.updatedAt } : null);
      } catch {
        if (!cancelled) setRecoveryDrive(null);
      } finally {
        if (!cancelled) setCheckingRecovery(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, driveConnected]);

  const patchSettings = async (patch: Partial<SettingsState>) => {
    const next = await Settings.update(patch);
    setSettings(next);
  };

  const onChangeDefaultMode = (mode: StorageMode) => {
    hapt.selection();
    setDefaultMode(mode);
    void StoragePreference.setMode(mode);
  };

  const onSyncNow = async () => {
    hapt.light();
    setBusy('sync');
    try {
      await refreshDrive();
      await Settings.markSyncedNow();
      const s = await Settings.get();
      setSettings(s);
      hapt.success();
    } catch {
      hapt.error();
      Alert.alert('Sync failed', 'Could not refresh Drive right now. Please try again.');
    } finally { setBusy(null); }
  };

  const onDisableAutoSync = async (val: boolean) => {
    if (!val) {
      hapt.warning();
      Alert.alert(
        'Turn off Auto Sync?',
        'New documents that use cloud storage will NOT upload until you sync manually. Existing Drive documents remain safe.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn off', style: 'destructive', onPress: () => patchSettings({ autoSync: false }) },
        ],
      );
    } else {
      await patchSettings({ autoSync: true });
    }
  };

  const onDangerFolderInfo = () => {
    Alert.alert(
      'SafeVault folder on Google Drive',
      'Deleting your SafeVault folder from Google Drive may permanently remove your backed-up documents. Use the Drive web/app to inspect the folder; SafeVault does not offer a delete-remote button.',
      [{ text: 'Got it' }],
    );
  };

  const onDangerClearLocal = () => {
    Alert.alert(
      'Clear Local Vault?',
      "This will remove all encrypted files from this device's local cache. Documents backed up to Drive will still be recoverable when we ship the Recovery Sprint. Local-only documents will be lost.",
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Placeholder — not yet enabled', style: 'destructive', onPress: () => {} }],
    );
  };

  const placeholder = (title: string, body: string) => setShowPlaceholder({ title, body });

  const usedMb = driveUsage.used / (1024 * 1024);
  const totalGb = driveUsage.total / (1024 * 1024 * 1024);
  const vaultMb = driveUsage.vault / (1024 * 1024);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="storage-security-screen">
      <View style={styles.top}>
        <IconButton variant="surface" onPress={() => router.back()} testID="settings-back-btn">
          <ChevronLeft color={colors.textPrimary} size={22} />
        </IconButton>
        <Text style={styles.topTitle}>Storage & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* STORAGE */}
        <Animated.View entering={FadeInDown.duration(220)}>
          <SectionHeader title="Storage" />
          <Card variant="elevated" style={{ padding: 0 }}>
            <Row
              icon={<Smartphone color={t.accent} size={18} />}
              title="Default for new documents"
              subtitle={
                defaultMode === 'local' ? 'Local Vault' : defaultMode === 'drive' ? 'Google Drive' : 'Local + Google Drive'
              }
              accent={t.accentSurface}
              right={
                <SegmentedChoice
                  value={defaultMode}
                  onChange={onChangeDefaultMode}
                  testID="storage-default-mode"
                />
              }
              stack
            />
            <Divider />
            <RowSwitch
              icon={<RefreshCw color={t.accent} size={18} />}
              title="Auto Sync"
              subtitle="Upload new documents to Drive automatically"
              value={settings.autoSync}
              onValueChange={onDisableAutoSync}
              accent={t.accent}
              accentSurface={t.accentSurface}
              testID="settings-auto-sync"
            />
            <Divider />
            <RowSwitch
              icon={<Wifi color={t.accent} size={18} />}
              title="Sync only on Wi-Fi"
              subtitle="Skip mobile-data uploads"
              value={settings.syncOnlyOnWifi}
              onValueChange={(v) => patchSettings({ syncOnlyOnWifi: v })}
              accent={t.accent}
              accentSurface={t.accentSurface}
              testID="settings-wifi-only"
            />
          </Card>
        </Animated.View>

        {/* SYNC STATUS */}
        <Animated.View entering={FadeInDown.delay(80).duration(220)} style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Sync Status" />
          <Card variant="elevated" style={{ padding: 0 }}>
            <Row
              icon={<Cloud color={t.accent} size={18} />}
              title="Google Account"
              subtitle={user?.email || 'Not connected'}
              accent={t.accentSurface}
              stack
            />
            <Divider />
            <Row
              icon={<Cloud color={t.accent} size={18} />}
              title="Google Drive Folder"
              subtitle={driveConnected ? '/SafeVault' : '—'}
              accent={t.accentSurface}
              stack
            />
            <Divider />
            <Row
              icon={<Cloud color={t.accent} size={18} />}
              title="Storage Used"
              subtitle={
                driveConnected
                  ? `${vaultMb.toFixed(1)} MB vault · ${usedMb.toFixed(0)} MB / ${totalGb.toFixed(0)} GB used`
                  : 'Connect Google Drive to see usage'
              }
              accent={t.accentSurface}
              stack
            />
            <Divider />
            <Row
              icon={<RefreshCw color={t.accent} size={18} />}
              title="Last Synced"
              subtitle={
                settings.lastSyncedAt ? new Date(settings.lastSyncedAt).toLocaleString() : 'Never'
              }
              accent={t.accentSurface}
              stack
            />
            <View style={{ padding: spacing.md }}>
              <PrimaryButton
                title="Sync Now"
                onPress={onSyncNow}
                loading={busy === 'sync'}
                variant="secondary"
                testID="settings-sync-now-btn"
                icon={<RefreshCw color={t.accent} size={16} />}
              />
            </View>
          </Card>
        </Animated.View>

        {/* SECURITY */}
        <Animated.View entering={FadeInDown.delay(140).duration(220)} style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Security" />
          <Card variant="elevated" style={{ padding: 0 }}>
            {/* Recovery status header */}
            <View style={styles.recoveryHeader} testID="recovery-status-row">
              {recoveryDrive ? (
                <View style={[styles.recoveryBadge, { backgroundColor: t.accentSurface, borderColor: t.accent }]}>
                  <ShieldCheck color={t.accent} size={16} strokeWidth={2} />
                  <Text style={[styles.recoveryBadgeTxt, { color: t.accent }]}>Recovery configured</Text>
                </View>
              ) : (
                <View style={[styles.recoveryBadge, { backgroundColor: colors.expiringSurface, borderColor: colors.expiringSoon }]}>
                  <AlertTriangle color="#8E6A20" size={16} strokeWidth={2} />
                  <Text style={[styles.recoveryBadgeTxt, { color: '#8E6A20' }]}>Recovery not configured</Text>
                </View>
              )}
              <Text style={styles.recoverySub}>
                {checkingRecovery
                  ? 'Checking Google Drive…'
                  : recoveryDrive
                    ? `Envelope rev. ${recoveryDrive.revision} · updated ${new Date(recoveryDrive.updatedAt).toLocaleDateString()}`
                    : driveConnected
                      ? 'No recovery envelope in your Drive. Set one up so a new phone can restore this vault.'
                      : 'Connect Google Drive to use recovery.'}
              </Text>
            </View>
            <Divider />
            {!recoveryDrive ? (
              <Row
                icon={<KeyRound color={t.accent} size={18} />}
                title="Set Up Recovery"
                subtitle="Wrap your vault key with a Recovery Password"
                accent={t.accentSurface}
                chevron
                testID="settings-set-up-recovery"
                onPress={() => router.push('/recovery/setup')}
              />
            ) : (
              <Row
                icon={<KeyRound color={t.accent} size={18} />}
                title="Change Recovery Password"
                subtitle="Re-wrap the same vault key with a new password"
                accent={t.accentSurface}
                chevron
                testID="settings-change-recovery"
                onPress={() => router.push('/recovery/change')}
              />
            )}
            <Divider />
            <Row
              icon={<Info color={t.accent} size={18} />}
              title="Recovery information"
              subtitle="How your key envelope keeps SafeVault zero-knowledge"
              accent={t.accentSurface}
              chevron
              testID="settings-recovery-info"
              onPress={() =>
                placeholder(
                  'How recovery works',
                  'Your Recovery Password derives a Key Encryption Key (KEK) via PBKDF2 (210 000 iterations). The KEK wraps your vault key with AES-256-CBC and the wrapped result is stored inside your Google Drive at SafeVault/manifest/recovery.json. A separate verifier tag detects wrong passwords BEFORE any decryption. Neither the password nor the vault key ever leave this device.',
                )
              }
            />
            <Divider />
            <RowSwitch
              icon={<Fingerprint color={t.accent} size={18} />}
              title="Biometric Unlock"
              subtitle="Available in next build"
              value={settings.biometricUnlock}
              onValueChange={(v) => patchSettings({ biometricUnlock: v })}
              accent={t.accent}
              accentSurface={t.accentSurface}
              placeholder
              testID="settings-biometric"
            />
            <Divider />
            <Row
              icon={<Timer color={t.accent} size={18} />}
              title="Auto Lock"
              subtitle={settings.autoLock === 'off' ? 'Off' : `After ${settings.autoLock}`}
              accent={t.accentSurface}
              chevron
              testID="settings-autolock"
              onPress={() =>
                placeholder(
                  'Auto Lock',
                  'Auto Lock will be enabled together with biometric unlock in a dedicated Security Sprint. Your preference is saved and will be honoured then.',
                )
              }
            />
            <Divider />
            <Row
              icon={<LifeBuoy color={t.accent} size={18} />}
              title="Export Recovery Kit"
              subtitle="Coming soon"
              accent={t.accentSurface}
              chevron
              testID="settings-recovery-kit"
              onPress={() =>
                placeholder(
                  'Export Recovery Kit',
                  'A printable PDF that records your envelope location and a wrong-password-safe verification tag. Never contains your password or vault key. Deferred to a follow-up sprint pending secure-PDF review.',
                )
              }
            />
            <Divider />
            <Row
              icon={<ShieldCheck color={t.accent} size={18} />}
              title="Emergency Recovery"
              subtitle="Coming soon"
              accent={t.accentSurface}
              chevron
              testID="settings-emergency-recovery"
              onPress={() =>
                placeholder(
                  'Emergency Recovery',
                  'Nominate a trusted contact who can help you recover your vault via a Shamir-shared secret. Not enabled yet — planned as a dedicated follow-up sprint.',
                )
              }
            />
          </Card>
        </Animated.View>

        {/* ENCRYPTION */}
        <Animated.View entering={FadeInDown.delay(200).duration(220)} style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Encryption" />
          <Card variant="elevated" style={{ padding: 0 }}>
            <RowSwitch
              icon={<Lock color={t.accent} size={18} />}
              title="Encrypt Sensitive Documents"
              subtitle="AES-256 on-device before upload"
              value={settings.encryptSensitive}
              onValueChange={(v) => {
                if (!v) {
                  Alert.alert(
                    'Disable encryption?',
                    'Turning encryption off will leave sensitive documents visible to Google Drive and to anyone who accesses your Drive. This is strongly discouraged.',
                    [
                      { text: 'Keep encryption on', style: 'cancel' },
                      { text: 'Understood, disable', style: 'destructive', onPress: () => patchSettings({ encryptSensitive: false }) },
                    ],
                  );
                } else {
                  patchSettings({ encryptSensitive: true });
                }
              }}
              accent={t.accent}
              accentSurface={t.accentSurface}
              testID="settings-encrypt"
            />
            <Divider />
            <Row
              icon={<Info color={t.accent} size={18} />}
              title="How encryption works"
              subtitle="Per-document details"
              accent={t.accentSurface}
              chevron
              testID="settings-encryption-info"
              onPress={() =>
                placeholder(
                  'Per-document encryption',
                  'Every document you add is encrypted on this device using AES-256 with an IV per file. The key never leaves your phone. Only SafeVault, when unlocked with your Recovery Password, can decrypt the ciphertext.',
                )
              }
            />
          </Card>
        </Animated.View>

        {/* DANGER ZONE */}
        <Animated.View entering={FadeInDown.delay(260).duration(220)} style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Danger zone" />
          <Card style={[styles.dangerCard, { padding: 0 }]}>
            <Row
              icon={<AlertTriangle color={colors.expired} size={18} />}
              title="Deleting SafeVault folder in Drive"
              subtitle="May permanently remove your backed-up documents"
              accent={colors.expiredSurface}
              chevron
              testID="danger-folder-info"
              onPress={onDangerFolderInfo}
            />
            <Divider />
            <Row
              icon={<AlertTriangle color={colors.expired} size={18} />}
              title="Clear Local Vault"
              subtitle="Removes encrypted files from this device"
              accent={colors.expiredSurface}
              chevron
              testID="danger-clear-local"
              onPress={onDangerClearLocal}
            />
          </Card>
        </Animated.View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <InfoSheet
        visible={!!showPlaceholder}
        title={showPlaceholder?.title || ''}
        onClose={() => setShowPlaceholder(null)}
      >
        <SheetParagraph>{showPlaceholder?.body || ''}</SheetParagraph>
      </InfoSheet>
    </SafeAreaView>
  );
}

/* ---------------- Sub-components ---------------- */

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Row({
  icon,
  title,
  subtitle,
  accent,
  right,
  chevron,
  onPress,
  testID,
  stack,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  testID?: string;
  stack?: boolean;
}) {
  const content = (
    <View style={[styles.row, stack && { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm }]}>
      <View style={[styles.rowMain, stack && { width: '100%' }]}>
        <View style={[styles.rowIcon, { backgroundColor: accent }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
        {chevron && <ChevronRight color={colors.textTertiary} size={18} />}
      </View>
      {right}
    </View>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} testID={testID} haptic="light">
        {content}
      </PressableScale>
    );
  }
  return <View testID={testID}>{content}</View>;
}

function RowSwitch({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  accent,
  accentSurface,
  placeholder,
  testID,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  accent: string;
  accentSurface: string;
  placeholder?: boolean;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.rowMain}>
        <View style={[styles.rowIcon, { backgroundColor: accentSurface }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.rowTitle}>{title}</Text>
            {placeholder && (
              <View style={styles.placeholderTag}><Text style={styles.placeholderTagTxt}>Soon</Text></View>
            )}
          </View>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
        <Switch
          value={value}
          onValueChange={(v) => { hapt.selection(); onValueChange(v); }}
          trackColor={{ true: accent, false: colors.border }}
          thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
        />
      </View>
    </View>
  );
}

function SegmentedChoice({
  value,
  onChange,
  testID,
}: {
  value: StorageMode;
  onChange: (v: StorageMode) => void;
  testID?: string;
}) {
  const t = useTheme();
  const items: { key: StorageMode; label: string }[] = [
    { key: 'local', label: 'Local' },
    { key: 'drive', label: 'Drive' },
    { key: 'both', label: 'Both' },
  ];
  return (
    <View style={styles.segWrap} testID={testID}>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <PressableScale key={it.key} onPress={() => onChange(it.key)} haptic="selection" testID={`seg-${it.key}`}>
            <View style={[styles.segItem, active && { backgroundColor: t.accent }]}>
              <Text style={[styles.segItemTxt, { color: active ? '#fff' : colors.textSecondary }]}>{it.label}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.xxl },

  section: { ...typography.overline, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: 4, letterSpacing: 0.6 },

  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },

  divider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },

  placeholderTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.expiringSurface },
  placeholderTagTxt: { fontSize: 9, color: '#8E6A20', fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },

  segWrap: { flexDirection: 'row', backgroundColor: colors.elevated, borderRadius: radius.pill, padding: 3, alignSelf: 'stretch' },
  segItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  segItemTxt: { ...typography.caption, fontWeight: '800', letterSpacing: 0.3 },

  dangerCard: { borderColor: colors.overdueSurface, backgroundColor: colors.expiredSurface },

  recoveryHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 6 },
  recoveryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  recoveryBadgeTxt: { ...typography.caption, fontWeight: '800' },
  recoverySub: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
});
