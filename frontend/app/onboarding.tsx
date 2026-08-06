// New onboarding — a single-route stepper flow.
//
//   Welcome → User Details → Vault Security → Storage → Google Drive →
//   Encryption → Pricing → Permissions → Dashboard
//
// Route is still `/onboarding` (single file). Existing testIDs from the
// previous onboarding (`onboarding-screen`, `onboarding-continue-btn`,
// `onboarding-skip-btn`, `perm-drive`, `perm-notifications`, `perm-media`)
// are preserved so existing e2e tests keep working.

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Platform,
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
  Eye,
  EyeOff,
  Server,
  ChevronLeft,
  Sparkles,
  KeyRound,
  Info,
  IdCard,
  HeartPulse,
  FileText,
  UserRound,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAuth } from '../src/contexts/AuthContext';
import { PrimaryButton, Card } from '../src/components/UI';
import { PressableScale } from '../src/components/PressableScale';
import { Logo } from '../src/components/Logo';
import { TrustBadges, DEFAULT_TRUST } from '../src/components/TrustBadges';
import { StorageModeCard } from '../src/components/StorageModeCard';
import { InfoSheet, SheetParagraph, SheetHeading } from '../src/components/InfoSheet';
import { RecoveryPassword, evaluatePasswordStrength, MIN_PASSWORD_LENGTH } from '../src/services/recoveryPassword';
import { StoragePreference, type StorageMode } from '../src/services/storagePreference';
import { colors, radius, spacing, shadow, typography } from '../src/constants/theme';
import { hapt } from '../src/utils/haptics';

const STEPS = ['welcome', 'user', 'security', 'storage', 'drive', 'encrypt', 'pricing', 'perms'] as const;
type StepKey = typeof STEPS[number];

