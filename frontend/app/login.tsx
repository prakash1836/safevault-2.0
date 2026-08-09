import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Cloud, Lock, Sparkles } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { PrimaryButton } from '../src/components/UI';
import { PressableScale } from '../src/components/PressableScale';
import { Logo } from '../src/components/Logo';
import { colors, spacing, radius, typography } from '../src/constants/theme';

export default function Login() {
  const { loginGoogle, loginDemo, hasGoogleConfig } = useAuth();
  const t = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState<'google' | 'demo' | null>(null);

  const onGoogle = async () => {
    setLoading('google');
    const r = await loginGoogle();
    setLoading(null);
    if (!r.ok) {
      if (r.reason === 'cancelled') return;
      Alert.alert('Sign-in failed', 'We could not connect to Google. Try demo mode or check your network.');
    }
  };
  const onDemo = async () => {
    setLoading('demo');
    await loginDemo();
    router.replace('/onboarding');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)} style={[styles.heroCard, { backgroundColor: t.accentDark }]} testID="login-hero">
          <View style={styles.logoWrap}>
            <Logo size={64} onDark primary={t.accent} accent="#FFFFFF" style={{ marginBottom: spacing.lg }} />
            <Text style={styles.logoText}>SafeVault</Text>
            <Text style={styles.tagline}>Secure. Organize. Never forget.</Text>
          </View>
          <View style={[styles.diamond, { backgroundColor: t.accent + '40' }]} />
          <View style={[styles.diamond2, { backgroundColor: t.accent + '20' }]} />
        </Animated.View>

        <View style={styles.featureList}>
          <Animated.View entering={FadeInDown.delay(120).duration(280)}>
            <Feature
              icon={<Lock color={t.accent} size={20} strokeWidth={1.6} />}
              title="End‑to‑end encrypted"
              sub="Files are AES‑256 encrypted on your device before upload"
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(180).duration(280)}>
            <Feature
              icon={<Cloud color={t.accent} size={20} strokeWidth={1.6} />}
              title="Stored in your Google Drive"
              sub="We use the drive.file scope — we only see files SafeVault creates. The rest of your Drive stays private."
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(240).duration(280)}>
            <Feature
              icon={<Sparkles color={t.accent} size={20} strokeWidth={1.6} />}
              title="Reminders that work for you"
              sub="Never miss a passport renewal, insurance expiry, or birthday again"
            />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(280)} style={styles.actions}>
          <PrimaryButton
            title={hasGoogleConfig ? 'Continue with Google' : 'Connect Google Drive'}
            onPress={onGoogle}
            loading={loading === 'google'}
            variant="dark"
            testID="login-google-btn"
          />
          <PressableScale onPress={onDemo} haptic="light" testID="login-demo-btn">
            <View style={styles.demoBtn}>
              <Text style={[styles.demoText, { color: t.accent }]}>
                {loading === 'demo' ? 'Loading…' : 'Try Demo Mode'}
              </Text>
            </View>
          </PressableScale>
          <PressableScale onPress={() => router.push('/recovery/restore')} haptic="light" testID="login-restore-btn">
            <View style={styles.demoBtn}>
              <Text style={[styles.demoText, { color: t.accent }]}>Restore from Google Drive →</Text>
            </View>
          </PressableScale>
          <Text style={styles.fineprint} testID="login-fineprint">
            By continuing you agree to our Terms & Privacy. We never read or share your documents.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featTitle}>{title}</Text>
        <Text style={styles.featSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: 40 },
  heroCard: { borderRadius: 28, padding: spacing.xxxl, paddingVertical: 48, overflow: 'hidden', position: 'relative', minHeight: 300, justifyContent: 'center' },
  logoWrap: { alignItems: 'flex-start' },
  logoText: { ...typography.display, color: '#fff' },
  tagline: { color: 'rgba(255,255,255,0.78)', ...typography.bodyLg, marginTop: 8, maxWidth: 260 },
  diamond: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -80, right: -60 },
  diamond2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, bottom: -50, right: 30 },
  featureList: { marginTop: spacing.xxl, gap: spacing.lg },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  featTitle: { ...typography.bodyLg, fontWeight: '700', color: colors.textPrimary },
  featSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  actions: { marginTop: spacing.xxxl },
  demoBtn: { paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  demoText: { ...typography.body, fontWeight: '700', letterSpacing: 0.2 },
  fineprint: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md, lineHeight: 17, paddingHorizontal: spacing.md },
});
