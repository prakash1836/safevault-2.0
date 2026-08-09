import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AlertTriangle, Info, Lock } from 'lucide-react-native';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { StorageModeCard } from '../../src/components/StorageModeCard';
import { InfoSheet, SheetParagraph, SheetHeading } from '../../src/components/InfoSheet';
import { PrimaryButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { useUpload } from '../../src/contexts/UploadContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import {
  StoragePreference,
  type StorageMode,
} from '../../src/services/storagePreference';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { hapt } from '../../src/utils/haptics';

export default function StorageStep() {
  const { draft, setDraft } = useUpload();
  const t = useTheme();
  const router = useRouter();
  const [learnMore, setLearnMore] = useState(false);

  const selectedMode: StorageMode = draft.storageMode || 'both';
  const isLocalOnly = selectedMode === 'local';
  const showsTrustBanner = selectedMode === 'drive' || selectedMode === 'both';

  const [showLocalWarning, setShowLocalWarning] = useState(false);

  React.useEffect(() => {
    // On mount, check whether the user previously dismissed the local warning.
    (async () => {
      const dismissed = await StoragePreference.isLocalOnlyWarningDismissed();
      setShowLocalWarning(isLocalOnly && !dismissed);
    })();
  }, [isLocalOnly]);

  const onSelect = (mode: StorageMode) => {
    setDraft({ storageMode: mode });
  };

  const proceed = async () => {
    hapt.light();
    // Persist the choice as the new default for future uploads.
    try { await StoragePreference.setMode(selectedMode); } catch {}
    router.push('/upload/details');
  };

  const onDismissLocalWarning = async () => {
    hapt.light();
    try { await StoragePreference.dismissLocalOnlyWarning(); } catch {}
    setShowLocalWarning(false);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Add to Vault" />
      <Stepper step={2} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(220)}>
          <Text style={styles.h1}>Where should we store it?</Text>
          <Text style={styles.h2}>You can change this any time for future uploads</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(220)} style={styles.cards}>
          <StorageModeCard
            mode="both"
            selected={selectedMode === 'both'}
            onSelect={onSelect}
            recommended
            testID="storage-mode-both"
          />
          <StorageModeCard
            mode="drive"
            selected={selectedMode === 'drive'}
            onSelect={onSelect}
            testID="storage-mode-drive"
          />
          <StorageModeCard
            mode="local"
            selected={selectedMode === 'local'}
            onSelect={onSelect}
            testID="storage-mode-local"
          />
        </Animated.View>

        {showsTrustBanner && (
          <Animated.View entering={FadeInDown.duration(220)} style={[styles.trust, { backgroundColor: t.accentSurface }]}>
            <Lock color={t.accent} size={16} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.trustText, { color: t.accent }]}>
                Your document will be encrypted before upload.{"\n"}
                Only SafeVault can decrypt it using your recovery credentials.
              </Text>
              <PressableScale onPress={() => setLearnMore(true)} haptic="light" testID="storage-learn-more-btn">
                <Text style={[styles.link, { color: t.accent }]}>Learn more →</Text>
              </PressableScale>
            </View>
          </Animated.View>
        )}

        {isLocalOnly && showLocalWarning && (
          <Animated.View entering={FadeInDown.duration(220)} style={styles.warn} testID="storage-local-warning">
            <AlertTriangle color={colors.expired} size={18} strokeWidth={1.8} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Local-only storage</Text>
              <Text style={styles.warnBody}>
                This document will only exist on this device. If your phone is lost, reset or damaged, this document cannot be recovered.
              </Text>
              <PressableScale onPress={onDismissLocalWarning} haptic="light" testID="storage-dismiss-warning">
                <Text style={[styles.link, { color: t.accent }]}>Don&apos;t show this warning again</Text>
              </PressableScale>
            </View>
          </Animated.View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          title="Continue"
          onPress={proceed}
          variant="dark"
          testID="storage-continue-btn"
        />
      </View>

      <InfoSheet
        visible={learnMore}
        title="Why encrypted?"
        onClose={() => setLearnMore(false)}
        testID="storage-learn-sheet"
      >
        <SheetHeading>End-to-end encryption</SheetHeading>
        <SheetParagraph>
          SafeVault encrypts sensitive documents with AES-256 on this device before anything leaves your phone. Nobody — not even Google or SafeVault — can read the ciphertext without the key that lives inside your device&apos;s secure enclave.
        </SheetParagraph>
        <SheetHeading>Why can&apos;t Google read them?</SheetHeading>
        <SheetParagraph>
          The file that reaches Google Drive is a scrambled blob. Opening it from the Drive website will just show meaningless characters. That&apos;s the point — Drive is a safe cupboard, but only you hold the key.
        </SheetParagraph>
        <SheetHeading>How does recovery work?</SheetHeading>
        <SheetParagraph>
          The recovery password you set during setup identifies you to SafeVault. When we ship the multi-device recovery sprint, the same password will let a new phone unlock your existing Drive vault. Right now the password is stored securely on this device only.
        </SheetParagraph>
      </InfoSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  h1: { ...typography.h1, color: colors.textPrimary },
  h2: { ...typography.bodySm, color: colors.textSecondary, marginTop: 6, marginBottom: spacing.lg },
  cards: { gap: spacing.md, marginBottom: spacing.lg },
  trust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  trustText: { ...typography.bodySm, lineHeight: 20, fontWeight: '500' },
  link: { ...typography.bodySm, fontWeight: '700', marginTop: 6 },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.expiredSurface,
    borderWidth: 1,
    borderColor: colors.overdueSurface,
    marginTop: spacing.md,
  },
  warnTitle: { ...typography.bodySm, fontWeight: '800', color: colors.textPrimary },
  warnBody: { ...typography.caption, color: colors.textPrimary, marginTop: 4, lineHeight: 18 },
  footer: {
    padding: spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
