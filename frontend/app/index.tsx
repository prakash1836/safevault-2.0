import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withDelay } from 'react-native-reanimated';
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { spacing, typography } from '../src/constants/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const { onboarded } = usePermissions();
  const t = useTheme();
  const router = useRouter();

  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(60, withSpring(1, { damping: 12, stiffness: 90 }));
  }, [scale]);

  useEffect(() => {
    if (loading) return;
    // Small delay so users perceive the branded splash rather than a flash
    const t = setTimeout(() => {
      if (!user) router.replace('/login');
      else if (!onboarded) router.replace('/onboarding');
      else router.replace('/(tabs)/home');
    }, 350);
    return () => clearTimeout(t);
  }, [loading, user, onboarded, router]);

  const iconAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.container, { backgroundColor: t.accentDark }]} testID="splash">
      <Animated.View style={styles.content}>
        <Animated.View style={[styles.iconWrap, iconAnim]}>
          <ShieldCheck color="#fff" size={48} strokeWidth={1.5} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(200).duration(450)} style={styles.brand}>SafeVault</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(380).duration(450)} style={styles.tagline}>
          Secure. Sync. Remember.
        </Animated.Text>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(700).duration(400)} style={styles.footer}>
        <Text style={styles.footerText}>Encrypted with AES-256 · Zero-knowledge</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.xl,
  },
  brand: {
    ...typography.h1,
    color: '#fff',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.72)',
    marginTop: spacing.sm,
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xxl + 8,
  },
  footerText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
  },
});
