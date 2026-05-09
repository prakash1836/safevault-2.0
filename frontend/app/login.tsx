import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShieldCheck, Cloud, Lock, Sparkles } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { PrimaryButton } from '../src/components/UI';
import { colors, spacing, radius } from '../src/constants/theme';

export default function Login() {
  const { loginGoogle, loginDemo, hasGoogleConfig, user } = useAuth();
  const t = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState<'google' | 'demo' | null>(null);

  // Navigate away when user is logged in (after Google OAuth completes)
  useEffect(() => {
    if (user) {
      router.replace('/onboarding');
    }
  }, [user, router]);

  const onGoogle = async () => {
    setLoading('google');
    const r = await loginGoogle();
    setLoading(null);
    if (!r.ok) {
      if (r.reason === 'cancelled') return;
      // Show helpful message about Expo Go limitations
      Alert.alert(
        'Google Sign-in Not Available',
        'Google OAuth does not work in Expo Go due to redirect URI limitations.\n\n' +
        'Options:\n' +
        '• Use Demo Mode to test all features\n' +
        '• Build a Development Build for full Google OAuth\n\n' +
        'Demo Mode provides the same experience with local storage.',
        [
          { text: 'Try Demo Mode', onPress: onDemo },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
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
        <View style={[styles.heroCard, { backgroundColor: t.accentDark }]} testID="login-hero">
          <View style={styles.logoWrap}>
            <View style={[styles.logoCircle, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <ShieldCheck color="#fff" size={36} strokeWidth={1.6} />
            </View>
            <Text style={styles.logoText}>SafeVault</Text>
            <Text style={styles.tagline}>Your documents. Encrypted. Always with you.</Text>
          </View>
          <View style={[styles.diamond, { backgroundColor: t.accent + '40' }]} />
          <View style={[styles.diamond2, { backgroundColor: t.accent + '20' }]} />
        </View>

        <View style={styles.featureList}>
          <Feature
            icon={<Lock color={t.accent} size={20} strokeWidth={1.6} />}
            title="End‑to‑end encrypted"
            sub="Files are AES‑256 encrypted on your device before upload"
          />
          <Feature
            icon={<Cloud color={t.accent} size={20} strokeWidth={1.6} />}
            title="Stored in your Google Drive"
            sub="We use the drive.file scope — we can only see files SafeVault creates. Your other Drive files stay private."
          />
          <Feature
            icon={<Sparkles color={t.accent} size={20} strokeWidth={1.6} />}
            title="Reminders that work for you"
            sub="Never miss a passport renewal, insurance expiry, or birthday again"
          />
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            title={hasGoogleConfig ? 'Continue with Google' : 'Connect Google Drive'}
            onPress={onGoogle}
            loading={loading === 'google'}
            variant="dark"
            testID="login-google-btn"
          />
          <PrimaryButton
            title="Try Demo Mode"
            onPress={onDemo}
            loading={loading === 'demo'}
            variant="secondary"
            testID="login-demo-btn"
            style={{ marginTop: spacing.md }}
          />
          <Text style={styles.fineprint} testID="login-fineprint">
            By continuing you agree to our Terms & Privacy. We never read or share your documents.
          </Text>
        </View>
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
  heroCard: { borderRadius: 28, padding: spacing.xxxl, paddingVertical: 48, overflow: 'hidden', position: 'relative', minHeight: 280, justifyContent: 'center' },
  logoWrap: { alignItems: 'flex-start' },
  logoCircle: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  logoText: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -0.8 },
  tagline: { color: 'rgba(255,255,255,0.78)', fontSize: 15, marginTop: 8, lineHeight: 22, maxWidth: 260 },
  diamond: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -80, right: -60 },
  diamond2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, bottom: -50, right: 30 },
  featureList: { marginTop: spacing.xxl, gap: spacing.lg },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  featIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  featTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  featSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  actions: { marginTop: spacing.xxxl },
  fineprint: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 17, paddingHorizontal: spacing.md },
});
