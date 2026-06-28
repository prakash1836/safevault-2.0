import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Image as ImageIcon, Cloud, ShieldCheck, Check, Lock, Eye, EyeOff, Server } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { PrimaryButton, Card } from '../src/components/UI';
import { PressableScale } from '../src/components/PressableScale';
import { colors, radius, spacing, shadow, typography } from '../src/constants/theme';
import { hapt } from '../src/utils/haptics';

export default function Onboarding() {
  const { notifications, media, drive, requestNotifications, requestMedia, setOnboarded, setDriveConnected } = usePermissions();
  const { user, loginGoogle, hasGoogleConfig } = useAuth();
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const onConnectDrive = async () => {
    hapt.light();
    // If user already has a valid token, just mark drive as connected
    if (user?.demo === false && user?.accessToken) {
      setDriveConnected(true);
      hapt.success();
      return;
    }
    setBusy('drive');
    try {
      const r = await loginGoogle();
      if (r.ok) { 
        setDriveConnected(true); 
        hapt.success(); 
      }
    } catch (e) {
      console.warn('Drive connection failed:', e);
    } finally {
      setBusy(null);
    }
    // NOTE: Do NOT auto-navigate after permission granted
    // User must manually click Continue or Skip
  };

  const onContinue = async () => {
    hapt.success();
    await setOnboarded();
    router.replace('/(tabs)/home');
  };

  const skipped = !notifications || (!media) || !drive;
  const onSkip = () => {
    hapt.warning();
    if (skipped) {
      Alert.alert(
        'Continue without permissions?',
        'Some features may be limited:\n\n' +
        (!notifications ? '• Document expiry reminders\n' : '') +
        (!media ? '• Photo uploads from library\n' : '') +
        (!drive ? '• Cloud backup (demo mode only)\n' : '') +
        '\nYou can enable these later from Profile.',
        [
          { text: 'Go back' },
          { text: 'Continue', style: 'destructive', onPress: onContinue },
        ]
      );
    } else onContinue();
  };

  const allGranted = notifications && media && drive;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="onboarding-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header with trust messaging */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View style={[styles.shield, { backgroundColor: t.accentDark }]}>
            <ShieldCheck color="#fff" size={28} strokeWidth={1.6} />
          </View>
          <Text style={styles.h1}>Secure your vault</Text>
          <Text style={styles.h2}>
            A few quick permissions to protect your documents and send timely reminders.
          </Text>
        </Animated.View>

        {/* Permission cards */}
        <View style={{ gap: spacing.md }}>
          <Animated.View entering={FadeInDown.delay(100).duration(250)}>
            <PermRow
              icon={<Cloud color={t.accent} size={22} strokeWidth={1.6} />}
              title="Google Drive"
              sub="Store encrypted files in your personal Drive"
              detail="We only access files SafeVault creates"
              status={drive}
              onPress={onConnectDrive}
              ctaLabel={hasGoogleConfig ? 'Connect' : 'Demo mode'}
              busy={busy === 'drive'}
              required
              testID="perm-drive"
            />
          </Animated.View>
          
          <Animated.View entering={FadeInDown.delay(150).duration(250)}>
            <PermRow
              icon={<Bell color={t.accent} size={22} strokeWidth={1.6} />}
              title="Notifications"
              sub="Get expiry reminders 30, 7, and 1 day before"
              detail="Never miss a renewal deadline"
              status={notifications}
              onPress={async () => { hapt.light(); await requestNotifications(); }}
              ctaLabel="Enable"
              required
              testID="perm-notifications"
            />
          </Animated.View>
          
          <Animated.View entering={FadeInDown.delay(200).duration(250)}>
            <PermRow
              icon={<ImageIcon color={t.accent} size={22} strokeWidth={1.6} />}
              title="Photos & Media"
              sub="Upload documents from your photo library"
              detail="Optional but recommended"
              status={media}
              onPress={async () => { hapt.light(); await requestMedia(); }}
              ctaLabel="Allow"
              required={false}
              testID="perm-media"
            />
          </Animated.View>
        </View>

        {/* Trust/Security section */}
        <Animated.View entering={FadeInDown.delay(300).duration(250)} style={styles.trustSection}>
          <Text style={styles.trustTitle}>Your privacy is our priority</Text>
          <View style={styles.trustGrid}>
            <TrustItem icon={<Lock color={t.accent} size={16} />} text="AES-256 encryption" />
            <TrustItem icon={<EyeOff color={t.accent} size={16} />} text="Zero-knowledge design" />
            <TrustItem icon={<Server color={t.accent} size={16} />} text="No server storage" />
            <TrustItem icon={<Eye color={t.accent} size={16} />} text="Only you see files" />
          </View>
        </Animated.View>

        {/* Assurance banner */}
        <Animated.View entering={FadeInDown.delay(350).duration(250)} style={[styles.assurance, { backgroundColor: t.accentSurface }]}>
          <ShieldCheck color={t.accent} size={18} strokeWidth={1.6} />
          <Text style={[styles.assText, { color: t.accent }]}>
            Encryption keys never leave your device. We cannot read your documents.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <PrimaryButton
          title={allGranted ? 'Continue to Vault' : 'Continue'}
          onPress={onContinue}
          variant="dark"
          testID="onboarding-continue-btn"
        />
        <PressableScale onPress={onSkip} testID="onboarding-skip-btn" haptic="light">
          <Text style={styles.skip}>Skip for now</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

function PermRow({ icon, title, sub, detail, status, onPress, ctaLabel, busy, required, testID }: any) {
  const t = useTheme();
  return (
    <View style={[styles.row, status && { borderColor: t.accent }]} testID={testID}>
      <View style={[styles.rowIcon, { backgroundColor: t.accentSurface }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {required && !status && <View style={styles.requiredTag}><Text style={styles.requiredTxt}>required</Text></View>}
        </View>
        <Text style={styles.rowSub}>{sub}</Text>
        {detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      {status ? (
        <View style={[styles.granted, { backgroundColor: t.accentSurface }]}>
          <Check color={t.accent} size={18} strokeWidth={2.4} />
        </View>
      ) : (
        <PressableScale onPress={onPress} disabled={busy} haptic="light">
          <View style={[styles.cta, { borderColor: t.accent, backgroundColor: t.accentSurface }]}>
            <Text style={[styles.ctaTxt, { color: t.accent }]}>{busy ? '...' : ctaLabel}</Text>
          </View>
        </PressableScale>
      )}
    </View>
  );
}

function TrustItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.trustItem}>
      {icon}
      <Text style={styles.trustItemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: 60 },
  
  // Header
  header: { paddingVertical: spacing.lg, marginBottom: spacing.xl },
  shield: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, ...shadow.md },
  h1: { ...typography.h1, color: colors.textPrimary },
  h2: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 },

  // Permission row
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, ...shadow.xs },
  rowIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...typography.h3, color: colors.textPrimary },
  rowSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  rowDetail: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  requiredTag: { backgroundColor: colors.expiringSurface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  requiredTxt: { fontSize: 9, color: '#8E6A20', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  granted: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cta: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5 },
  ctaTxt: { ...typography.bodySm, fontWeight: '700' },

  // Trust section
  trustSection: { marginTop: spacing.xxl, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  trustTitle: { ...typography.overline, color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '47%', paddingVertical: 6 },
  trustItemText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },

  // Assurance
  assurance: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.lg },
  assText: { flex: 1, ...typography.bodySm, lineHeight: 20, fontWeight: '500' },

  // Footer
  footer: { padding: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: spacing.md },
  skip: { textAlign: 'center', ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
});
