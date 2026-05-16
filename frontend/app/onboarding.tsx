import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Image as ImageIcon, Cloud, ShieldCheck, Check, X } from 'lucide-react-native';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { PrimaryButton } from '../src/components/UI';
import { colors, radius, spacing } from '../src/constants/theme';

export default function Onboarding() {
  const { notifications, media, drive, requestNotifications, requestMedia, setOnboarded, setDriveConnected } = usePermissions();
  const { user, loginGoogle, hasGoogleConfig } = useAuth();
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const onConnectDrive = async () => {
    if (user?.demo === false && user?.accessToken) {
      setDriveConnected(true);
      return;
    }
    setBusy('drive');
    const r = await loginGoogle();
    setBusy(null);
    if (r.ok) setDriveConnected(true);
  };

  const onContinue = async () => {
    await setOnboarded();
    router.replace('/(tabs)/home');
  };

  const skipped = !notifications || (!media) || !drive;
  const onSkip = () => {
    if (skipped) {
      Alert.alert(
        'Are you sure?',
        'Some features won\'t work without these permissions:\n\n' +
        (!notifications ? '• Reminders for expiring documents\n' : '') +
        (!media ? '• Picking images from your library\n' : '') +
        (!drive ? '• Storing files in Google Drive (demo only)\n' : '') +
        '\nYou can grant them later from Profile.',
        [
          { text: 'Go back' },
          { text: 'Continue anyway', style: 'destructive', onPress: onContinue },
        ]
      );
    } else onContinue();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="onboarding-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.shield, { backgroundColor: t.accentSurface }]}><ShieldCheck color={t.accent} size={26} strokeWidth={1.6} /></View>
          <Text style={styles.h1}>Set up your vault</Text>
          <Text style={styles.h2}>SafeVault needs a few permissions to keep your documents safe and your reminders timely.</Text>
        </View>

        <PermRow
          icon={<Cloud color={t.accent} size={20} strokeWidth={1.6} />}
          title="Google Drive"
          sub="Securely store your encrypted files in your own Drive"
          status={drive}
          onPress={onConnectDrive}
          ctaLabel={hasGoogleConfig ? 'Connect' : 'Use demo'}
          busy={busy === 'drive'}
          required
          testID="perm-drive"
        />
        <PermRow
          icon={<Bell color={t.accent} size={20} strokeWidth={1.6} />}
          title="Notifications"
          sub="Get reminders 30, 7 and 1 days before any document expires"
          status={notifications}
          onPress={async () => { await requestNotifications(); }}
          ctaLabel="Enable"
          required
          testID="perm-notifications"
        />
        <PermRow
          icon={<ImageIcon color={t.accent} size={20} strokeWidth={1.6} />}
          title="Photos & Files"
          sub="Pick documents and family photos from your library"
          status={media}
          onPress={async () => { await requestMedia(); }}
          ctaLabel="Allow"
          required={false}
          testID="perm-media"
        />

        <View style={[styles.assurance, { backgroundColor: t.accentSurface }]}>
          <ShieldCheck color={t.accent} size={16} strokeWidth={1.6} />
          <Text style={[styles.assText, { color: t.accent }]}>
            We never see your password, keys, or document contents. Encryption happens on your device.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Continue" onPress={onContinue} variant="dark" testID="onboarding-continue-btn" />
        <TouchableOpacity onPress={onSkip} testID="onboarding-skip-btn">
          <Text style={styles.skip}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function PermRow({ icon, title, sub, status, onPress, ctaLabel, busy, required, testID }: any) {
  const t = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {required && <View style={styles.requiredTag}><Text style={styles.requiredTxt}>required</Text></View>}
        </View>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {status ? (
        <View style={[styles.granted, { backgroundColor: t.accentSurface }]}>
          <Check color={t.accent} size={16} strokeWidth={2.4} />
        </View>
      ) : (
        <TouchableOpacity onPress={onPress} disabled={busy} style={[styles.cta, { borderColor: t.accent }]}>
          <Text style={[styles.ctaTxt, { color: t.accent }]}>{busy ? '...' : ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: 60 },
  header: { paddingVertical: spacing.lg, marginBottom: spacing.lg },
  shield: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  h1: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 14, color: colors.textSecondary, marginTop: 8, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.md },
  rowIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  requiredTag: { backgroundColor: '#FBF1DE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  requiredTxt: { fontSize: 9, color: '#8E6A20', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  granted: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5 },
  ctaTxt: { fontSize: 12, fontWeight: '700' },
  assurance: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.md },
  assText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
  footer: { padding: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: spacing.md },
  skip: { textAlign: 'center', fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