export default function Onboarding() {
  const {
    notifications,
    media,
    drive,
    requestNotifications,
    requestMedia,
    setOnboarded,
    setDriveConnected,
  } = usePermissions();
  const { user, loginGoogle, hasGoogleConfig } = useAuth();
  const t = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<StepKey>('welcome');
  const [busy, setBusy] = useState<string | null>(null);

  // Step 2 — user details
  const [displayName, setDisplayName] = useState('');
  const [vaultName, setVaultName] = useState('');

  // Step 3 — security
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Step 4 — storage
  const [storageMode, setStorageMode] = useState<StorageMode>('both');
  useEffect(() => {
    (async () => {
      try {
        const m = await StoragePreference.getMode();
        setStorageMode(m);
      } catch {}
    })();
  }, []);

  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  const idx = STEPS.indexOf(step);
  const goTo = (s: StepKey) => { hapt.selection(); setStep(s); };
  const next = () => { hapt.light(); setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]); };
  const back = () => { hapt.light(); setStep(STEPS[Math.max(0, idx - 1)]); };

  const finishOnboarding = async () => {
    hapt.success();
    try {
      if (displayName.trim()) await StoragePreference.setDisplayName(displayName.trim());
      if (vaultName.trim()) await StoragePreference.setVaultName(vaultName.trim());
      await StoragePreference.setMode(storageMode);
    } catch {}
    await setOnboarded();
    router.replace('/(tabs)/home');
  };

  // ---------- STEP BODIES ----------
  const renderWelcome = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.welcomeHeader}>
        <View style={[styles.bigShield, { backgroundColor: t.accentDark }]}>
          <Logo size={54} onDark primary={t.accent} accent="#FFFFFF" />
        </View>
        <Text style={styles.h1}>Your Personal Digital Vault</Text>
        <Text style={styles.h2Center}>
          Secure your important documents, reminders and memories in one place.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(100).duration(240)} style={{ marginTop: spacing.xl }}>
        <TrustBadges items={DEFAULT_TRUST} testID="welcome-trust-badges" />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200).duration(240)} style={styles.pointList}>
        <PointRow icon={<Lock color={t.accent} size={18} />} title="End-to-End Encryption" desc="Your documents are encrypted on this device before anything leaves your phone." />
        <PointRow icon={<Cloud color={t.accent} size={18} />} title="Your Own Google Drive" desc="Encrypted files land inside your Drive — never on our servers." />
        <PointRow icon={<Server color={t.accent} size={18} />} title="Zero SafeVault Servers" desc="We don't run a document server. Nobody at SafeVault can see your files." />
        <PointRow icon={<Sparkles color={t.accent} size={18} />} title="Offline Access" desc="Recent documents stay available even without a connection." />
      </Animated.View>
    </ScrollView>
  );

  const renderUser = () => (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(220)}>
        <Text style={styles.h1}>Tell us about yourself</Text>
        <Text style={styles.h2}>Two quick fields, then we&apos;ll never ask again</Text>
      </Animated.View>
      <Label text="Your name" />
      <View style={[styles.inputWrap, { borderColor: displayName ? t.accent : colors.border }]}>
        <UserRound color={t.accent} size={16} />
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Prakash"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCapitalize="words"
          testID="onboarding-name-input"
        />
      </View>

      <Label text="Vault name (optional)" />
      <View style={[styles.inputWrap, { borderColor: vaultName ? t.accent : colors.border }]}>
        <FileText color={t.accent} size={16} />
        <TextInput
          value={vaultName}
          onChangeText={setVaultName}
          placeholder={displayName ? `${displayName}'s Vault` : "Prakash's Vault"}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          testID="onboarding-vaultname-input"
        />
      </View>
      <Text style={styles.help}>This name personalizes your vault only. It never leaves this device.</Text>
    </ScrollView>
  );

  const renderSecurity = () => {
    const match = password.length > 0 && password === confirm;
    const strong = strength.score >= 2 && password.length >= MIN_PASSWORD_LENGTH;
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(220)}>
          <View style={[styles.securityHead, { backgroundColor: t.accentSurface }]}>
            <KeyRound color={t.accent} size={22} strokeWidth={1.8} />
            <Text style={[styles.securityHeadTxt, { color: t.accent }]}>Create a Recovery Password</Text>
          </View>
          <Text style={styles.securityBody}>
            This password protects your encrypted vault. SafeVault{' '}
            <Text style={styles.b}>never stores</Text> this password. If forgotten, encrypted
            documents cannot be recovered.
          </Text>
        </Animated.View>

        <Label text="Password" />
        <View style={[styles.inputWrap, { borderColor: password ? t.accent : colors.border }]}>
          <Lock color={t.accent} size={16} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            testID="onboarding-password-input"
          />
          <PressableScale onPress={() => setShowPw((v) => !v)} haptic="none">
            {showPw ? <EyeOff color={colors.textTertiary} size={18} /> : <Eye color={colors.textTertiary} size={18} />}
          </PressableScale>
        </View>
        {password.length > 0 && (
          <View style={styles.strengthRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      i < strength.score
                        ? strength.score >= 3 ? t.accent : strength.score === 2 ? colors.expiringSoon : colors.expired
                        : colors.border,
                  },
                ]}
              />
            ))}
            <Text style={[styles.strengthLabel, { color: strength.score >= 3 ? t.accent : colors.textSecondary }]}>{strength.label}</Text>
          </View>
        )}
        {strength.hints.length > 0 && password.length > 0 && (
          <Text style={styles.help} testID="onboarding-password-hint">{strength.hints[0]}</Text>
        )}

        <Label text="Confirm password" />
        <View style={[styles.inputWrap, { borderColor: match ? t.accent : confirm.length > 0 ? colors.expired : colors.border }]}>
          <Lock color={t.accent} size={16} />
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            testID="onboarding-confirm-input"
          />
        </View>
        {confirm.length > 0 && !match && (
          <Text style={[styles.help, { color: colors.expired }]}>Passwords do not match</Text>
        )}

        <PressableScale onPress={() => { hapt.selection(); setAcknowledged((v) => !v); }} testID="onboarding-ack-checkbox" haptic="none">
          <View style={styles.ackRow}>
            <View style={[styles.ackBox, acknowledged && { backgroundColor: t.accent, borderColor: t.accent }]}>
              {acknowledged && <Check color="#fff" size={14} strokeWidth={3} />}
            </View>
            <Text style={styles.ackText}>
              I understand this password cannot be recovered.
            </Text>
          </View>
        </PressableScale>
      </ScrollView>
    );
  };

  const renderStorage = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(220)}>
        <Text style={styles.h1}>Where should your vault live?</Text>
        <Text style={styles.h2}>You can change this later — and per document too</Text>
      </Animated.View>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <StorageModeCard mode="both"  selected={storageMode === 'both'}  onSelect={setStorageMode} recommended testID="onboarding-storage-both" />
        <StorageModeCard mode="drive" selected={storageMode === 'drive'} onSelect={setStorageMode} testID="onboarding-storage-drive" />
        <StorageModeCard mode="local" selected={storageMode === 'local'} onSelect={setStorageMode} testID="onboarding-storage-local" />
      </View>
    </ScrollView>
  );

  const renderDrive = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(220)} style={styles.driveHero}>
        <View style={[styles.driveIconWrap, { backgroundColor: t.accentDark }]}>
          <Cloud color="#fff" size={30} strokeWidth={1.6} />
        </View>
        <Text style={styles.h1Center}>Your Google Drive.{"\n"}Your Vault.</Text>
      </Animated.View>
      <View style={styles.driveList}>
        <DriveBullet accent={t.accent} text="SafeVault never stores your documents on its own servers." />
        <DriveBullet accent={t.accent} text="Documents are stored only inside YOUR Google Drive." />
        <DriveBullet accent={t.accent} text="Sensitive files are encrypted before upload." />
        <DriveBullet accent={t.accent} text="Google cannot understand encrypted documents." />
        <DriveBullet accent={t.accent} text="SafeVault employees cannot access your files." />
        <DriveBullet accent={t.accent} text="Nobody except you owns your vault." />
      </View>
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {drive ? (
          <View style={[styles.driveConnected, { backgroundColor: t.accentSurface, borderColor: t.accent }]} testID="drive-connected-banner">
            <Check color={t.accent} size={18} strokeWidth={2.4} />
            <Text style={[styles.driveConnectedTxt, { color: t.accent }]}>Google Drive connected</Text>
          </View>
        ) : (
          <PrimaryButton
            title={hasGoogleConfig ? 'Connect Google Drive' : 'Continue in demo mode'}
            onPress={onConnectDrive}
            loading={busy === 'drive'}
            variant="dark"
            testID="perm-drive"
            icon={<Cloud color="#fff" size={18} />}
          />
        )}
      </View>
    </ScrollView>
  );

  const [encryptLearn, setEncryptLearn] = useState(false);
  const renderEncrypt = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(220)}>
        <View style={[styles.securityHead, { backgroundColor: t.accentSurface }]}>
          <ShieldCheck color={t.accent} size={22} strokeWidth={1.8} />
          <Text style={[styles.securityHeadTxt, { color: t.accent }]}>Sensitive files are encrypted before upload</Text>
        </View>
      </Animated.View>
      <Text style={styles.h2}>Documents like these are protected with AES-256 the moment you add them:</Text>
      <View style={styles.encExamples}>
        {[
          { icon: IdCard, label: 'Passport' },
          { icon: IdCard, label: 'PAN Card' },
          { icon: IdCard, label: 'Driving License' },
          { icon: FileText, label: 'Property Documents' },
          { icon: ShieldCheck, label: 'Insurance' },
          { icon: HeartPulse, label: 'Medical Records' },
        ].map((it) => {
          const Ic = it.icon;
          return (
            <View key={it.label} style={styles.encChip}>
              <Ic color={t.accent} size={14} />
              <Text style={styles.encChipTxt}>{it.label}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.encBody}>
        Encrypted files cannot be opened directly from Google Drive. They can only be decrypted using SafeVault with your Recovery Password.
      </Text>
      <PressableScale onPress={() => setEncryptLearn(true)} haptic="light" testID="onboarding-encrypt-learn">
        <View style={[styles.learnMore, { borderColor: t.accent }]}>
          <Info color={t.accent} size={16} />
          <Text style={[styles.learnMoreTxt, { color: t.accent }]}>Learn more about SafeVault encryption</Text>
        </View>
      </PressableScale>
    </ScrollView>
  );

  const renderPricing = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(220)}>
        <Text style={styles.h1}>Choose your plan</Text>
        <Text style={styles.h2}>You can always change or cancel later</Text>
      </Animated.View>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <PlanCard
          title="Free"
          price="₹0"
          highlight={false}
          features={['Up to 25 documents', 'End-to-end encryption', 'Expiry reminders']}
          testID="plan-free"
        />
        <PlanCard
          title="Premium"
          price="₹99 / mo"
          badge="Popular"
          highlight
          features={['Unlimited documents', 'Priority sync', 'Advanced reminders', 'Export Recovery Kit (coming soon)']}
          testID="plan-premium"
        />
        <PlanCard
          title="Family"
          price="₹199 / mo"
          features={['Everything in Premium', 'Up to 5 family members', 'Family recovery (coming soon)']}
          testID="plan-family"
        />
      </View>
      <Text style={styles.pricingFoot}>
        Purchases will be enabled in the next update — you can start on Free today.
      </Text>
    </ScrollView>
  );

  const renderPerms = () => (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(220)}>
        <Text style={styles.h1}>A few last permissions</Text>
        <Text style={styles.h2}>Only what SafeVault needs to work well</Text>
      </Animated.View>
      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <PermRow
          icon={<Bell color={t.accent} size={22} strokeWidth={1.6} />}
          title="Notifications"
          sub="Get expiry reminders 30, 7 and 1 day before"
          status={notifications}
          onPress={async () => { hapt.light(); await requestNotifications(); }}
          ctaLabel="Enable"
          required
          testID="perm-notifications"
          accent={t.accent}
          accentSurface={t.accentSurface}
        />
        <PermRow
          icon={<ImageIcon color={t.accent} size={22} strokeWidth={1.6} />}
          title="Photos & Media"
          sub="Upload document images from your library"
          status={media}
          onPress={async () => { hapt.light(); await requestMedia(); }}
          ctaLabel="Allow"
          required={false}
          testID="perm-media"
          accent={t.accent}
          accentSurface={t.accentSurface}
        />
      </View>
      <View style={[styles.finishAssurance, { backgroundColor: t.accentSurface }]}>
        <ShieldCheck color={t.accent} size={18} strokeWidth={1.6} />
        <Text style={[styles.finishAssuranceTxt, { color: t.accent }]}>
          Encryption keys never leave your device. We cannot read your documents.
        </Text>
      </View>
    </ScrollView>
  );

  const onConnectDrive = async () => {
    hapt.light();
    if (user?.demo === false && user?.accessToken) {
      setDriveConnected(true);
      hapt.success();
      return;
    }
    setBusy('drive');
    try {
      const r = await loginGoogle();
      if (r.ok) { setDriveConnected(true); hapt.success(); }
    } catch (e) {
      console.warn('Drive connection failed:', e);
    } finally { setBusy(null); }
  };

  // ---------- ADVANCE GATES ----------
  const canContinue = (): boolean => {
    switch (step) {
      case 'welcome': return true;
      case 'user': return displayName.trim().length > 0;
      case 'security':
        return (
          password.length >= MIN_PASSWORD_LENGTH &&
          password === confirm &&
          acknowledged
        );
      case 'storage': return true;
      case 'drive': return true;
      case 'encrypt': return true;
      case 'pricing': return true;
      case 'perms': return true;
    }
  };

  const onPrimary = async () => {
    // Handle side-effects on each step's primary action.
    if (step === 'security') {
      try {
        await RecoveryPassword.set(password);
      } catch (e: any) {
        Alert.alert('Could not save', e?.message || 'Please try a different password');
        return;
      }
    }
    if (step === 'storage') {
      try { await StoragePreference.setMode(storageMode); } catch {}
    }
    if (step === 'user') {
      try {
        if (displayName.trim()) await StoragePreference.setDisplayName(displayName.trim());
        if (vaultName.trim()) await StoragePreference.setVaultName(vaultName.trim());
      } catch {}
    }
    if (step === 'perms') { await finishOnboarding(); return; }
    next();
  };

  const primaryTitle = (() => {
    switch (step) {
      case 'welcome': return 'Get Started';
      case 'user': return 'Continue';
      case 'security': return 'Save & Continue';
      case 'storage': return 'Continue';
      case 'drive': return drive || !hasGoogleConfig ? 'Continue' : 'Skip for now';
      case 'encrypt': return 'Got it';
      case 'pricing': return 'Continue with Free';
      case 'perms': return 'Enter my Vault';
    }
  })();

  const secondaryAction = (() => {
    // Only shown on drive step, when the user hasn't connected yet.
    if (step === 'drive' && !drive && hasGoogleConfig) return { label: 'Skip for now', onPress: next };
    return null;
  })();

  const body = (() => {
    switch (step) {
      case 'welcome': return renderWelcome();
      case 'user': return renderUser();
      case 'security': return renderSecurity();
      case 'storage': return renderStorage();
      case 'drive': return renderDrive();
      case 'encrypt': return renderEncrypt();
      case 'pricing': return renderPricing();
      case 'perms': return renderPerms();
    }
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="onboarding-screen">
      {/* Top bar with back + step dots */}
      <View style={styles.topBar}>
        {idx > 0 ? (
          <PressableScale onPress={back} testID="onboarding-back-btn" haptic="light">
            <View style={styles.backBtn}>
              <ChevronLeft color={colors.textPrimary} size={20} />
            </View>
          </PressableScale>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <View style={styles.dotsRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor: i === idx ? t.accent : i < idx ? t.accent : colors.border,
                  opacity: i === idx ? 1 : i < idx ? 0.8 : 0.5,
                  width: i === idx ? 20 : 6,
                },
              ]}
            />
          ))}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {body}

      {/* Footer */}
      <View style={styles.footer}>
        <PrimaryButton
          title={primaryTitle}
          onPress={onPrimary}
          disabled={!canContinue()}
          loading={busy === 'drive' && step === 'drive'}
          variant="dark"
          testID="onboarding-continue-btn"
        />
        {secondaryAction ? (
          <PressableScale onPress={secondaryAction.onPress} testID="onboarding-skip-btn" haptic="light">
            <Text style={styles.skipTxt}>{secondaryAction.label}</Text>
          </PressableScale>
        ) : idx < STEPS.length - 1 && (step === 'pricing' || step === 'encrypt' || step === 'drive') ? null : null}
      </View>

      <InfoSheet
        visible={encryptLearn}
        title="How SafeVault encryption works"
        onClose={() => setEncryptLearn(false)}
      >
        <SheetHeading>Why encryption exists</SheetHeading>
        <SheetParagraph>
          Documents like passports, IDs and insurance are irreplaceable. Storing them on any cloud in plain-text means whoever has access to that cloud can also read them. SafeVault takes that risk off the table by encrypting on the device first.
        </SheetParagraph>
        <SheetHeading>How recovery works</SheetHeading>
        <SheetParagraph>
          Your Recovery Password is a personal secret only you know. In the upcoming Recovery Sprint, this password will let a new phone unlock the same encrypted vault stored in your Google Drive. Today the password lives securely on this device, ready to be used by that future flow.
        </SheetParagraph>
        <SheetHeading>Why Google cannot read the files</SheetHeading>
        <SheetParagraph>
          Encryption keys never leave your phone. The Drive API only sees encrypted blobs and the file names you allow it to see. Even if Google inspected the file, they would find only scrambled bytes.
        </SheetParagraph>
      </InfoSheet>
    </SafeAreaView>
  );
}

