import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShieldCheck, Lock, Cloud } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { PrimaryButton } from '../src/components/UI';
import { colors, spacing, radius } from '../src/constants/theme';

export default function Login() {
  const { loginGoogle, loginDemo, hasGoogleConfig } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<'google' | 'demo' | null>(null);

  const onGoogle = async () => {
    setLoading('google');
    try {
      await loginGoogle();
      router.replace('/(tabs)/home');
    } catch {
      setLoading(null);
    }
  };

  const onDemo = async () => {
    setLoading('demo');
    await loginDemo();
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.heroWrap}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=1200&q=80' }}
          style={styles.hero}
          imageStyle={{ borderRadius: radius.card }}
        >
          <View style={styles.heroOverlay}>
            <View style={styles.logoBadge}>
              <ShieldCheck color="#fff" size={26} strokeWidth={1.6} />
            </View>
            <Text style={styles.heroTitle}>SafeVault</Text>
            <Text style={styles.heroSubtitle}>A peaceful home for your most important documents</Text>
          </View>
        </ImageBackground>
      </View>

      <View style={styles.pitch}>
        <Row icon={<Lock color={colors.primary} size={18} strokeWidth={1.6} />} text="AES‑256 encrypted on your device" />
        <Row icon={<Cloud color={colors.primary} size={18} strokeWidth={1.6} />} text="Stored privately in your Google Drive" />
        <Row icon={<ShieldCheck color={colors.primary} size={18} strokeWidth={1.6} />} text="Zero servers. Your vault, your keys" />
      </View>

      <View style={styles.ctas}>
        <PrimaryButton
          title={hasGoogleConfig ? 'Continue with Google' : 'Connect Google Drive'}
          onPress={onGoogle}
          loading={loading === 'google'}
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
        <Text style={styles.disclaimer} testID="login-disclaimer">
          {hasGoogleConfig
            ? 'We request Drive.file scope only. We can only see files created by SafeVault.'
            : 'Demo mode stores encrypted files locally on this device.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  heroWrap: { flex: 1, paddingTop: spacing.md },
  hero: { flex: 1, borderRadius: radius.card, overflow: 'hidden' },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,63,58,0.55)',
    padding: spacing.xxl,
    justifyContent: 'flex-end',
  },
  logoBadge: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 21 },
  pitch: { paddingVertical: spacing.xl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: colors.primarySurface,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  ctas: { gap: 2 },
  disclaimer: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.md, lineHeight: 17 },
});
