import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Logo } from '../src/components/Logo';

const { height: SCREEN_H } = Dimensions.get('window');
const SPLASH_MIN_MS = 1600; // keep under 3s per brief

export default function Index() {
  const { user, loading } = useAuth();
  const { onboarded } = usePermissions();
  const t = useTheme();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Animation values
  const logoScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const wordmarkY = useSharedValue(14);
  const wordmarkOpacity = useSharedValue(0);
  const taglineY = useSharedValue(10);
  const taglineOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.4);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Logo pop
    logoOpacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    logoScale.value = withSequence(
      withTiming(1.06, { duration: 380, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 160 })
    );
    // Halo
    glowOpacity.value = withDelay(120, withTiming(1, { duration: 500 }));
    glowScale.value = withDelay(120, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));

    // Wordmark reveal
    wordmarkOpacity.value = withDelay(420, withTiming(1, { duration: 320 }));
    wordmarkY.value = withDelay(420, withSpring(0, { damping: 16, stiffness: 220 }));

    // Tagline reveal
    taglineOpacity.value = withDelay(720, withTiming(1, { duration: 280 }));
    taglineY.value = withDelay(720, withSpring(0, { damping: 18, stiffness: 220 }));

    // After min duration, mark ready to navigate
    const timer = setTimeout(() => {
      runOnJS(setReady)(true);
    }, SPLASH_MIN_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !ready) return;
    if (!user) router.replace('/login');
    else if (!onboarded) router.replace('/onboarding');
    else router.replace('/(tabs)/home');
  }, [loading, user, onboarded, router, ready]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.55,
    transform: [{ scale: glowScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: t.accentDark }]} testID="splash">
      {/* Soft radial highlight */}
      <Animated.View style={[styles.glow, { backgroundColor: t.accent }, glowStyle]} />

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <Logo size={104} onDark primary={t.accent} accent="#FFFFFF" />
      </Animated.View>

      <Animated.Text style={[styles.wordmark, wordmarkStyle]} testID="splash-wordmark">
        SafeVault
      </Animated.Text>

      <Animated.Text style={[styles.tagline, taglineStyle]} testID="splash-tagline">
        Secure. Organize. Never forget.
      </Animated.Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>End-to-end encrypted</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  glow: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    top: SCREEN_H / 2 - 260,
    opacity: 0.4,
  },
  logoWrap: {
    marginBottom: 28,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.2,
  },
  footer: {
    position: 'absolute',
    bottom: 42,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
