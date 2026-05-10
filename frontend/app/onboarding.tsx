import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  Bell, 
  Image as ImageIcon, 
  Cloud, 
  ShieldCheck, 
  Check, 
  Lock,
  ArrowRight,
  Info,
  Fingerprint,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { colors, radius, spacing, shadow } from '../src/constants/theme';

// Progress Indicator
function SetupProgress({ step, total }: { step: number; total: number }) {
  const t = useTheme();
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View 
          key={i} 
          style={[
            styles.progressDot,
            i < step 
              ? { backgroundColor: t.accent } 
              : { backgroundColor: colors.border }
          ]} 
        />
      ))}
    </View>
  );
}

// Permission Row Component
function PermissionCard({ 
  icon, 
  title, 
  description, 
  privacyNote,
  status, 
  onPress, 
  ctaLabel, 
  busy, 
  required, 
  testID,
  delay,
}: any) {
  const t = useTheme();
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.View 
      style={[
        styles.permCard,
        status && styles.permCardGranted,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        }
      ]} 
      testID={testID}
    >
      <View style={styles.permHeader}>
        <View style={[styles.permIconWrap, { backgroundColor: status ? t.accentSurface : colors.elevated }]}>
          {React.cloneElement(icon, { color: status ? t.accent : colors.textSecondary })}
        </View>
        <View style={styles.permTitleRow}>
          <View style={styles.permTitleContainer}>
            <Text style={styles.permTitle}>{title}</Text>
            {required && !status && (
              <View style={styles.requiredBadge}>
                <Text style={styles.requiredText}>Required</Text>
              </View>
            )}
          </View>
          {status ? (
            <View style={[styles.grantedBadge, { backgroundColor: t.accentSurface }]}>
              <Check color={t.accent} size={14} strokeWidth={2.5} />
              <Text style={[styles.grantedText, { color: t.accent }]}>Enabled</Text>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={onPress} 
              disabled={busy} 
              style={[styles.permCta, { backgroundColor: t.accentDark }]}
              activeOpacity={0.8}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.permCtaText}>{ctaLabel}</Text>
                  <ArrowRight color="#fff" size={14} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <Text style={styles.permDescription}>{description}</Text>
      
      {privacyNote && !status && (
        <View style={styles.privacyNote}>
          <EyeOff color={colors.textTertiary} size={12} strokeWidth={2} />
          <Text style={styles.privacyNoteText}>{privacyNote}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Trust Assurance Card
function TrustCard({ accent, accentSurface }: any) {
  return (
    <View style={[styles.trustCard, { backgroundColor: accentSurface }]}>
      <View style={styles.trustCardHeader}>
        <Fingerprint color={accent} size={20} strokeWidth={1.8} />
        <Text style={[styles.trustCardTitle, { color: accent }]}>Your Privacy Guarantee</Text>
      </View>
      <View style={styles.trustCardContent}>
        <TrustPoint 
          icon={<Lock color={accent} size={14} strokeWidth={2} />}
          text="Encryption keys never leave your device"
          accent={accent}
        />
        <TrustPoint 
          icon={<EyeOff color={accent} size={14} strokeWidth={2} />}
          text="We cannot read your documents"
          accent={accent}
        />
        <TrustPoint 
          icon={<ShieldCheck color={accent} size={14} strokeWidth={2} />}
          text="Open source & auditable"
          accent={accent}
        />
      </View>
    </View>
  );
}

function TrustPoint({ icon, text, accent }: any) {
  return (
    <View style={styles.trustPoint}>
      <View style={[styles.trustPointIcon, { backgroundColor: accent + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.trustPointText, { color: accent }]}>{text}</Text>
    </View>
  );
}

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

  const completedCount = [drive, notifications, media].filter(Boolean).length;
  const skipped = !notifications || (!media) || !drive;
  
  const onSkip = () => {
    if (skipped) {
      Alert.alert(
        'Continue without permissions?',
        'Some features will be limited:\n\n' +
        (!notifications ? '• No expiry reminders\n' : '') +
        (!media ? '• Can\'t pick from photo library\n' : '') +
        (!drive ? '• Files stored locally only\n' : '') +
        '\nYou can enable these later in Settings.',
        [
          { text: 'Go back' },
          { text: 'Continue anyway', style: 'destructive', onPress: onContinue },
        ]
      );
    } else onContinue();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="onboarding-screen">
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIconWrap, { backgroundColor: t.accentSurface }]}>
            <ShieldCheck color={t.accent} size={28} strokeWidth={1.8} />
          </View>
          <Text style={styles.headerTitle}>Setup Your Vault</Text>
          <Text style={styles.headerSubtitle}>
            Grant a few permissions to unlock the full power of SafeVault. 
            Your privacy is always protected.
          </Text>
          <SetupProgress step={completedCount} total={3} />
        </View>

        {/* Permission Cards */}
        <View style={styles.permissionsSection}>
          <PermissionCard
            icon={<Cloud size={22} strokeWidth={1.8} />}
            title="Cloud Backup"
            description="Store encrypted documents securely in your personal Google Drive. Your files sync across all your devices."
            privacyNote="We only access files SafeVault creates"
            status={drive}
            onPress={onConnectDrive}
            ctaLabel={hasGoogleConfig ? 'Connect' : 'Demo mode'}
            busy={busy === 'drive'}
            required
            testID="perm-drive"
            delay={100}
          />
          
          <PermissionCard
            icon={<Bell size={22} strokeWidth={1.8} />}
            title="Smart Reminders"
            description="Get notified 30, 7, and 1 day before documents expire. Never miss an important deadline."
            privacyNote="Notifications are processed locally"
            status={notifications}
            onPress={async () => { await requestNotifications(); }}
            ctaLabel="Enable"
            required
            testID="perm-notifications"
            delay={200}
          />
          
          <PermissionCard
            icon={<ImageIcon size={22} strokeWidth={1.8} />}
            title="Photo Access"
            description="Pick documents and family photos directly from your library to add to your vault."
            privacyNote="Photos are encrypted before upload"
            status={media}
            onPress={async () => { await requestMedia(); }}
            ctaLabel="Allow"
            required={false}
            testID="perm-media"
            delay={300}
          />
        </View>

        {/* Trust Card */}
        <View style={styles.trustSection}>
          <TrustCard accent={t.accent} accentSurface={t.accentSurface} />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.continueBtn, { backgroundColor: t.accentDark }]}
          onPress={onContinue}
          activeOpacity={0.85}
          testID="onboarding-continue-btn"
        >
          <Text style={styles.continueBtnText}>Continue to Vault</Text>
          <ArrowRight color="#fff" size={18} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={onSkip} 
          style={styles.skipBtn}
          testID="onboarding-skip-btn"
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: colors.bg,
  },
  scroll: { 
    paddingBottom: 20,
  },

  // Header
  header: { 
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.lg,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },

  // Permissions Section
  permissionsSection: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  permCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  permCardGranted: {
    borderColor: 'transparent',
  },
  permHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: spacing.sm,
  },
  permIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  permTitleContainer: {
    flex: 1,
    gap: 6,
  },
  permTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  requiredBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  grantedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  permCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  permCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  permDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  privacyNoteText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },

  // Trust Section
  trustSection: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  trustCard: {
    borderRadius: 18,
    padding: spacing.lg,
  },
  trustCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.md,
  },
  trustCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  trustCardContent: {
    gap: spacing.sm,
  },
  trustPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trustPointIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustPointText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    ...shadow.sm,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