/* ------------------------------ SUB-COMPONENTS ------------------------------ */

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function PointRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function DriveBullet({ text, accent }: { text: string; accent: string }) {
  return (
    <View style={styles.driveBullet}>
      <View style={[styles.driveBulletDot, { backgroundColor: accent }]} />
      <Text style={styles.driveBulletTxt}>{text}</Text>
    </View>
  );
}

function PlanCard({
  title,
  price,
  features,
  badge,
  highlight,
  testID,
}: {
  title: string;
  price: string;
  features: string[];
  badge?: string;
  highlight?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.planCard,
        highlight && { borderColor: t.accent, backgroundColor: t.accentSurface, ...shadow.md },
      ]}
      testID={testID}
    >
      <View style={styles.planHead}>
        <Text style={styles.planTitle}>{title}</Text>
        {!!badge && (
          <View style={[styles.planBadge, { backgroundColor: t.accent }]}>
            <Text style={styles.planBadgeTxt}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.planPrice, { color: highlight ? t.accent : colors.textPrimary }]}>{price}</Text>
      <View style={{ marginTop: spacing.sm, gap: 6 }}>
        {features.map((f, i) => (
          <View key={i} style={styles.planFeatureRow}>
            <Check color={t.accent} size={14} strokeWidth={2.4} />
            <Text style={styles.planFeatureTxt}>{f}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PermRow({
  icon,
  title,
  sub,
  status,
  onPress,
  ctaLabel,
  required,
  testID,
  accent,
  accentSurface,
}: any) {
  return (
    <View style={[styles.permRow, status && { borderColor: accent }]} testID={testID}>
      <View style={[styles.permIcon, { backgroundColor: accentSurface }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.permTitle}>{title}</Text>
          {required && !status && (
            <View style={styles.requiredTag}>
              <Text style={styles.requiredTxt}>required</Text>
            </View>
          )}
        </View>
        <Text style={styles.permSub}>{sub}</Text>
      </View>
      {status ? (
        <View style={[styles.granted, { backgroundColor: accentSurface }]}>
          <Check color={accent} size={18} strokeWidth={2.4} />
        </View>
      ) : (
        <PressableScale onPress={onPress} haptic="light">
          <View style={[styles.permCta, { borderColor: accent, backgroundColor: accentSurface }]}>
            <Text style={[styles.permCtaTxt, { color: accent }]}>{ctaLabel}</Text>
          </View>
        </PressableScale>
      )}
    </View>
  );
}

/* ------------------------------ STYLES ------------------------------ */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  stepDot: { height: 6, borderRadius: 3 },

  // Content
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  h1: { ...typography.h1, color: colors.textPrimary },
  h1Center: { ...typography.h1, color: colors.textPrimary, textAlign: 'center' },
  h2: { ...typography.body, color: colors.textSecondary, marginTop: 8, marginBottom: spacing.md, lineHeight: 22 },
  h2Center: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22, paddingHorizontal: spacing.md },

  // Welcome
  welcomeHeader: { alignItems: 'center', paddingVertical: spacing.lg },
  bigShield: { width: 92, height: 92, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg, ...shadow.md },
  pointList: { marginTop: spacing.xl, gap: spacing.md },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pointIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  pointTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  pointDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

  // User details
  label: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  input: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 4 },
  help: { ...typography.caption, color: colors.textTertiary, marginTop: 6, lineHeight: 17 },

  // Security
  securityHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.lg },
  securityHeadTxt: { ...typography.h3 },
  securityBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 22 },
  b: { fontWeight: '800', color: colors.textPrimary },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { marginLeft: 6, ...typography.caption, fontWeight: '800' },
  ackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  ackBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  ackText: { flex: 1, ...typography.bodySm, color: colors.textPrimary, lineHeight: 20 },

  // Drive
  driveHero: { alignItems: 'center', paddingVertical: spacing.lg },
  driveIconWrap: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, ...shadow.md },
  driveList: { marginTop: spacing.lg, gap: 10 },
  driveBullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  driveBulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  driveBulletTxt: { flex: 1, ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  driveConnected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md, borderRadius: radius.pill, borderWidth: 1.5 },
  driveConnectedTxt: { ...typography.body, fontWeight: '800' },

  // Encryption
  encExamples: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm, marginBottom: spacing.md },
  encChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  encChipTxt: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  encBody: { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  learnMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5 },
  learnMoreTxt: { ...typography.bodySm, fontWeight: '700' },

  // Pricing
  planCard: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, gap: 6 },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planTitle: { ...typography.h3, color: colors.textPrimary },
  planBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  planBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  planPrice: { ...typography.h1, fontSize: 22, marginTop: 4 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planFeatureTxt: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },
  pricingFoot: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 17 },

  // Permissions
  permRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, ...shadow.xs },
  permIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  permTitle: { ...typography.h3, color: colors.textPrimary },
  permSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  requiredTag: { backgroundColor: colors.expiringSurface, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  requiredTxt: { fontSize: 9, color: '#8E6A20', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  granted: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  permCta: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5 },
  permCtaTxt: { ...typography.bodySm, fontWeight: '700' },
  finishAssurance: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.lg },
  finishAssuranceTxt: { flex: 1, ...typography.bodySm, lineHeight: 20, fontWeight: '500' },

  // Footer
  footer: { padding: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, gap: spacing.md },
  skipTxt: { textAlign: 'center', ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
});
