import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck, 
  Cloud, 
  Lock, 
  Sparkles, 
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { colors, spacing, radius, shadow } from '../src/constants/theme';

// Animated Shield Logo Component
function AnimatedLogo({ accent }: { accent: string }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.logoContainer,
        { 
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }
      ]}
    >
      <View style={styles.logoOuter}>
        <View style={styles.logoInner}>
          <ShieldCheck color="#fff" size={40} strokeWidth={1.8} />
        </View>
      </View>
    </Animated.View>
  );
}

// Custom Google Button with better loading state
function GoogleSignInButton({ onPress, loading, hasConfig }: any) {
  const t = useTheme();
  
  return (
    <TouchableOpacity
      style={[styles.googleBtn, { backgroundColor: t.accentDark }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      testID="login-google-btn"
    >
      {loading ? (
        <View style={styles.googleBtnContent}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.googleBtnText}>Connecting...</Text>
        </View>
      ) : (
        <View style={styles.googleBtnContent}>
          <View style={styles.googleIconWrap}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          <Text style={styles.googleBtnText}>
            {hasConfig ? 'Continue with Google' : 'Connect Google Drive'}
          </Text>
          <ArrowRight color="rgba(255,255,255,0.6)" size={18} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// Demo Mode Button
function DemoButton({ onPress, loading }: any) {
  const t = useTheme();
  
  return (
    <TouchableOpacity
      style={[styles.demoBtn, { backgroundColor: t.accentSurface }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
      testID="login-demo-btn"
    >
      {loading ? (
        <ActivityIndicator color={t.accent} size="small" />
      ) : (
        <Text style={[styles.demoBtnText, { color: t.accent }]}>
          Try Demo Mode
        </Text>
      )}
    </TouchableOpacity>
  );
}

// Trust Feature Card
function TrustFeature({ icon, title, description, accent, delay }: any) {
  const slideAnim = useRef(new Animated.Value(30)).current;
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
        styles.trustFeature,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        }
      ]}
    >
      <View style={[styles.trustIcon, { backgroundColor: colors.elevated }]}>
        {icon}
      </View>
      <View style={styles.trustContent}>
        <Text style={styles.trustTitle}>{title}</Text>
        <Text style={styles.trustDescription}>{description}</Text>
      </View>
    </Animated.View>
  );
}

// Privacy Badge
function PrivacyBadge({ accent, accentSurface }: any) {
  return (
    <View style={[styles.privacyBadge, { backgroundColor: accentSurface }]}>
      <View style={styles.privacyIcon}>
        <EyeOff color={accent} size={14} strokeWidth={2} />
      </View>
      <Text style={[styles.privacyText, { color: accent }]}>
        Zero-knowledge encryption
      </Text>
    </View>
  );
}

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
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: t.accentDark }]} testID="login-hero">
          {/* Decorative Background */}
          <View style={[styles.heroDecor1, { backgroundColor: t.accent + '20' }]} />
          <View style={[styles.heroDecor2, { backgroundColor: t.accent + '15' }]} />
          <View style={[styles.heroDecor3, { backgroundColor: t.accent + '10' }]} />
          
          {/* Logo */}
          <AnimatedLogo accent={t.accent} />
          
          {/* Brand Name */}
          <Text style={styles.brandName}>SafeVault</Text>
          
          {/* Tagline */}
          <Text style={styles.tagline}>
            Securely organize and track{'\n'}important documents.
          </Text>
          
          {/* Privacy Badge */}
          <PrivacyBadge accent={t.accent} accentSurface="rgba(255,255,255,0.15)" />
        </View>

        {/* Trust Features */}
        <View style={styles.trustSection}>
          <Text style={styles.trustHeading}>Why SafeVault?</Text>
          
          <TrustFeature
            icon={<Lock color={t.accent} size={20} strokeWidth={1.8} />}
            title="Military-grade encryption"
            description="AES-256 encryption happens on your device. Your files are protected before they ever leave your phone."
            accent={t.accent}
            delay={100}
          />
          
          <TrustFeature
            icon={<Cloud color={t.accent} size={20} strokeWidth={1.8} />}
            title="Your data stays yours"
            description="Files are stored in your personal Google Drive. We can only access files SafeVault creates — nothing else."
            accent={t.accent}
            delay={200}
          />
          
          <TrustFeature
            icon={<Sparkles color={t.accent} size={20} strokeWidth={1.8} />}
            title="Smart reminders"
            description="Get notified before documents expire. Never miss a passport renewal or insurance deadline again."
            accent={t.accent}
            delay={300}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <GoogleSignInButton 
            onPress={onGoogle}
            loading={loading === 'google'}
            hasConfig={hasGoogleConfig}
          />
          
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <DemoButton 
            onPress={onDemo}
            loading={loading === 'demo'}
          />
        </View>

        {/* Legal Footer */}
        <View style={styles.legalSection}>
          <View style={styles.legalBadge}>
            <CheckCircle2 color={colors.textTertiary} size={12} strokeWidth={2} />
            <Text style={styles.legalText}>
              We never read or share your documents
            </Text>
          </View>
          <Text style={styles.finePrint} testID="login-fineprint">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: colors.bg,
  },
  scroll: { 
    paddingBottom: 40,
  },

  // Hero Section
  heroSection: { 
    paddingHorizontal: spacing.xxl,
    paddingTop: 48,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
  },
  heroDecor1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -120,
    right: -80,
  },
  heroDecor2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: -60,
    left: -60,
  },
  heroDecor3: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: 60,
    left: -40,
  },

  // Logo
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoOuter: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Brand
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },

  // Privacy Badge
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  privacyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Trust Section
  trustSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  trustHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  trustFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trustIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  trustDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: 4,
  },

  // Action Section
  actionSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
  },
  googleBtn: {
    borderRadius: 16,
    padding: 16,
    ...shadow.md,
  },
  googleBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  demoBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Legal Section
  legalSection: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  legalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  legalText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  finePrint: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
